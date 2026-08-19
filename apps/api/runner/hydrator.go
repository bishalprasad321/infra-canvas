package runner

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// HydrateDynamicParameters executes 'terraform output -json' in the tfSubdir under runDir,
// then replaces {{ nodes.node.output }} expressions inside configuration files in the runner directory.
func HydrateDynamicParameters(runDir string, tfSubdir string) error {
	tfDir := filepath.Join(runDir, tfSubdir)
	
	// 1. Run terraform output -json
	cmd := exec.Command("terraform", "output", "-json")
	cmd.Dir = tfDir
	outBytes, err := cmd.Output()
	if err != nil {
		// Non-fatal if no outputs exist or if Terraform hasn't run yet
		return nil
	}

	var tfOutputs map[string]struct {
		Value interface{} `json:"value"`
	}
	if err := json.Unmarshal(outBytes, &tfOutputs); err != nil {
		return fmt.Errorf("failed to parse terraform output json: %w", err)
	}

	// 2. Compile match regexes
	// Supports: {{ nodes.node_name.output_key }}, {{ node_name.output_key }}
	reExpr := regexp.MustCompile(`{{\s*(?:nodes\.)?([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\s*}}`)

	// 3. Walk runDir to find target files (.ini, .yml, .yaml, .json, .txt)
	err = filepath.WalkDir(runDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			// Skip hidden or build directories
			if d.Name() == ".terraform" || d.Name() == "terraform.tfstate.d" || d.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		// Process only config, script, template files
		ext := strings.ToLower(filepath.Ext(path))
		name := strings.ToLower(d.Name())
		if ext == ".ini" || ext == ".yml" || ext == ".yaml" || ext == ".json" || ext == ".txt" || name == "hosts.ini" {
			// Read contents
			contentBytes, fileErr := os.ReadFile(path)
			if fileErr != nil {
				return nil // skip unreadable files
			}

			content := string(contentBytes)
			original := content

			// Replace matching expressions
			content = reExpr.ReplaceAllStringFunc(content, func(match string) string {
				sub := reExpr.FindStringSubmatch(match)
				if len(sub) < 3 {
					return match
				}
				nodeName, outputKey := sub[1], sub[2]

				// Try combinations of lookup keys:
				// e.g. "aws_instance_web_server_public_ip", "aws_instance_web_server.public_ip", "public_ip"
				keys := []string{
					nodeName + "_" + outputKey,
					nodeName + "." + outputKey,
					outputKey,
				}

				for _, key := range keys {
					if val, exists := tfOutputs[key]; exists {
						return fmt.Sprintf("%v", val.Value)
					}
				}
				return match
			})

			// Write back only if changed
			if content != original {
				if writeErr := os.WriteFile(path, []byte(content), 0600); writeErr != nil {
					return writeErr
				}
			}
		}
		return nil
	})

	return err
}
