package runner

import (
	"regexp"
	"testing"
)

func TestHydrateString(t *testing.T) {
	// Mock outputs
	tfOutputs := map[string]struct {
		Value interface{} `json:"value"`
	}{
		"aws_instance_web_server_public_ip": {Value: "54.210.89.12"},
		"aws_vpc_vpc_id":                    {Value: "vpc-012345"},
		"public_ip":                         {Value: "54.210.89.12"},
	}

	reExpr := regexp.MustCompile(`{{\s*(?:nodes\.)?([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\s*}}`)

	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "ansible_host={{ nodes.aws_instance_web_server.public_ip }} ansible_user=ubuntu",
			expected: "ansible_host=54.210.89.12 ansible_user=ubuntu",
		},
		{
			input:    "vpc_id = {{ aws_vpc.vpc_id }}",
			expected: "vpc_id = vpc-012345",
		},
		{
			input:    "no changes here",
			expected: "no changes here",
		},
	}

	for _, tc := range tests {
		result := reExpr.ReplaceAllStringFunc(tc.input, func(match string) string {
			sub := reExpr.FindStringSubmatch(match)
			if len(sub) < 3 {
				return match
			}
			nodeName, outputKey := sub[1], sub[2]
			keys := []string{
				nodeName + "_" + outputKey,
				nodeName + "." + outputKey,
				outputKey,
			}
			for _, key := range keys {
				if val, exists := tfOutputs[key]; exists {
					return val.Value.(string)
				}
			}
			return match
		})

		if result != tc.expected {
			t.Errorf("For input %q, expected %q, got %q", tc.input, tc.expected, result)
		}
	}
}
