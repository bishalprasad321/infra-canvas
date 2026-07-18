package runner

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type FileItem struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type Node struct {
	ID   string      `json:"id"`
	Data interface{} `json:"data"`
}

type Canvas struct {
	Nodes []Node      `json:"nodes"`
	Edges interface{} `json:"edges"`
}

// RepositoryConfig holds the source repository details pulled from a Code Repository
// ("Source") node on the canvas, if one is present.
type RepositoryConfig struct {
	Present bool
	URL     string
	Branch  string
}

// extractRepositoryConfig scans the canvas JSON for a Code Repository node and returns
// its repo URL / branch parameters. Present is false if no such node exists on the canvas.
func extractRepositoryConfig(canvasJSON string) RepositoryConfig {
	var canvas struct {
		Nodes []struct {
			ID   string      `json:"id"`
			Data interface{} `json:"data"`
		} `json:"nodes"`
	}

	cfg := RepositoryConfig{}
	if err := json.Unmarshal([]byte(canvasJSON), &canvas); err != nil {
		return cfg
	}

	for _, node := range canvas.Nodes {
		dataMap, ok := node.Data.(map[string]interface{})
		if !ok {
			continue
		}
		tech, _ := dataMap["tech"].(string)
		if tech != "Source" {
			continue
		}
		cfg.Present = true
		if v, ok := dataMap["repoUrl"].(string); ok {
			cfg.URL = strings.TrimSpace(v)
		}
		if v, ok := dataMap["branch"].(string); ok {
			cfg.Branch = strings.TrimSpace(v)
		}
	}

	return cfg
}

// Spawns a command, scans output line-by-line, and streams it with timestamps to logChan
func spawnCommand(name string, args []string, dir string, env []string, logChan chan<- string) error {
	ts := time.Now().Format("2006-01-02 15:04:05.000")
	logChan <- fmt.Sprintf("[%s] [RUNNER] Executing: %s %s\n", ts, name, strings.Join(args, " "))

	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	if len(env) > 0 {
		cmd.Env = append(os.Environ(), env...)
	}

	// Combine stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	// Stream outputs concurrently
	outputChan := make(chan string)
	scan := func(r io.Reader) {
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			outputChan <- scanner.Text()
		}
		if err := scanner.Err(); err != nil {
			outputChan <- fmt.Sprintf("[ERROR] failed to scan command output: %v", err)
		}
	}

	go scan(stdout)
	go scan(stderr)

	// Wait for readers in a goroutine and close outputChan
	go func() {
		_ = cmd.Wait()
		close(outputChan)
	}()

	// Read from outputChan, prefix with timestamp, and send to logChan
	for line := range outputChan {
		tsLine := time.Now().Format("2006-01-02 15:04:05.000")
		logChan <- fmt.Sprintf("[%s] %s\n", tsLine, line)
	}

	state := cmd.ProcessState
	if state != nil && !state.Success() {
		return fmt.Errorf("command failed with exit code %d", state.ExitCode())
	}
	return nil
}

func RunPipeline(
	runID string,
	canvasJSON string,
	files []FileItem,
	logChan chan<- string,
	onComplete func(status string, logs string),
) {
	runDir := fmt.Sprintf("/tmp/run_%s", runID)
	accumulatedLogs := ""

	// Helper to emit logs with prepended timestamps
	emit := func(msg string) {
		lines := strings.Split(msg, "\n")
		formattedMsg := ""
		for i, line := range lines {
			if i == len(lines)-1 && line == "" {
				break
			}
			tsLine := fmt.Sprintf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05.000"), line)
			formattedMsg += tsLine
		}
		accumulatedLogs += formattedMsg
		logChan <- formattedMsg
	}

	defer func() {
		close(logChan)
		_ = os.RemoveAll(runDir)
	}()

	emit(fmt.Sprintf("[RUNNER] Starting pipeline run %s", runID))
	emit("[RUNNER] Compiling visual canvas into infrastructure code...")

	isDocker := os.Getenv("IS_DOCKER") == "true"
	localstackHost := "localhost"
	if isDocker {
		localstackHost = "localstack"
	}

	// 1. Write the code bundle files to disk
	for _, file := range files {
		fullPath := filepath.Join(runDir, file.Path)
		dirPath := filepath.Dir(fullPath)

		if err := os.MkdirAll(dirPath, 0755); err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to create dir %s: %v", dirPath, err))
			onComplete("FAILED", accumulatedLogs)
			return
		}

		content := file.Content

		// --- LOCAL SANDBOX OVERRIDES ---
		if file.Path == "terraform/main.tf" {
			content = strings.ReplaceAll(content, "http://localhost:4566", fmt.Sprintf("http://%s:4566", localstackHost))
		}

		if file.Path == "ansible/hosts.ini" && isDocker {
			content = `[webservers]
ubuntu_ssh_1 ansible_host=ubuntu_ssh_1 ansible_port=22 ansible_user=ubuntu
ubuntu_ssh_2 ansible_host=ubuntu_ssh_2 ansible_port=22 ansible_user=ubuntu

[all:vars]
ansible_python_interpreter=/usr/bin/python3`
		}

		if file.Path == "ansible/playbook.yml" {
			// The "Deploy Node App" task copies the repo cloned in Phase 00 (see below) from
			// this control node to the remote target; substitute in its real path here.
			appDir := filepath.Join(runDir, "app")
			content = strings.ReplaceAll(content, "__APP_SRC_DIR__", appDir)
		}

		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to write file %s: %v", file.Path, err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
		emit(fmt.Sprintf("[COMPILER] Created %s", file.Path))
	}

	// Parse canvas to check which phases to execute
	var canvas struct {
		Nodes []struct {
			ID   string      `json:"id"`
			Data interface{} `json:"data"`
		} `json:"nodes"`
	}
	hasTfNodes := false
	hasAnsibleNodes := false
	hasK8sNodes := false

	if err := json.Unmarshal([]byte(canvasJSON), &canvas); err == nil {
		for _, node := range canvas.Nodes {
			idLower := strings.ToLower(node.ID)
			if strings.Contains(idLower, "aws_instance") || strings.Contains(idLower, "terraform") {
				hasTfNodes = true
			}
			if strings.Contains(idLower, "ansible") || strings.Contains(idLower, "nginx") || strings.Contains(idLower, "postgresql") || strings.Contains(idLower, "open-port") || strings.Contains(idLower, "update-packages") || strings.Contains(idLower, "copy-env") {
				hasAnsibleNodes = true
			}
			if strings.Contains(idLower, "k8s") || strings.Contains(idLower, "kubernetes") {
				hasK8sNodes = true
			}
		}
	} else {
		emit(fmt.Sprintf("[WARNING] Canvas JSON parsing failed: %v. Running all phases.", err))
		hasTfNodes = true
		hasAnsibleNodes = true
		hasK8sNodes = true
	}

	// Read verbosity configurations from environment variables
	verboseMode := os.Getenv("VERBOSE") == "true"
	var tfEnv []string
	if verboseMode {
		tfEnv = []string{"TF_LOG=INFO"}
	}

	// Phase 0: Source Code (Clone Repository)
	repoConfig := extractRepositoryConfig(canvasJSON)
	if repoConfig.Present && repoConfig.URL != "" {
		emit("\n=========================================")
		emit("[PHASE 00] Fetching Application Source Code")
		emit("=========================================\n")

		branch := repoConfig.Branch
		if branch == "" {
			branch = "main"
		}
		appDir := filepath.Join(runDir, "app")
		cloneArgs := []string{"clone", "--branch", branch, "--depth", "1", repoConfig.URL, appDir}
		if err := spawnCommand("git", cloneArgs, runDir, nil, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to clone repository %s (branch %s): %v", repoConfig.URL, branch, err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
	} else if repoConfig.Present {
		emit("\n[PHASE 00] Skipped (Code Repository node present but no repository URL configured)")
	} else {
		emit("\n[PHASE 00] Skipped (No Code Repository node present on canvas)")
	}

	// Phase 1: Terraform (Provisioning)
	tfDir := filepath.Join(runDir, "terraform")
	if hasTfNodes && fileExists(filepath.Join(tfDir, "main.tf")) {
		emit("\n=========================================")
		emit("[PHASE 01] AWS Provisioning (LocalStack)")
		emit("=========================================\n")

		if err := spawnCommand("terraform", []string{"init"}, tfDir, tfEnv, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] Terraform init failed: %v", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
		if err := spawnCommand("terraform", []string{"apply", "-auto-approve"}, tfDir, tfEnv, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] Terraform apply failed: %v", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
	} else {
		emit("\n[PHASE 01] Skipped (No Terraform provisioning nodes present on canvas)")
	}

	// Phase 2: Ansible (Configuration)
	ansibleDir := filepath.Join(runDir, "ansible")
	if hasAnsibleNodes && fileExists(filepath.Join(ansibleDir, "playbook.yml")) {
		emit("\n=========================================")
		emit("[PHASE 02] Server Configuration (Ansible Sandbox)")
		emit("=========================================\n")

		keySourcePath := "/app/sandbox/id_rsa"
		if !fileExists(keySourcePath) {
			keySourcePath = "../../sandbox/id_rsa"
		}

		if !fileExists(keySourcePath) {
			emit(fmt.Sprintf("[ERROR] Sandbox private SSH key not found at %s. Ensure sandbox files exist.", keySourcePath))
			onComplete("FAILED", accumulatedLogs)
			return
		}

		tmpKeyPath := fmt.Sprintf("/tmp/id_rsa_%s", runID)
		keyData, err := os.ReadFile(keySourcePath)
		if err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to read private key: %v", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
		if err := os.WriteFile(tmpKeyPath, keyData, 0600); err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to write temp private key: %v", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
		defer func() {
			_ = os.Remove(tmpKeyPath)
		}()

		ansibleArgs := []string{
			"-i", "hosts.ini",
			"playbook.yml",
			"--private-key=" + tmpKeyPath,
			"--ssh-common-args=-o StrictHostKeyChecking=no",
		}
		if verboseMode {
			ansibleArgs = append(ansibleArgs, "-vvv")
		}

		if err := spawnCommand("ansible-playbook", ansibleArgs, ansibleDir, nil, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] Ansible playbook execution failed: %v", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
	} else {
		emit("\n[PHASE 02] Skipped (No Ansible configuration nodes present on canvas)")
	}

	// Phase 3: Kubernetes (Container Deployment)
	k8sDir := filepath.Join(runDir, "k8s")
	if hasK8sNodes && fileExists(filepath.Join(k8sDir, "deployment.yaml")) {
		emit("\n=========================================")
		emit("[PHASE 03] Kubernetes Deployment (kubectl)")
		emit("=========================================\n")

		kubectlArgs := []string{"apply", "-f", "deployment.yaml"}
		if verboseMode {
			kubectlArgs = append(kubectlArgs, "--v=6")
		}

		if err := spawnCommand("kubectl", kubectlArgs, k8sDir, nil, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] kubectl apply failed: %v", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
	} else {
		emit("\n[PHASE 03] Skipped (No Kubernetes deployment nodes present on canvas)")
	}

	emit("\n[RUNNER] Pipeline execution completed successfully!")
	onComplete("SUCCESS", accumulatedLogs)
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
