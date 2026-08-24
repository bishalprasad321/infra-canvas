package runner

import (
	"regexp"
	"strings"
	"testing"
)

func TestExtractRepositoryConfig(t *testing.T) {
	tests := []struct {
		name       string
		canvasJSON string
		wantCfg    RepositoryConfig
	}{
		{
			name: "source node with repo url and branch",
			canvasJSON: `{
				"nodes": [
					{"id": "code_repository_1234", "data": {"tech": "Source", "repoUrl": "https://github.com/acme/demo.git", "branch": "develop"}}
				]
			}`,
			wantCfg: RepositoryConfig{Present: true, URL: "https://github.com/acme/demo.git", Branch: "develop"},
		},
		{
			name: "source node without a url configured yet",
			canvasJSON: `{
				"nodes": [
					{"id": "code_repository_1234", "data": {"tech": "Source"}}
				]
			}`,
			wantCfg: RepositoryConfig{Present: true, URL: "", Branch: ""},
		},
		{
			name: "no source node on canvas",
			canvasJSON: `{
				"nodes": [
					{"id": "aws_instance.web_server", "data": {"tech": "Terraform"}}
				]
			}`,
			wantCfg: RepositoryConfig{Present: false},
		},
		{
			name:       "invalid json does not panic",
			canvasJSON: `not json`,
			wantCfg:    RepositoryConfig{Present: false},
		},
		{
			name:       "empty canvas",
			canvasJSON: `{"nodes": []}`,
			wantCfg:    RepositoryConfig{Present: false},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractRepositoryConfig(tt.canvasJSON)
			if got != tt.wantCfg {
				t.Errorf("extractRepositoryConfig() = %+v, want %+v", got, tt.wantCfg)
			}
		})
	}
}

func TestIsSandboxTreatsMissingEnvironmentAsLocalStack(t *testing.T) {
	tests := []struct {
		name       string
		canvasJSON string
		want       bool
	}{
		{
			name: "aws_target with no environment field at all (freshly dropped node) is sandbox",
			canvasJSON: `{"nodes": [
				{"id": "aws_target_1", "data": {"tech": "Target"}}
			]}`,
			want: true,
		},
		{
			name: "aws_target with explicit environment=localstack is sandbox",
			canvasJSON: `{"nodes": [
				{"id": "aws_target_1", "data": {"tech": "Target", "environment": "localstack"}}
			]}`,
			want: true,
		},
		{
			name: "aws_target with explicit environment=aws is live, not sandbox",
			canvasJSON: `{"nodes": [
				{"id": "aws_target_1", "data": {"tech": "Target", "environment": "aws"}}
			]}`,
			want: false,
		},
		{
			name:       "no cloud target node at all (ansible-only canvas) is sandbox",
			canvasJSON: `{"nodes": [{"id": "open-port_1", "data": {"tech": "Ansible"}}]}`,
			want:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isSandbox(tt.canvasJSON); got != tt.want {
				t.Errorf("isSandbox() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSandboxHostsIPReplacement(t *testing.T) {
	re := regexp.MustCompile(`(?:aws_instance\.[a-zA-Z0-9_-]+\.public_ip|google_compute_instance\.[a-zA-Z0-9_-]+\.public_ip|azurerm_public_ip\.pip\.ip_address|{{\s*(?:nodes\.)?[a-zA-Z0-9_-]+\.public_ip\s*}})`)

	cases := []struct {
		input    string
		expected string
	}{
		{
			input:    "web_server_1 ansible_host=aws_instance.web_server.public_ip ansible_user=ubuntu",
			expected: "web_server_1 ansible_host=ubuntu_ssh_1 ansible_user=ubuntu",
		},
		{
			input:    "web_server_1 ansible_host=google_compute_instance.my_server.public_ip ansible_user=ubuntu",
			expected: "web_server_1 ansible_host=ubuntu_ssh_1 ansible_user=ubuntu",
		},
		{
			input:    "web_server_1 ansible_host=azurerm_public_ip.pip.ip_address ansible_user=azureuser",
			expected: "web_server_1 ansible_host=ubuntu_ssh_1 ansible_user=azureuser",
		},
		{
			input:    "web_server_1 ansible_host={{ nodes.aws_instance_web_server.public_ip }} ansible_user=ubuntu",
			expected: "web_server_1 ansible_host=ubuntu_ssh_1 ansible_user=ubuntu",
		},
		{
			input:    "web_server_1 ansible_host={{ aws_instance_web_server.public_ip }} ansible_user=ubuntu",
			expected: "web_server_1 ansible_host=ubuntu_ssh_1 ansible_user=ubuntu",
		},
	}

	for _, c := range cases {
		output := re.ReplaceAllString(c.input, "ubuntu_ssh_1")
		if output != c.expected {
			t.Errorf("For %q, expected %q, got %q", c.input, c.expected, output)
		}
	}
}

func TestLocalAgentHostsINI(t *testing.T) {
	got := localAgentHostsINI()
	if !strings.Contains(got, "ansible_host=agent-tunnel ansible_port=2222") {
		t.Errorf("localAgentHostsINI() = %q, want a placeholder agent-tunnel host entry", got)
	}
	if strings.Contains(got, "__COLON__") {
		t.Errorf("localAgentHostsINI() = %q, want __COLON__ placeholder fully substituted", got)
	}
}

func TestLocalAgentSSHCommonArgs(t *testing.T) {
	agentCtx := &AgentContext{AgentID: "agent-abc123", ProjectID: "proj_xyz789", GatewayURL: "https://gateway.example.com"}
	got := localAgentSSHCommonArgs(agentCtx)

	want := `-o StrictHostKeyChecking=no -o ProxyCommand="infracanvas sandbox proxy --agent-id=agent-abc123 --service=ssh:2222 --gateway=https://gateway.example.com --project=proj_xyz789"`
	if got != want {
		t.Errorf("localAgentSSHCommonArgs() = %q, want %q", got, want)
	}
}

func TestCLIHelperPathRespectsOverrideEnvVar(t *testing.T) {
	t.Setenv("INFRACANVAS_CLI_PATH", "")
	if got := cliHelperPath(); got != "infracanvas" {
		t.Errorf("cliHelperPath() with no override = %q, want %q", got, "infracanvas")
	}

	t.Setenv("INFRACANVAS_CLI_PATH", "/opt/infracanvas/bin/infracanvas")
	if got := cliHelperPath(); got != "/opt/infracanvas/bin/infracanvas" {
		t.Errorf("cliHelperPath() with override = %q, want %q", got, "/opt/infracanvas/bin/infracanvas")
	}
}
