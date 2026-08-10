package importer

import (
	"testing"
)

func TestParseTerraform(t *testing.T) {
	hclCode := `
resource "aws_vpc" "my_vpc" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "my_subnet" {
  vpc_id            = aws_vpc.my_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"
}

resource "aws_instance" "my_ec2" {
  ami           = "ami-123456"
  instance_type = "t3.medium"
  subnet_id     = aws_subnet.my_subnet.id
}
`
	nodes, edges, err := ParseTerraform(hclCode)
	if err != nil {
		t.Fatalf("Failed to parse Terraform: %v", err)
	}

	if len(nodes) != 3 {
		t.Errorf("Expected 3 nodes, got %d", len(nodes))
	}

	if len(edges) != 2 {
		t.Errorf("Expected 2 edges, got %d", len(edges))
	}

	// Verify links
	vpcFound := false
	subnetFound := false
	ec2Found := false

	for _, n := range nodes {
		if n.ID == "aws_vpc.my_vpc" {
			vpcFound = true
			if n.Data.Parameters["cidrBlock"] != "10.0.0.0/16" {
				t.Errorf("VPC cidrBlock mismatch: got %v", n.Data.Parameters["cidrBlock"])
			}
		}
		if n.ID == "aws_subnet.my_subnet" {
			subnetFound = true
		}
		if n.ID == "aws_instance.my_ec2" {
			ec2Found = true
		}
	}

	if !vpcFound || !subnetFound || !ec2Found {
		t.Errorf("Missing expected resource nodes in parsed output")
	}
}

func TestParseAnsible(t *testing.T) {
	yamlCode := `
- name: Setup Nginx Webserver
  hosts: all
  become: yes
  tasks:
    - name: Install Nginx Web Server
      apt:
        name: nginx
        state: present

    - name: Copy Nginx Config
      copy:
        src: /tmp/nginx.conf
        dest: /etc/nginx/nginx.conf
        owner: www-data
        mode: "0644"
`
	nodes, edges, err := ParseAnsible(yamlCode)
	if err != nil {
		t.Fatalf("Failed to parse Ansible: %v", err)
	}

	if len(nodes) != 2 {
		t.Errorf("Expected 2 nodes, got %d", len(nodes))
	}

	if len(edges) != 1 {
		t.Errorf("Expected 1 edge, got %d", len(edges))
	}

	if nodes[0].ID != "apt_install_0" || nodes[1].ID != "file_copy_1" {
		t.Errorf("Nodes order or ID mapping incorrect: %+v", nodes)
	}
}

func TestParseKubernetes(t *testing.T) {
	yamlCode := `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: node:16
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
`
	nodes, edges, err := ParseKubernetes(yamlCode)
	if err != nil {
		t.Fatalf("Failed to parse Kubernetes: %v", err)
	}

	if len(nodes) != 2 {
		t.Errorf("Expected 2 nodes, got %d", len(nodes))
	}

	// Service selector link will edge from Deploy -> Service
	if len(edges) != 1 {
		t.Errorf("Expected 1 edge, got %d", len(edges))
	}
}
