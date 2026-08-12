package importer

import (
	"fmt"
	"strings"
)

type FileItem struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func CompileCanvas(nodes []CanvasNode, edges []CanvasEdge) ([]FileItem, error) {
	var files []FileItem

	hasTerraform := false
	hasAnsible := false
	hasK8s := false

	for _, n := range nodes {
		if n.Data.Tech == "Terraform" {
			hasTerraform = true
		} else if n.Data.Tech == "Ansible" {
			hasAnsible = true
		} else if n.Data.Tech == "Kubernetes" {
			hasK8s = true
		}
	}

	if hasTerraform {
		// Detect AWS target settings
		isLiveAWS := false
		awsRegion := "us-east-1"
		for _, n := range nodes {
			if strings.HasPrefix(n.ID, "aws_target") {
				if n.Data.Environment == "aws" {
					isLiveAWS = true
				}
				if n.Data.Region != "" {
					awsRegion = n.Data.Region
				}
				break
			}
		}

		var mainTf string
		if isLiveAWS {
			mainTf = fmt.Sprintf(`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "%s"
}
`, awsRegion)
		} else {
			mainTf = fmt.Sprintf(`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket                      = "infracanvas-state-bucket"
    key                         = "terraform.tfstate"
    region                      = "us-east-1"
    endpoints                   = { s3 = "http://localhost:4566" }
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
  }
}

provider "aws" {
  region                      = "%s"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    ec2 = "http://localhost:4566"
    s3  = "http://localhost:4566"
  }
}
`, awsRegion, awsRegion)
		}

		mainTf += `
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}
`

		var resources strings.Builder
		for _, n := range nodes {
			if n.Data.Tech != "Terraform" {
				continue
			}

			p := n.Data.Parameters
			if p == nil {
				p = make(map[string]interface{})
			}

			if n.Data.IsCustom {
				customCode := n.Data.RawCode
				for k, v := range p {
					escapedVal := fmt.Sprintf("%v", v)
					if _, ok := v.(string); ok {
						escapedVal = fmt.Sprintf("\"%v\"", v)
					}
					customCode = strings.ReplaceAll(customCode, "var."+k, escapedVal)
				}
				resources.WriteString(fmt.Sprintf("\n# Custom block: %s\n%s\n", n.Data.Label, customCode))
				continue
			}

			id := n.ID
			if strings.HasPrefix(id, "aws_instance") {
				name := getStringParam(p, "instanceName", n.Data.Label)
				ami := getStringParam(p, "amiId", "ami-0c55b159cbfafe1f0")
				instType := getStringParam(p, "instanceType", "t2.micro")
				volSize := getIntParam(p, "rootVolumeSize", 20)

				resources.WriteString(fmt.Sprintf(`
resource "aws_instance" "%s" {
  ami           = "%s"
  instance_type = "%s"
  subnet_id     = tolist(data.aws_subnets.default.ids)[0]

  root_block_device {
    volume_size = %d
  }

  tags = {
    Name = "%s"
  }
}
`, name, ami, instType, volSize, name))

			} else if strings.HasPrefix(id, "aws_security_group") {
				name := getStringParam(p, "sgName", n.Data.Label)
				desc := getStringParam(p, "description", "Allows HTTP/HTTPS inbound & SSH access")
				allowedCidr := getStringParam(p, "allowedCidr", "0.0.0.0/0")
				httpPort := getIntParam(p, "httpPort", 80)
				httpsPort := getIntParam(p, "httpsPort", 443)

				resources.WriteString(fmt.Sprintf(`
resource "aws_security_group" "%s" {
  name        = "%s"
  description = "%s"

  ingress {
    from_port   = %d
    to_port     = %d
    protocol    = "tcp"
    cidr_blocks = ["%s"]
  }

  ingress {
    from_port   = %d
    to_port     = %d
    protocol    = "tcp"
    cidr_blocks = ["%s"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`, name, name, desc, httpPort, httpPort, allowedCidr, httpsPort, httpsPort, allowedCidr))

			} else if strings.HasPrefix(id, "aws_s3_bucket") {
				name := getStringParam(p, "bucketName", n.Data.Label)
				resources.WriteString(fmt.Sprintf(`
resource "aws_s3_bucket" "%s" {
  bucket        = "%s"
  force_destroy = true
}
`, name, name))

			} else if strings.HasPrefix(id, "aws_db_instance") {
				name := getStringParam(p, "dbName", n.Data.Label)
				storage := getIntParam(p, "allocatedStorage", 20)
				class := getStringParam(p, "instanceClass", "db.t3.micro")
				user := getStringParam(p, "username", "admin")
				pass := getStringParam(p, "password", "dbpasswd123")
				ver := getStringParam(p, "engineVersion", "14.1")

				resources.WriteString(fmt.Sprintf(`
resource "aws_db_instance" "%s" {
  allocated_storage   = %d
  db_name             = "%s"
  engine              = "postgres"
  engine_version      = "%s"
  instance_class      = "%s"
  username            = "%s"
  password            = "%s"
  skip_final_snapshot = true
}
`, name, storage, name, ver, class, user, pass))

			} else if strings.HasPrefix(id, "aws_vpc") {
				name := getStringParam(p, "vpcName", n.Data.Label)
				cidr := getStringParam(p, "cidrBlock", "10.0.0.0/16")

				resources.WriteString(fmt.Sprintf(`
resource "aws_vpc" "%s" {
  cidr_block           = "%s"
  enable_dns_hostnames = true
  tags = {
    Name = "%s"
  }
}
`, name, cidr, name))

			} else if strings.HasPrefix(id, "aws_subnet") {
				name := getStringParam(p, "subnetName", n.Data.Label)
				cidr := getStringParam(p, "cidrBlock", "10.0.1.0/24")
				az := getStringParam(p, "availabilityZone", "us-east-1a")

				resources.WriteString(fmt.Sprintf(`
resource "aws_subnet" "%s" {
  vpc_id                  = data.aws_vpc.default.id
  cidr_block              = "%s"
  availability_zone       = "%s"
  map_public_ip_on_launch = true
  tags = {
    Name = "%s"
  }
}
`, name, cidr, az, name))
			}
		}

		files = append(files, FileItem{Path: "terraform/main.tf", Content: mainTf + resources.String()})
		files = append(files, FileItem{Path: "terraform/variables.tf", Content: "# No variables declared"})
		files = append(files, FileItem{Path: "terraform/outputs.tf", Content: `output "web_server_public_ip" {
  value = "127.0.0.1"
}`})
	}

	if hasAnsible {
		playbook := `---
- name: Automated Infrastructure Provisioning
  hosts: all
  become: yes
  tasks:
`
		var tasks strings.Builder
		for _, n := range nodes {
			if n.Data.Tech != "Ansible" {
				continue
			}

			p := n.Data.Parameters
			if p == nil {
				p = make(map[string]interface{})
			}

			if n.Data.IsCustom {
				customTasks := n.Data.RawCode
				lines := strings.Split(customTasks, "\n")
				for _, line := range lines {
					if strings.TrimSpace(line) != "" {
						tasks.WriteString("    " + line + "\n")
					}
				}
				continue
			}

			id := n.ID
			if strings.HasPrefix(id, "apt_install") {
				pkgs := getStringParam(p, "packages", "nginx, curl, git")
				pkgList := strings.Split(pkgs, ",")
				tasks.WriteString(fmt.Sprintf(`    - name: Install system packages
      ansible.builtin.apt:
        name:
`))
				for _, pkg := range pkgList {
					tasks.WriteString(fmt.Sprintf("          - %s\n", strings.TrimSpace(pkg)))
				}
				tasks.WriteString("        state: present\n\n")

			} else if strings.HasPrefix(id, "file_copy") {
				src := getStringParam(p, "srcPath", "/tmp/source")
				dest := getStringParam(p, "destPath", "/var/www/dest")
				owner := getStringParam(p, "owner", "www-data")
				mode := getStringParam(p, "mode", "0644")

				tasks.WriteString(fmt.Sprintf(`    - name: Copy file to target path
      ansible.builtin.copy:
        src: "%s"
        dest: "%s"
        owner: "%s"
        mode: "%s"

`, src, dest, owner, mode))

			} else if strings.HasPrefix(id, "open-port") {
				port := getStringParam(p, "port", "80")
				tasks.WriteString(fmt.Sprintf(`    - name: Open Port in UFW
      ansible.builtin.ufw:
        rule: allow
        port: "%s"
        proto: tcp

`, port))

			} else if strings.HasPrefix(id, "git_clone") {
				repo := getStringParam(p, "repoUrl", "")
				dest := getStringParam(p, "destPath", "")
				branch := getStringParam(p, "branch", "main")

				tasks.WriteString(fmt.Sprintf(`    - name: Clone repo
      ansible.builtin.git:
        repo: "%s"
        dest: "%s"
        version: "%s"
        clone: yes
        update: yes

`, repo, dest, branch))

			} else if strings.HasPrefix(id, "systemd_service") {
				name := getStringParam(p, "serviceName", "nginx")
				state := getStringParam(p, "state", "started")

				tasks.WriteString(fmt.Sprintf(`    - name: Manage service
      ansible.builtin.systemd:
        name: "%s"
        state: "%s"
        enabled: yes

`, name, state))
			}
		}

		files = append(files, FileItem{Path: "ansible/playbook.yml", Content: playbook + tasks.String()})
		files = append(files, FileItem{Path: "ansible/hosts.ini", Content: `[webservers]
web_server ansible_host=localhost ansible_port=2222 ansible_user=ubuntu
`})
	}

	if hasK8s {
		var manifests strings.Builder
		for idx, n := range nodes {
			if n.Data.Tech != "Kubernetes" {
				continue
			}

			p := n.Data.Parameters
			if p == nil {
				p = make(map[string]interface{})
			}

			if idx > 0 {
				manifests.WriteString("\n---\n")
			}

			if n.Data.IsCustom {
				manifests.WriteString(n.Data.RawCode)
				continue
			}

			id := n.ID
			if strings.HasPrefix(id, "k8s_deployment") {
				name := getStringParam(p, "deploymentName", n.Data.Label)
				reps := getIntParam(p, "replicas", 1)
				img := getStringParam(p, "imageName", "nginx:alpine")
				port := getIntParam(p, "containerPort", 80)

				manifests.WriteString(fmt.Sprintf(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: %s
spec:
  replicas: %d
  selector:
    matchLabels:
      app: %s
  template:
    metadata:
      labels:
        app: %s
    spec:
      containers:
      - name: app
        image: %s
        ports:
        - containerPort: %d
`, name, reps, name, name, img, port))

			} else if strings.HasPrefix(id, "k8s_service") {
				name := getStringParam(p, "serviceName", n.Data.Label)
				t := getStringParam(p, "serviceType", "ClusterIP")
				port := getIntParam(p, "port", 80)
				targetPort := getIntParam(p, "targetPort", 80)

				manifests.WriteString(fmt.Sprintf(`apiVersion: v1
kind: Service
metadata:
  name: %s
spec:
  type: %s
  ports:
  - port: %d
    targetPort: %d
  selector:
    app: %s
`, name, t, port, targetPort, name))

			} else if strings.HasPrefix(id, "k8s_configmap") {
				name := getStringParam(p, "configMapName", n.Data.Label)
				key := getStringParam(p, "dataKey", "APP_ENV")
				val := getStringParam(p, "dataValue", "production")

				manifests.WriteString(fmt.Sprintf(`apiVersion: v1
kind: ConfigMap
metadata:
  name: %s
data:
  %s: "%s"
`, name, key, val))

			} else if strings.HasPrefix(id, "k8s_secret") {
				name := getStringParam(p, "secretName", n.Data.Label)
				key := getStringParam(p, "secretKey", "DB_PASS")
				val := getStringParam(p, "secretValue", "secret123")

				manifests.WriteString(fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: %s
type: Opaque
data:
  %s: "%s"
`, name, key, val))
			}
		}

		files = append(files, FileItem{Path: "k8s/deployment.yaml", Content: manifests.String()})
	}

	return files, nil
}

func getStringParam(p map[string]interface{}, key string, def string) string {
	if val, ok := p[key]; ok {
		if s, ok := val.(string); ok && s != "" {
			return s
		}
	}
	return def
}

func getIntParam(p map[string]interface{}, key string, def int) int {
	if val, ok := p[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case float64:
			return int(v)
		}
	}
	return def
}
