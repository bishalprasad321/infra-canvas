package importer

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

func getK8sBaseName(name string) string {
	name = strings.ToLower(name)
	suffixes := []string{"-service", "-deployment", "-deploy", "-svc", "-config", "-secret", "-pvc"}
	for _, suffix := range suffixes {
		if strings.HasSuffix(name, suffix) {
			return strings.TrimSuffix(name, suffix)
		}
	}
	return name
}

func ParseKubernetes(yamlCode string) ([]CanvasNode, []CanvasEdge, error) {
	docs := strings.Split(yamlCode, "---")
	var nodes []CanvasNode
	var edges []CanvasEdge

	for idx, doc := range docs {
		doc = strings.TrimSpace(doc)
		if doc == "" {
			continue
		}

		var m map[string]interface{}
		err := yaml.Unmarshal([]byte(doc), &m)
		if err != nil {
			return nil, nil, fmt.Errorf("YAML document %d parse error: %w", idx, err)
		}

		kind, _ := m["kind"].(string)
		apiVersion, _ := m["apiVersion"].(string)
		if kind == "" || apiVersion == "" {
			continue
		}

		metadata, _ := m["metadata"].(map[string]interface{})
		name := ""
		if metadata != nil {
			name, _ = metadata["name"].(string)
		}
		if name == "" {
			name = fmt.Sprintf("k8s-%s-%d", strings.ToLower(kind), idx)
		}

		nodeID := fmt.Sprintf("k8s_%s.%s", strings.ToLower(kind), name)
		categoryLabel := "Container"
		icon := "logos:kubernetes"
		desc := fmt.Sprintf("Kubernetes %s resource named %s", kind, name)
		params := make(map[string]interface{})

		switch kind {
		case "Deployment":
			nodeID = fmt.Sprintf("k8s_deployment.%s", name)
			desc = "Deploys stateless application containers onto target clusters."
			params["deploymentName"] = name
			params["replicas"] = 1
			params["imageName"] = "nginx:alpine"
			params["containerPort"] = 80
			params["cpuLimit"] = "200m"
			params["memoryLimit"] = "256Mi"

			if spec, ok := m["spec"].(map[string]interface{}); ok {
				if reps, ok := spec["replicas"].(int); ok {
					params["replicas"] = reps
				}
				if template, ok := spec["template"].(map[string]interface{}); ok {
					if tSpec, ok := template["spec"].(map[string]interface{}); ok {
						if containers, ok := tSpec["containers"].([]interface{}); ok && len(containers) > 0 {
							if container, ok := containers[0].(map[string]interface{}); ok {
								if img, ok := container["image"].(string); ok {
									params["imageName"] = img
								}
								if ports, ok := container["ports"].([]interface{}); ok && len(ports) > 0 {
									if portMap, ok := ports[0].(map[string]interface{}); ok {
										if cp, ok := portMap["containerPort"].(int); ok {
											params["containerPort"] = cp
										}
									}
								}
							}
						}
					}
				}
			}

		case "Service":
			nodeID = fmt.Sprintf("k8s_service.%s", name)
			desc = "Exposes network ports for internal pods and external ingress entry points."
			params["serviceName"] = name
			params["serviceType"] = "ClusterIP"
			params["port"] = 80
			params["targetPort"] = 80

			if spec, ok := m["spec"].(map[string]interface{}); ok {
				if t, ok := spec["type"].(string); ok {
					params["serviceType"] = t
				}
				if ports, ok := spec["ports"].([]interface{}); ok && len(ports) > 0 {
					if portMap, ok := ports[0].(map[string]interface{}); ok {
						if p, ok := portMap["port"].(int); ok {
							params["port"] = p
						}
						if tp, ok := portMap["targetPort"].(int); ok {
							params["targetPort"] = tp
						}
					}
				}
			}

		case "ConfigMap":
			nodeID = fmt.Sprintf("k8s_configmap.%s", name)
			desc = "Stores key-value pair application configurations and environmental variables."
			params["configMapName"] = name
			params["dataKey"] = "APP_ENV"
			params["dataValue"] = "production"
			if data, ok := m["data"].(map[string]interface{}); ok {
				for k, v := range data {
					params["dataKey"] = k
					params["dataValue"] = fmt.Sprintf("%v", v)
					break
				}
			}

		case "Secret":
			nodeID = fmt.Sprintf("k8s_secret.%s", name)
			desc = "Maintains encrypted credentials, database secrets, and private key files."
			params["secretName"] = name
			params["secretKey"] = "DB_PASS"
			params["secretValue"] = "secret123"
			if data, ok := m["data"].(map[string]interface{}); ok {
				for k, v := range data {
					params["secretKey"] = k
					params["secretValue"] = fmt.Sprintf("%v", v)
					break
				}
			}

		case "Ingress":
			nodeID = fmt.Sprintf("k8s_ingress.%s", name)
			desc = "Routes public domain requests into specific interior service ports."
			params["ingressName"] = name
			params["host"] = "app.local"
			params["path"] = "/"
			params["serviceName"] = "app-service"
			params["servicePort"] = 80

		case "PersistentVolumeClaim":
			nodeID = fmt.Sprintf("k8s_pvc.%s", name)
			desc = "Allocates persistent disk volumes to support stateful application runs."
			params["pvcName"] = name
			params["storageSize"] = "10Gi"
			params["storageClass"] = "standard"
		}

		nodes = append(nodes, CanvasNode{
			ID:   nodeID,
			Type: "customNode",
			Data: NodeData{
				Label:         name,
				Tech:          "Kubernetes",
				Icon:          icon,
				CategoryLabel: categoryLabel,
				Description:   desc,
				Status:        "Validated",
				StatusText:    "Imported",
				Parameters:    params,
			},
		})
	}

	for _, src := range nodes {
		for _, dest := range nodes {
			if src.ID == dest.ID {
				continue
			}

			if strings.HasPrefix(src.ID, "k8s_service") && strings.HasPrefix(dest.ID, "k8s_deployment") {
				srcBase := getK8sBaseName(src.Data.Label)
				destBase := getK8sBaseName(dest.Data.Label)
				if srcBase == destBase || strings.Contains(src.Data.Label, dest.Data.Label) || strings.Contains(dest.Data.Label, src.Data.Label) {
					edges = append(edges, CanvasEdge{
						ID:        fmt.Sprintf("e_%s_%s", dest.ID, src.ID),
						Source:    dest.ID,
						Target:    src.ID,
						Animated:  false,
						MarkerEnd: map[string]interface{}{"type": "arrow"},
					})
				}
			}

			if strings.HasPrefix(src.ID, "k8s_ingress") && strings.HasPrefix(dest.ID, "k8s_service") {
				if src.Data.Parameters["serviceName"] == dest.Data.Parameters["serviceName"] || strings.Contains(src.Data.Label, dest.Data.Label) {
					edges = append(edges, CanvasEdge{
						ID:        fmt.Sprintf("e_%s_%s", dest.ID, src.ID),
						Source:    dest.ID,
						Target:    src.ID,
						Animated:  false,
						MarkerEnd: map[string]interface{}{"type": "arrow"},
					})
				}
			}

			if (strings.HasPrefix(src.ID, "k8s_configmap") || strings.HasPrefix(src.ID, "k8s_secret")) && strings.HasPrefix(dest.ID, "k8s_deployment") {
				if strings.Contains(dest.Data.Label, src.Data.Label) {
					edges = append(edges, CanvasEdge{
						ID:        fmt.Sprintf("e_%s_%s", src.ID, dest.ID),
						Source:    src.ID,
						Target:    dest.ID,
						Animated:  false,
						MarkerEnd: map[string]interface{}{"type": "arrow"},
					})
				}
			}
		}
	}

	return nodes, edges, nil
}
