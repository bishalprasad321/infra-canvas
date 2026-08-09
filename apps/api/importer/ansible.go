package importer

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

func ParseAnsible(yamlCode string) ([]CanvasNode, []CanvasEdge, error) {
	var root yaml.Node
	err := yaml.Unmarshal([]byte(yamlCode), &root)
	if err != nil {
		return nil, nil, fmt.Errorf("YAML parse error: %w", err)
	}

	var tasks []map[string]interface{}
	var topNode *yaml.Node
	if root.Kind == yaml.DocumentNode && len(root.Content) > 0 {
		topNode = root.Content[0]
	} else {
		topNode = &root
	}

	if topNode.Kind == yaml.SequenceNode {
		for _, item := range topNode.Content {
			if item.Kind == yaml.MappingNode {
				var m map[string]interface{}
				if err := item.Decode(&m); err == nil {
					if tasksVal, ok := m["tasks"]; ok {
						if taskList, ok := tasksVal.([]interface{}); ok {
							for _, tVal := range taskList {
								if tMap, ok := tVal.(map[string]interface{}); ok {
									tasks = append(tasks, tMap)
								}
							}
						}
					} else {
						tasks = append(tasks, m)
					}
				}
			}
		}
	} else if topNode.Kind == yaml.MappingNode {
		var m map[string]interface{}
		if err := topNode.Decode(&m); err == nil {
			if tasksVal, ok := m["tasks"]; ok {
				if taskList, ok := tasksVal.([]interface{}); ok {
					for _, tVal := range taskList {
						if tMap, ok := tVal.(map[string]interface{}); ok {
							tasks = append(tasks, tMap)
						}
					}
				}
			} else {
				tasks = append(tasks, m)
			}
		}
	}

	if len(tasks) == 0 {
		return nil, nil, fmt.Errorf("no Ansible tasks found in YAML payload")
	}

	var nodes []CanvasNode
	var edges []CanvasEdge

	for idx, task := range tasks {
		taskName := ""
		if val, ok := task["name"].(string); ok {
			taskName = val
		} else {
			taskName = fmt.Sprintf("Ansible Task %d", idx+1)
		}

		nodeID := fmt.Sprintf("ansible_task_%d_%d", idx, strings.Count(taskName, " "))
		categoryLabel := "Configuration"
		icon := "devicon:ansible"
		desc := "Configures system resources and application parameters."
		params := make(map[string]interface{})

		for key, val := range task {
			if key == "name" || key == "hosts" || key == "become" || key == "tasks" || key == "when" || key == "register" || key == "ignore_errors" {
				continue
			}

			moduleName := key
			params["module"] = moduleName

			switch moduleName {
			case "ansible.builtin.apt", "apt":
				nodeID = fmt.Sprintf("apt_install_%d", idx)
				categoryLabel = "Configuration"
				desc = "Updates packages, registers apt repositories, and manages dependencies."
				params["packages"] = "nginx, curl, git"
				params["state"] = "present"
				if moduleMap, ok := val.(map[string]interface{}); ok {
					if nameVal, ok := moduleMap["name"]; ok {
						params["packages"] = fmt.Sprintf("%v", nameVal)
					}
					if stateVal, ok := moduleMap["state"]; ok {
						params["state"] = fmt.Sprintf("%v", stateVal)
					}
				}

			case "ansible.builtin.copy", "copy":
				nodeID = fmt.Sprintf("file_copy_%d", idx)
				categoryLabel = "Utility"
				desc = "Copies local files to target directories on provisioned hosts."
				params["srcPath"] = "/tmp/source"
				params["destPath"] = "/var/www/dest"
				params["owner"] = "www-data"
				params["mode"] = "0644"
				if moduleMap, ok := val.(map[string]interface{}); ok {
					if srcVal, ok := moduleMap["src"]; ok {
						params["srcPath"] = fmt.Sprintf("%v", srcVal)
					}
					if destVal, ok := moduleMap["dest"]; ok {
						params["destPath"] = fmt.Sprintf("%v", destVal)
					}
					if ownerVal, ok := moduleMap["owner"]; ok {
						params["owner"] = fmt.Sprintf("%v", ownerVal)
					}
					if modeVal, ok := moduleMap["mode"]; ok {
						params["mode"] = fmt.Sprintf("%v", modeVal)
					}
				}

			case "ansible.builtin.ufw", "ufw":
				nodeID = fmt.Sprintf("open-port_%d", idx)
				categoryLabel = "Security"
				desc = "Opens firewall ports to enable external client communication."
				params["port"] = "80"
				if moduleMap, ok := val.(map[string]interface{}); ok {
					if portVal, ok := moduleMap["port"]; ok {
						params["port"] = fmt.Sprintf("%v", portVal)
					}
				}

			case "ansible.builtin.git", "git":
				nodeID = fmt.Sprintf("git_clone_%d", idx)
				categoryLabel = "Application"
				desc = "Clones code repositories directly from GitHub/GitLab workspaces."
				params["repoUrl"] = "https://github.com/app/repo.git"
				params["destPath"] = "/var/www/html"
				params["branch"] = "main"
				if moduleMap, ok := val.(map[string]interface{}); ok {
					if repoVal, ok := moduleMap["repo"]; ok {
						params["repoUrl"] = fmt.Sprintf("%v", repoVal)
					}
					if destVal, ok := moduleMap["dest"]; ok {
						params["destPath"] = fmt.Sprintf("%v", destVal)
					}
					if versionVal, ok := moduleMap["version"]; ok {
						params["branch"] = fmt.Sprintf("%v", versionVal)
					}
				}

			case "ansible.builtin.systemd", "systemd":
				nodeID = fmt.Sprintf("systemd_service_%d", idx)
				categoryLabel = "System"
				desc = "Manages OS background services, state transitions, and boot settings."
				params["serviceName"] = "nginx"
				params["state"] = "started"
				params["enabled"] = true
				if moduleMap, ok := val.(map[string]interface{}); ok {
					if nameVal, ok := moduleMap["name"]; ok {
						params["serviceName"] = fmt.Sprintf("%v", nameVal)
					}
					if stateVal, ok := moduleMap["state"]; ok {
						params["state"] = fmt.Sprintf("%v", stateVal)
					}
					if enabledVal, ok := moduleMap["enabled"].(bool); ok {
						params["enabled"] = enabledVal
					}
				}
			}
			break
		}

		nodes = append(nodes, CanvasNode{
			ID:   nodeID,
			Type: "customNode",
			Data: NodeData{
				Label:         taskName,
				Tech:          "Ansible",
				Icon:          icon,
				CategoryLabel: categoryLabel,
				Description:   desc,
				Status:        "Validated",
				StatusText:    "Imported",
				Parameters:    params,
			},
		})

		if idx > 0 {
			prevNode := nodes[idx-1]
			edges = append(edges, CanvasEdge{
				ID:        fmt.Sprintf("e_%s_%s", prevNode.ID, nodeID),
				Source:    prevNode.ID,
				Target:    nodeID,
				Animated:  true,
				MarkerEnd: map[string]interface{}{"type": "arrow"},
			})
		}
	}

	return nodes, edges, nil
}
