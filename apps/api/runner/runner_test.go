package runner

import (
	"regexp"
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
