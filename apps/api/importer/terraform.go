package importer

import (
	"fmt"
	"strings"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsyntax"
)

func ParseTerraform(hclCode string) ([]CanvasNode, []CanvasEdge, error) {
	file, diags := hclsyntax.ParseConfig([]byte(hclCode), "import.tf", hcl.InitialPos)
	if diags.HasErrors() {
		return nil, nil, fmt.Errorf("HCL parse error: %s", diags.Error())
	}

	body, ok := file.Body.(*hclsyntax.Body)
	if !ok {
		return nil, nil, fmt.Errorf("invalid HCL body structure")
	}

	var nodes []CanvasNode
	var edges []CanvasEdge

	// First pass: identify nodes
	for _, block := range body.Blocks {
		if block.Type == "resource" && len(block.Labels) >= 2 {
			resType := block.Labels[0]
			resName := block.Labels[1]
			nodeID := fmt.Sprintf("%s.%s", resType, resName)

			tech := "Terraform"
			icon := "devicon:terraform"
			categoryLabel := "Compute"
			desc := fmt.Sprintf("Provisioned %s resource: %s", resType, resName)
			params := make(map[string]interface{})

			switch resType {
			case "aws_instance":
				categoryLabel = "Compute"
				icon = "logos:aws-ec2"
				desc = "Virtual machine instances hosted inside Amazon Web Services EC2 infrastructure."
				params["instanceName"] = resName
				params["amiId"] = "ami-0c55b159cbfafe1f0"
				params["instanceType"] = "t2.micro"
				params["rootVolumeSize"] = 20

				if attr, ok := block.Body.Attributes["ami"]; ok {
					params["amiId"] = getAttrStringValue(attr)
				}
				if attr, ok := block.Body.Attributes["instance_type"]; ok {
					params["instanceType"] = getAttrStringValue(attr)
				}

			case "aws_security_group":
				categoryLabel = "Network"
				icon = "logos:aws"
				desc = "Security groups controlling inbound and outbound traffic rules."
				params["sgName"] = resName
				params["description"] = "AWS Security Group"
				params["allowedCidr"] = "0.0.0.0/0"
				params["sshEnabled"] = true
				params["httpPort"] = 80
				params["httpsPort"] = 443

				if attr, ok := block.Body.Attributes["name"]; ok {
					params["sgName"] = getAttrStringValue(attr)
				}
				if attr, ok := block.Body.Attributes["description"]; ok {
					params["description"] = getAttrStringValue(attr)
				}

			case "aws_s3_bucket":
				categoryLabel = "Storage"
				icon = "logos:aws-s3"
				desc = "Object storage bucket for static assets, backups, and user uploads."
				params["bucketName"] = resName
				params["forceDestroy"] = false
				params["versioningEnabled"] = true
				if attr, ok := block.Body.Attributes["bucket"]; ok {
					params["bucketName"] = getAttrStringValue(attr)
				}

			case "aws_db_instance":
				categoryLabel = "Database"
				icon = "logos:aws-rds"
				desc = "Relational database service instance running server-less postgres instances."
				params["dbName"] = resName
				params["allocatedStorage"] = 20
				params["instanceClass"] = "db.t3.micro"
				params["username"] = "admin"
				params["password"] = "dbpasswd123"
				params["engineVersion"] = "14.1"
				if attr, ok := block.Body.Attributes["db_name"]; ok {
					params["dbName"] = getAttrStringValue(attr)
				}

			case "aws_vpc":
				categoryLabel = "Network"
				icon = "logos:aws"
				desc = "Virtual Private Cloud network boundary workspace isolation."
				params["vpcName"] = resName
				params["cidrBlock"] = "10.0.0.0/16"
				params["enableDnsHostnames"] = true
				if attr, ok := block.Body.Attributes["cidr_block"]; ok {
					params["cidrBlock"] = getAttrStringValue(attr)
				}

			case "aws_subnet":
				categoryLabel = "Network"
				icon = "logos:aws"
				desc = "Subnet division configuration for AWS network VPC partitions."
				params["subnetName"] = resName
				params["vpcId"] = "aws_vpc.default.id"
				params["cidrBlock"] = "10.0.1.0/24"
				params["availabilityZone"] = "us-east-1a"
				params["mapPublicIp"] = true
				if attr, ok := block.Body.Attributes["cidr_block"]; ok {
					params["cidrBlock"] = getAttrStringValue(attr)
				}
				if attr, ok := block.Body.Attributes["availability_zone"]; ok {
					params["availabilityZone"] = getAttrStringValue(attr)
				}
			}

			nodes = append(nodes, CanvasNode{
				ID:   nodeID,
				Type: "customNode",
				Data: NodeData{
					Label:         resName,
					Tech:          tech,
					Icon:          icon,
					CategoryLabel: categoryLabel,
					Description:   desc,
					Status:        "Validated",
					StatusText:    "Imported",
					Parameters:    params,
				},
			})
		}
	}

	// Second pass: scan attributes for references to establish edges
	for _, block := range body.Blocks {
		if block.Type == "resource" && len(block.Labels) >= 2 {
			resType := block.Labels[0]
			resName := block.Labels[1]
			nodeID := fmt.Sprintf("%s.%s", resType, resName)

			for _, attr := range block.Body.Attributes {
				rng := attr.Expr.Range()
				exprStr := string(file.Bytes[rng.Start.Byte:rng.End.Byte])
				for _, targetNode := range nodes {
					if strings.Contains(exprStr, targetNode.ID) && targetNode.ID != nodeID {
						edges = append(edges, CanvasEdge{
							ID:        fmt.Sprintf("e_%s_%s", targetNode.ID, nodeID),
							Source:    targetNode.ID,
							Target:    nodeID,
							Animated:  false,
							MarkerEnd: map[string]interface{}{"type": "arrow"},
						})
					}
				}
			}
		}
	}

	return nodes, edges, nil
}

func getAttrStringValue(attr *hclsyntax.Attribute) string {
	val, ok := attr.Expr.(*hclsyntax.TemplateExpr)
	if ok && len(val.Parts) > 0 {
		lit, ok := val.Parts[0].(*hclsyntax.LiteralValueExpr)
		if ok {
			return fmt.Sprintf("%v", lit.Val.AsString())
		}
	}
	lit, ok := attr.Expr.(*hclsyntax.LiteralValueExpr)
	if ok && lit.Val.Type().IsPrimitiveType() {
		return fmt.Sprintf("%v", lit.Val.AsString())
	}
	return ""
}
