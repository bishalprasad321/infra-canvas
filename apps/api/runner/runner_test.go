package runner

import "testing"

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
