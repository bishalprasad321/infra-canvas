package main

// `infracanvas sandbox up/status/down` — Phase 1 opt-in beta CLI commands for
// the local Sandbox Agent (see obsidian_memory/08.4 and 06.3). Additive only:
// the existing in-container sandbox stays the default, this is a separate
// opt-in path gated by Config.SandboxAgentBeta.

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh"
)

type sandboxState struct {
	AgentID   string `json:"agent_id"`
	ProjectID string `json:"project_id"`
	PID       int    `json:"pid"`
}

func sandboxCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "sandbox",
		Short: "Manage a local Sandbox Agent bridged to the hosted Runner (opt-in beta)",
	}

	upCmd := &cobra.Command{
		Use:   "up",
		Short: "Start the local sandbox containers and pair an Agent to the hosted Runner",
		Run:   runSandboxUp,
	}
	upCmd.Flags().String("project", "", "Target project workspace ID")

	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Show the paired Agent's connection status",
		Run:   runSandboxStatus,
	}
	statusCmd.Flags().String("project", "", "Target project workspace ID")

	downCmd := &cobra.Command{
		Use:   "down",
		Short: "Stop the local sandbox containers and the Agent process",
		Run:   runSandboxDown,
	}

	cmd.AddCommand(upCmd, statusCmd, downCmd, sandboxAgentCmd(), sandboxAgentRunCmd(), sandboxAgentServiceRunCmd(), sandboxProxyCmd())
	return cmd
}

// requireSandboxBeta prints an enable hint and returns false when the beta
// flag is off, so every sandbox subcommand can bail out with one line.
func requireSandboxBeta(cfg *Config) bool {
	if cfg.SandboxAgentBeta {
		return true
	}
	fmt.Println("Sandbox Agent is an opt-in beta. Enable it with:")
	fmt.Println("  infracanvas config set sandbox-agent-beta true")
	return false
}

func sandboxStateDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".infracanvas", "sandbox")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

func saveSandboxState(st *sandboxState) error {
	dir, err := sandboxStateDir()
	if err != nil {
		return err
	}
	data, _ := json.MarshalIndent(st, "", "  ")
	return os.WriteFile(filepath.Join(dir, "state.json"), data, 0600)
}

func loadSandboxState() (*sandboxState, error) {
	dir, err := sandboxStateDir()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil {
		return nil, fmt.Errorf("no local sandbox state found — run `infracanvas sandbox up` first")
	}
	var st sandboxState
	if err := json.Unmarshal(data, &st); err != nil {
		return nil, err
	}
	return &st, nil
}

// ---- up ----

func runSandboxUp(cmd *cobra.Command, args []string) {
	cfg, err := getClientConfig()
	if err != nil {
		fmt.Printf("Config error: %v\n", err)
		return
	}
	if !requireSandboxBeta(cfg) {
		return
	}

	projectID, _ := cmd.Flags().GetString("project")
	if projectID == "" {
		fmt.Println("Error: --project flag is required.")
		return
	}

	composeDir, err := extractEmbeddedSandboxFiles()
	if err != nil {
		fmt.Printf("Failed to prepare sandbox compose files: %v\n", err)
		return
	}
	composeFile := filepath.Join(composeDir, "docker-compose.sandbox.yml")

	agentID := "agent-" + randomHex(8)
	fmt.Printf("Generating per-installation SSH keypair for %s...\n", agentID)
	privatePEM, publicKeyLine, err := generateAgentKeyPair()
	if err != nil {
		fmt.Printf("Failed to generate keypair: %v\n", err)
		return
	}

	stateDir, err := sandboxStateDir()
	if err != nil {
		fmt.Printf("Failed to prepare state directory: %v\n", err)
		return
	}
	if err := os.WriteFile(filepath.Join(stateDir, agentID+"_key"), []byte(privatePEM), 0600); err != nil {
		fmt.Printf("Failed to save private key: %v\n", err)
		return
	}
	if err := os.WriteFile(filepath.Join(stateDir, agentID+"_key.pub"), []byte(publicKeyLine), 0644); err != nil {
		fmt.Printf("Failed to save public key: %v\n", err)
		return
	}

	// Bake the public half into the local SSH target container(s) — written
	// fresh into this run's extracted compose directory so the containers only
	// trust this installation's key, per obsidian_memory/03.6's per-machine key
	// requirement.
	if err := os.WriteFile(filepath.Join(composeDir, "id_rsa.pub"), []byte(publicKeyLine), 0644); err != nil {
		fmt.Printf("Failed to write id_rsa.pub: %v\n", err)
		return
	}

	fmt.Println("Building and starting local sandbox containers (docker compose)...")
	if err := runDockerCompose(composeFile, "up", "-d", "--build"); err != nil {
		fmt.Printf("docker compose up failed: %v\n", err)
		return
	}

	fmt.Println("Registering agent key with InfraCanvas...")
	fingerprint, err := registerAgentKey(cfg, projectID, agentID, publicKeyLine, privatePEM)
	if err != nil {
		fmt.Printf("Failed to register agent: %v\n", err)
		return
	}
	fmt.Printf("Registered agent %s (key fingerprint: %s)\n", agentID, fingerprint)

	fmt.Println("Pairing with the Agent Gateway...")
	agentToken, err := pairAndFetchToken(cfg, projectID)
	if err != nil {
		fmt.Printf("Pairing failed: %v\n", err)
		return
	}

	// Persisted (mode 0600, same permission pattern as the private key above)
	// so an installed OS service (`sandbox agent install`) can read it on
	// every start, including after a reboot long after this process has
	// exited — see obsidian_memory/08.4's Phase 2 daemon-install entry.
	tokenPath, err := agentTokenFilePath(agentID)
	if err != nil {
		fmt.Printf("Failed to resolve token file path: %v\n", err)
		return
	}
	if err := os.WriteFile(tokenPath, []byte(agentToken), 0600); err != nil {
		fmt.Printf("Failed to save agent token: %v\n", err)
		return
	}

	var pid int
	if running, _ := agentServiceIsRunning(agentID, cfg.GatewayURL); running {
		fmt.Println("Agent is already running as an installed service — skipping foreground process start.")
	} else {
		fmt.Println("Starting the local Agent process...")
		pid, err = startAgentProcess(cfg, agentID, agentToken)
		if err != nil {
			fmt.Printf("Failed to start Agent process: %v\n", err)
			return
		}
	}

	if err := saveSandboxState(&sandboxState{AgentID: agentID, ProjectID: projectID, PID: pid}); err != nil {
		fmt.Printf("Warning: failed to save local sandbox state: %v\n", err)
	}

	fmt.Println("Waiting for the Agent to connect...")
	status, err := pollAgentStatus(cfg, projectID, agentID, 30*time.Second)
	if err != nil {
		fmt.Printf("Agent did not report a status in time: %v\n", err)
		fmt.Println("Check `infracanvas sandbox status` and the local Agent log for details.")
		return
	}
	fmt.Printf("Agent %s is now %s. Sandbox is ready.\n", agentID, status)
}

// ---- status ----

func runSandboxStatus(cmd *cobra.Command, args []string) {
	cfg, err := getClientConfig()
	if err != nil {
		fmt.Printf("Config error: %v\n", err)
		return
	}
	if !requireSandboxBeta(cfg) {
		return
	}

	st, err := loadSandboxState()
	if err != nil {
		fmt.Println(err)
		return
	}

	projectID, _ := cmd.Flags().GetString("project")
	if projectID == "" {
		projectID = st.ProjectID
	}

	resp, err := getAgentStatus(cfg, projectID, st.AgentID)
	if err != nil {
		fmt.Printf("Failed to fetch agent status: %v\n", err)
		return
	}
	fmt.Printf("Agent ID:        %s\n", st.AgentID)
	fmt.Printf("Status:          %v\n", resp["status"])
	fmt.Printf("Key fingerprint: %v\n", resp["key_fingerprint"])
	if lastSeen, ok := resp["last_seen_at"]; ok {
		fmt.Printf("Last seen:       %v\n", lastSeen)
	}
}

// ---- down ----

func runSandboxDown(cmd *cobra.Command, args []string) {
	cfg, err := getClientConfig()
	if err != nil {
		fmt.Printf("Config error: %v\n", err)
		return
	}
	if !requireSandboxBeta(cfg) {
		return
	}

	fmt.Println("Stopping local sandbox containers...")
	composeDir, err := extractEmbeddedSandboxFiles()
	if err != nil {
		fmt.Printf("Failed to prepare sandbox compose files: %v\n", err)
	} else {
		composeFile := filepath.Join(composeDir, "docker-compose.sandbox.yml")
		if err := runDockerCompose(composeFile, "down"); err != nil {
			fmt.Printf("docker compose down failed: %v\n", err)
		}
	}

	st, err := loadSandboxState()
	if err != nil {
		fmt.Println("No running Agent process found.")
		return
	}
	if st.PID > 0 {
		if proc, err := os.FindProcess(st.PID); err == nil {
			_ = proc.Kill()
			fmt.Printf("Stopped Agent process (pid %d).\n", st.PID)
		}
	}
}

// ---- shared helpers ----

// dockerComposeProjectName is set explicitly (not left to Compose's directory-
// name default) so `sandbox up/down` never risks colliding with an unrelated
// Compose project a user happens to have running from the same or a sibling
// directory — exactly the class of bug hit while building
// docker-compose.hosted.yml (see obsidian_memory/08.4's Phase 1 notes).
const dockerComposeProjectName = "infracanvas-sandbox"

func runDockerCompose(composeFile string, args ...string) error {
	fullArgs := append([]string{"compose", "-p", dockerComposeProjectName, "-f", composeFile}, args...)
	cmd := exec.Command("docker", fullArgs...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// generateAgentKeyPair produces a fresh per-installation RSA keypair — plain
// PKCS1 PEM for the private half (matching the format ansible-playbook's
// --private-key flag already expects, same as the legacy sandbox/id_rsa) and
// an OpenSSH authorized_keys line for the public half.
func generateAgentKeyPair() (privatePEM string, publicKeyLine string, err error) {
	key, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		return "", "", err
	}

	privBytes := x509.MarshalPKCS1PrivateKey(key)
	privBlock := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: privBytes}
	privatePEM = string(pem.EncodeToMemory(privBlock))

	sshPub, err := ssh.NewPublicKey(&key.PublicKey)
	if err != nil {
		return "", "", err
	}
	publicKeyLine = string(ssh.MarshalAuthorizedKey(sshPub))

	return privatePEM, publicKeyLine, nil
}

func registerAgentKey(cfg *Config, projectID, agentID, publicKeyLine, privatePEM string) (string, error) {
	payload := map[string]string{
		"agent_id":        agentID,
		"name":            agentID,
		"public_key":      publicKeyLine,
		"private_key_pem": privatePEM,
	}
	var result struct {
		KeyFingerprint string `json:"key_fingerprint"`
	}
	if err := makeRequest("POST", fmt.Sprintf("/api/projects/%s/agents/register", projectID), payload, &result); err != nil {
		return "", err
	}
	return result.KeyFingerprint, nil
}

func getAgentStatus(cfg *Config, projectID, agentID string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := makeRequest("GET", fmt.Sprintf("/api/projects/%s/agents/%s", projectID, agentID), nil, &result)
	return result, err
}

func pollAgentStatus(cfg *Config, projectID, agentID string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		result, err := getAgentStatus(cfg, projectID, agentID)
		if err == nil {
			if status, ok := result["status"].(string); ok {
				if status == "ACTIVE" {
					return status, nil
				}
				fmt.Printf("  ...status: %s\n", status)
			}
		}
		time.Sleep(2 * time.Second)
	}
	return "", fmt.Errorf("timed out waiting for agent %s to become ACTIVE", agentID)
}

// pairAndFetchToken drives the device-authorization pairing dance: request a
// code from the Gateway, approve it through apps/api (which enforces
// project EDITOR access — see handlePairAgent in apps/api/pairing.go, a Phase 1
// simplification of the browser-approval flow described in
// obsidian_memory/06.3), then poll the Gateway for the issued agent token.
func pairAndFetchToken(cfg *Config, projectID string) (string, error) {
	var deviceResp struct {
		DeviceCode      string `json:"device_code"`
		UserCode        string `json:"user_code"`
		ExpiresAt       string `json:"expires_at"`
		IntervalSeconds int    `json:"interval_seconds"`
	}
	if err := gatewayPostJSON(cfg, "/device/code", nil, &deviceResp); err != nil {
		return "", fmt.Errorf("request device code: %w", err)
	}

	if err := makeRequest("POST", fmt.Sprintf("/api/projects/%s/agents/pair", projectID),
		map[string]string{"user_code": deviceResp.UserCode}, nil); err != nil {
		return "", fmt.Errorf("approve pairing: %w", err)
	}

	interval := time.Duration(deviceResp.IntervalSeconds) * time.Second
	if interval <= 0 {
		interval = 5 * time.Second
	}
	deadline := time.Now().Add(2 * time.Minute)

	for time.Now().Before(deadline) {
		var tokenResp struct {
			AgentToken string `json:"agent_token"`
		}
		err := gatewayPostJSON(cfg, "/device/token", map[string]string{"device_code": deviceResp.DeviceCode}, &tokenResp)
		if err == nil && tokenResp.AgentToken != "" {
			return tokenResp.AgentToken, nil
		}
		time.Sleep(interval)
	}
	return "", fmt.Errorf("timed out waiting for pairing approval")
}

// gatewayPostJSON is a small unauthenticated POST helper for the Gateway's
// device-authorization endpoints — separate from makeRequest, which targets
// cfg.APIURL with a bearer token and isn't applicable here.
func gatewayPostJSON(cfg *Config, path string, payload interface{}, out interface{}) error {
	var body *bytes.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	} else {
		body = bytes.NewReader([]byte("{}"))
	}

	resp, err := http.Post(cfg.GatewayURL+path, "application/json", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("gateway request to %s failed with status %d", path, resp.StatusCode)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

// startAgentProcess launches `infracanvas sandbox agent-run` as a detached
// background process, handing it the agent token via an environment variable
// (not argv) so it never shows up in `ps`/process logs.
func startAgentProcess(cfg *Config, agentID, agentToken string) (int, error) {
	exePath, err := os.Executable()
	if err != nil {
		return 0, err
	}

	stateDir, err := sandboxStateDir()
	if err != nil {
		return 0, err
	}
	logFile, err := os.Create(filepath.Join(stateDir, agentID+".log"))
	if err != nil {
		return 0, err
	}

	cmd := exec.Command(exePath, "sandbox", "agent-run",
		"--agent-id="+agentID, "--gateway="+cfg.GatewayURL)
	cmd.Env = append(os.Environ(), "INFRACANVAS_AGENT_TOKEN="+agentToken)
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.Stdin = nil

	if err := cmd.Start(); err != nil {
		return 0, err
	}
	return cmd.Process.Pid, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return strings.ToLower(fmt.Sprintf("%x", b))
}
