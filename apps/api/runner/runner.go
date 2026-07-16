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

// Spawns a command, scans output line-by-line, and streams it to logChan
func spawnCommand(name string, args []string, dir string, logChan chan<- string) error {
	logChan <- fmt.Sprintf("\n[RUNNER] Executing: %s %s\n", name, strings.Join(args, " "))
	cmd := exec.Command(name, args...)
	cmd.Dir = dir

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
			outputChan <- scanner.Text() + "\n"
		}
	}

	go scan(stdout)
	go scan(stderr)

	// Wait for readers in a goroutine and close outputChan
	go func() {
		_ = cmd.Wait()
		close(outputChan)
	}()

	// Read from outputChan and send to logChan
	for line := range outputChan {
		logChan <- line
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
	// We run pipeline steps in `/tmp/run_{runID}` inside the Docker container
	runDir := fmt.Sprintf("/tmp/run_%s", runID)
	accumulatedLogs := ""

	// Helper to emit logs
	emit := func(msg string) {
		accumulatedLogs += msg
		logChan <- msg
	}

	defer func() {
		close(logChan)
		// Clean up files in runDir
		_ = os.RemoveAll(runDir)
	}()

	emit(fmt.Sprintf("[RUNNER] Starting pipeline run %s\n", runID))
	emit("[RUNNER] Compiling visual canvas into infrastructure code...\n")

	// Determine if we are running inside docker container to set endpoints
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
			emit(fmt.Sprintf("[ERROR] Failed to create dir %s: %v\n", dirPath, err))
			onComplete("FAILED", accumulatedLogs)
			return
		}

		content := file.Content

		// --- LOCAL SANDBOX OVERRIDES ---
		// Patch 1: Redirect Terraform AWS provider to LocalStack endpoint
		if file.Path == "terraform/main.tf" {
			content = strings.ReplaceAll(content, "http://localhost:4566", fmt.Sprintf("http://%s:4566", localstackHost))
		}

		// Patch 2: Target local Ubuntu containers for Ansible
		if file.Path == "ansible/hosts.ini" && isDocker {
			content = `[webservers]
ubuntu_ssh_1 ansible_host=ubuntu_ssh_1 ansible_port=22 ansible_user=ubuntu
ubuntu_ssh_2 ansible_host=ubuntu_ssh_2 ansible_port=22 ansible_user=ubuntu

[all:vars]
ansible_python_interpreter=/usr/bin/python3`
		}

		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to write file %s: %v\n", file.Path, err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
		emit(fmt.Sprintf("[COMPILER] Created %s\n", file.Path))
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
		emit(fmt.Sprintf("[WARNING] Canvas JSON parsing failed: %v. Running all phases.\n", err))
		hasTfNodes = true
		hasAnsibleNodes = true
		hasK8sNodes = true
	}

	// Phase 1: Terraform (Provisioning)
	tfDir := filepath.Join(runDir, "terraform")
	if hasTfNodes && fileExists(filepath.Join(tfDir, "main.tf")) {
		emit("\n=========================================\n")
		emit("[PHASE 01] AWS Provisioning (LocalStack)\n")
		emit("=========================================\n")

		if err := spawnCommand("terraform", []string{"init"}, tfDir, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] Terraform init failed: %v\n", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
		if err := spawnCommand("terraform", []string{"apply", "-auto-approve"}, tfDir, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] Terraform apply failed: %v\n", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
	} else {
		emit("\n[PHASE 01] Skipped (No Terraform provisioning nodes present on canvas)\n")
	}

	// Phase 2: Ansible (Configuration)
	ansibleDir := filepath.Join(runDir, "ansible")
	if hasAnsibleNodes && fileExists(filepath.Join(ansibleDir, "playbook.yml")) {
		emit("\n=========================================\n")
		emit("[PHASE 02] Server Configuration (Ansible Sandbox)\n")
		emit("=========================================\n")

		// Locate private key file
		// In Docker, the sandbox folder is mapped to /app/sandbox
		keySourcePath := "/app/sandbox/id_rsa"
		if !fileExists(keySourcePath) {
			// Fallback for local testing out of docker
			keySourcePath = "../../sandbox/id_rsa"
		}

		if !fileExists(keySourcePath) {
			emit(fmt.Sprintf("[ERROR] Sandbox private SSH key not found at %s. Ensure sandbox files exist.\n", keySourcePath))
			onComplete("FAILED", accumulatedLogs)
			return
		}

		// Copy SSH key to temp run folder and set permissions
		tmpKeyPath := fmt.Sprintf("/tmp/id_rsa_%s", runID)
		keyData, err := os.ReadFile(keySourcePath)
		if err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to read private key: %v\n", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
		if err := os.WriteFile(tmpKeyPath, keyData, 0600); err != nil {
			emit(fmt.Sprintf("[ERROR] Failed to write temp private key: %v\n", err))
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

		if err := spawnCommand("ansible-playbook", ansibleArgs, ansibleDir, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] Ansible playbook execution failed: %v\n", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
	} else {
		emit("\n[PHASE 02] Skipped (No Ansible configuration nodes present on canvas)\n")
	}

	// Phase 3: Kubernetes (Container Deployment)
	k8sDir := filepath.Join(runDir, "k8s")
	if hasK8sNodes && fileExists(filepath.Join(k8sDir, "deployment.yaml")) {
		emit("\n=========================================\n")
		emit("[PHASE 03] Kubernetes Deployment (kubectl)\n")
		emit("=========================================\n")

		if err := spawnCommand("kubectl", []string{"apply", "-f", "deployment.yaml"}, k8sDir, logChan); err != nil {
			emit(fmt.Sprintf("[ERROR] kubectl apply failed: %v\n", err))
			onComplete("FAILED", accumulatedLogs)
			return
		}
	} else {
		emit("\n[PHASE 03] Skipped (No Kubernetes deployment nodes present on canvas)\n")
	}

	emit("\n[RUNNER] Pipeline execution completed successfully!\n")
	onComplete("SUCCESS", accumulatedLogs)
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
