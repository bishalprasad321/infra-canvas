package importer

import (
	"encoding/json"
	"fmt"
)

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type NodeData struct {
	Label         string                 `json:"label"`
	Tech          string                 `json:"tech"`
	Icon          string                 `json:"icon"`
	CategoryLabel string                 `json:"categoryLabel"`
	Description   string                 `json:"description"`
	Status        string                 `json:"status"`
	StatusText    string                 `json:"statusText"`
	Parameters    map[string]interface{} `json:"parameters,omitempty"`
	IsCustom      bool                   `json:"isCustom"`
	RawCode       string                 `json:"rawCode"`
	CodeType      string                 `json:"codeType"`
	Environment   string                 `json:"environment,omitempty"`
	Region        string                 `json:"region,omitempty"`
	CredentialID  string                 `json:"credentialId,omitempty"`
	ProjectId     string                 `json:"projectId,omitempty"`
	GcpZone       string                 `json:"gcpZone,omitempty"`
}

type CanvasNode struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"`
	Position Position `json:"position"`
	Data     NodeData `json:"data"`
}

type CanvasEdge struct {
	ID        string                 `json:"id"`
	Source    string                 `json:"source"`
	Target    string                 `json:"target"`
	Animated  bool                   `json:"animated,omitempty"`
	MarkerEnd map[string]interface{} `json:"markerEnd,omitempty"`
}

type CanvasState struct {
	Nodes []CanvasNode `json:"nodes"`
	Edges []CanvasEdge `json:"edges"`
}

// ArrangeNodesAndMerge merges incoming parsed nodes into existing state and applies vertical phase rows grid layout
func ArrangeNodesAndMerge(existingJSON string, importedNodes []CanvasNode, importedEdges []CanvasEdge) (string, string, error) {
	var state CanvasState
	state.Nodes = []CanvasNode{}
	state.Edges = []CanvasEdge{}

	if existingJSON != "" && existingJSON != "{}" {
		var existing struct {
			Nodes []CanvasNode `json:"nodes"`
			Edges []CanvasEdge `json:"edges"`
		}
		if err := json.Unmarshal([]byte(existingJSON), &existing); err == nil {
			state.Nodes = existing.Nodes
			state.Edges = existing.Edges
		}
	}

	// Calculate base vertical row offsets based on existing node heights
	maxY := 0.0
	for _, n := range state.Nodes {
		if n.Position.Y > maxY {
			maxY = n.Position.Y
		}
	}

	yOffset := 0.0
	if len(state.Nodes) > 0 {
		yOffset = maxY + 300.0
	}

	tfCount := 0
	ansibleCount := 0
	k8sCount := 0

	for i := range importedNodes {
		node := &importedNodes[i]
		switch node.Data.Tech {
		case "Terraform":
			node.Position.X = 100 + float64(tfCount)*280
			node.Position.Y = yOffset + 50
			tfCount++
		case "Ansible":
			node.Position.X = 100 + float64(ansibleCount)*280
			node.Position.Y = yOffset + 300
			ansibleCount++
		case "Kubernetes":
			node.Position.X = 100 + float64(k8sCount)*280
			node.Position.Y = yOffset + 550
			k8sCount++
		default:
			node.Position.X = 100 + float64(tfCount)*280
			node.Position.Y = yOffset + 50
			tfCount++
		}
	}

	// Avoid duplicate node IDs by appending unique suffix if duplicate exists
	existingNodeMap := make(map[string]bool)
	for _, n := range state.Nodes {
		existingNodeMap[n.ID] = true
	}

	for i := range importedNodes {
		node := &importedNodes[i]
		origID := node.ID
		cnt := 1
		for existingNodeMap[node.ID] {
			node.ID = fmt.Sprintf("%s_%d", origID, cnt)
			cnt++
		}
		existingNodeMap[node.ID] = true

		// Re-target edges pointing to this node's updated ID
		if origID != node.ID {
			for eIdx := range importedEdges {
				if importedEdges[eIdx].Source == origID {
					importedEdges[eIdx].Source = node.ID
				}
				if importedEdges[eIdx].Target == origID {
					importedEdges[eIdx].Target = node.ID
				}
				importedEdges[eIdx].ID = fmt.Sprintf("e_%s_%s", importedEdges[eIdx].Source, importedEdges[eIdx].Target)
			}
		}
	}

	// Append lists
	state.Nodes = append(state.Nodes, importedNodes...)
	state.Edges = append(state.Edges, importedEdges...)

	nodesJSON, err := json.Marshal(state.Nodes)
	if err != nil {
		return "", "", err
	}
	edgesJSON, err := json.Marshal(state.Edges)
	if err != nil {
		return "", "", err
	}

	return string(nodesJSON), string(edgesJSON), nil
}
