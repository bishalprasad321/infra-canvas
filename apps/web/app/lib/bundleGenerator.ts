import { Node, Edge } from '@xyflow/react';
import { generateAnsibleYAML } from './exportYaml';

export interface FileItem {
  path: string;
  name: string;
  language: string;
  icon: string;
  iconColor?: string;
  lines: number;
  size: string;
  content: string;
}

export function generateBundleFiles(nodes: Node[], edges: Edge[]): FileItem[] {
  // Find the AWS Target node to determine where this pipeline deploys to
  const targetNode = nodes.find(n => (n.data as any)?.tech === 'Target');
  const awsRegion = ((targetNode?.data as any)?.region as string) || 'us-east-1';
  const environment = ((targetNode?.data as any)?.environment as string) || 'localstack';

  // LocalStack needs endpoint overrides + dummy credentials; real AWS just needs a region.
  // The literal "http://localhost:4566" below is swapped for the in-Docker LocalStack
  // hostname by the Go runner (apps/api/runner/runner.go) when running in a container.
  const providerBlock = environment === 'localstack'
    ? `terraform {
  backend "s3" {
    bucket                      = "infracanvas-state-bucket"
    key                         = "terraform.tfstate"
    region                      = "${awsRegion}"
    endpoints                   = { s3 = "http://localhost:4566" }
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
  }
}

provider "aws" {
  region                      = "${awsRegion}"
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
}`
    : `terraform {
  backend "s3" {
    bucket = "infracanvas-state-bucket"
    key    = "terraform.tfstate"
    region = "${awsRegion}"
  }
}

provider "aws" {
  region = "${awsRegion}"
}`;

  // Find Terraform instance node if it exists on canvas to read parameters dynamically
  const instanceNode = nodes.find(n => n.id.startsWith('aws_instance.web_server'));

  const parameters = (instanceNode?.data as any)?.parameters || {
    instanceName: "web_server",
    amiId: "ami-785db401", // LocalStack's mocked EC2 only recognizes its own seeded AMIs
    instanceType: "t3.medium",
    subnetId: "subnet-0123456789abcdef0",
    rootVolumeSize: 50,
    tags: [
      { key: "Environment", value: "prod" },
      { key: "Role", value: "web" }
    ]
  };

  const { instanceName, amiId, instanceType, subnetId, rootVolumeSize, tags } = parameters;

  // LocalStack's default VPC/subnet IDs are randomly regenerated every time the container
  // restarts, so a hardcoded subnetId would only ever work until the next restart. Look the
  // default subnet up dynamically instead. Real AWS keeps using the node's configured subnetId.
  const subnetBlock = environment === 'localstack'
    ? `data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}`
    : '';
  const subnetIdExpr = environment === 'localstack'
    ? 'tolist(data.aws_subnets.default.ids)[0]'
    : `"${parameters.subnetId}"`;

  const tfNodes = nodes.filter(n => (n.data as any)?.tech === 'Terraform');
  let tfResourcesBlock = '';

  tfNodes.forEach(node => {
    const id = node.id;
    const p = (node.data as any)?.parameters || {};
    
    if (id.startsWith('aws_instance.web_server')) {
      const name = p.instanceName || 'web_server';
      const ami = p.amiId || 'ami-785db401';
      const type = p.instanceType || 't3.medium';
      const rootVolume = p.rootVolumeSize || 50;
      const tagsList = p.tags || [{ key: 'Environment', value: 'prod' }, { key: 'Role', value: 'web' }];
      const tagLines = tagsList.map((t: any) => `${t.key} = "${t.value}"`).join('\n    ');

      // Check if a custom security group exists to link it, else default to aws_security_group.web_sg.id
      const hasSg = tfNodes.some(n => n.id.startsWith('aws_security_group'));
      const sgLink = hasSg ? 'aws_security_group.web_sg.id' : 'aws_security_group.web_sg.id';

      tfResourcesBlock += `resource "aws_instance" "${name}" {
  ami           = "${ami}"
  instance_type = "${type}"
  subnet_id     = ${subnetIdExpr}

  vpc_security_group_ids = [${sgLink}]

  root_block_device {
    volume_size = ${rootVolume}
  }

  tags = {
    Name = "${name}"
    ${tagLines}
  }
}\n\n`;
    }
    else if (id.startsWith('aws_security_group')) {
      const name = p.sgName || 'web_sg';
      const desc = p.description || 'Allows HTTP/HTTPS inbound & SSH access';
      const portsStr = p.ingressPorts || '80, 443, 22';
      const ports = portsStr.split(',').map((x: string) => x.trim()).filter((x: string) => x !== '' && !isNaN(Number(x)));

      let ingressRules = '';
      ports.forEach((port: string) => {
        ingressRules += `  ingress {
    from_port   = ${port}
    to_port     = ${port}
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }\n\n`;
      });

      tfResourcesBlock += `resource "aws_security_group" "${name}" {
  name        = "${name}"
  description = "${desc}"

${ingressRules}  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}\n\n`;
    }
    else if (id.startsWith('aws_s3_bucket')) {
      const name = p.bucketName || 'infracanvas-user-bucket';
      const forceDestroy = p.forceDestroy !== false;
      const versioning = p.versioningEnabled !== false;

      tfResourcesBlock += `resource "aws_s3_bucket" "${name}" {
  bucket        = "${name}"
  force_destroy = ${forceDestroy}
}

resource "aws_s3_bucket_versioning" "${name}_versioning" {
  bucket = aws_s3_bucket.${name}.id
  versioning_configuration {
    status = "${versioning ? 'Enabled' : 'Suspended'}"
  }
}\n\n`;
    }
    else if (id.startsWith('aws_db_instance')) {
      const name = p.dbName || 'appdb';
      const storage = p.allocatedStorage || 20;
      const instanceClass = p.instanceClass || 'db.t3.micro';
      const username = p.username || 'dbadmin';
      const password = p.password || 'SuperSecurePassword123!';
      const engineVersion = p.engineVersion || '14.1';

      tfResourcesBlock += `resource "aws_db_instance" "${name}" {
  allocated_storage   = ${storage}
  db_name             = "${name}"
  engine              = "postgres"
  engine_version      = "${engineVersion}"
  instance_class      = "${instanceClass}"
  username            = "${username}"
  password            = "${password}"
  skip_final_snapshot = true
}\n\n`;
    }
    else if (id.startsWith('aws_vpc')) {
      const name = p.vpcName || 'app_vpc';
      const cidr = p.cidrBlock || '10.0.0.0/16';
      const dns = p.enableDnsHostnames !== false;

      tfResourcesBlock += `resource "aws_vpc" "${name}" {
  cidr_block           = "${cidr}"
  enable_dns_hostnames = ${dns}
  tags = {
    Name = "${name}"
  }
}\n\n`;
    }
    else if (id.startsWith('aws_subnet')) {
      const name = p.subnetName || 'app_subnet_1a';
      const vpc = p.vpcId || 'aws_vpc.app_vpc.id';
      const cidr = p.cidrBlock || '10.0.1.0/24';
      const az = p.availabilityZone || 'us-east-1a';
      const mapPublic = p.mapPublicIp !== false;

      tfResourcesBlock += `resource "aws_subnet" "${name}" {
  vpc_id                  = ${vpc}
  cidr_block              = "${cidr}"
  availability_zone       = "${az}"
  map_public_ip_on_launch = ${mapPublic}
  tags = {
    Name = "${name}"
  }
}\n\n`;
    }
  });

  // If EC2 exists but no Security Group node is present, append default web_sg
  const hasEc2Node = tfNodes.some(n => n.id.startsWith('aws_instance.web_server'));
  const hasSgNode = tfNodes.some(n => n.id.startsWith('aws_security_group'));
  if (hasEc2Node && !hasSgNode) {
    tfResourcesBlock += `resource "aws_security_group" "web_sg" {
  name        = "web_sg"
  description = "Allows HTTP/HTTPS inbound & SSH access"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}\n\n`;
  }

  const mainTfContent = `# Generated by InfraFlow Visual Orchestration Platform
# Project: Project Alpha - Web-Server-Orchestration

${providerBlock}

${subnetBlock}

${tfResourcesBlock}`;

  // 2. Generate variables.tf
  const variablesTfContent = `# Input variables for Terraform deployment

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Target AWS region for deployment"
}

variable "instance_type" {
  type        = string
  default     = "${instanceType}"
  description = "EC2 instance size"
}`;

  // 3. Generate outputs.tf dynamically
  let outputsTfContent = `# Output values to retrieve after deployment\n\n`;
  tfNodes.forEach(node => {
    const id = node.id;
    const p = (node.data as any)?.parameters || {};
    if (id.startsWith('aws_instance.web_server')) {
      const name = p.instanceName || 'web_server';
      outputsTfContent += `output "${name}_public_ip" {
  value       = aws_instance.${name}.public_ip
  description = "Public IP address of the virtual machine"
}\n\n`;
    }
    else if (id.startsWith('aws_s3_bucket')) {
      const name = p.bucketName || 'infracanvas-user-bucket';
      outputsTfContent += `output "${name}_bucket_arn" {
  value       = aws_s3_bucket.${name}.arn
  description = "ARN of the S3 bucket"
}\n\n`;
    }
    else if (id.startsWith('aws_db_instance')) {
      const name = p.dbName || 'appdb';
      outputsTfContent += `output "${name}_endpoint" {
  value       = aws_db_instance.${name}.endpoint
  description = "Endpoint of the database instance"
}\n\n`;
    }
  });

  if (outputsTfContent.trim() === '# Output values to retrieve after deployment') {
    outputsTfContent += `output "web_server_public_ip" {
  value       = aws_instance.${instanceName}.public_ip
  description = "Public IP address of the web server"
}`;
  }

  // 4. Generate playbook.yml (dynamic Ansible playbook)
  const playbookYmlContent = generateAnsibleYAML(nodes, edges);

  // 5. Generate hosts.ini
  const colon = ':';
  const hostsIniContent = `[webservers]
web_server_1 ansible_host=aws_instance.${instanceName}.public_ip ansible_user=ubuntu

[all${colon}vars]
ansible_python_interpreter=/usr/bin/python3`;

  const k8sNodes = nodes.filter(n => (n.data as any)?.tech === 'Kubernetes');
  let k8sManifests: string[] = [];

  k8sNodes.forEach(node => {
    const id = node.id;
    const p = (node.data as any)?.parameters || {};
    
    if (id.startsWith('k8s_deployment')) {
      const name = p.deploymentName || 'app-deploy';
      const replicas = p.replicas || 3;
      const port = p.containerPort || 80;
      const image = p.imageName || 'nginx:1.21';
      const cpu = p.cpuLimit || '500m';
      const memory = p.memoryLimit || '512Mi';

      k8sManifests.push(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  labels:
    app: ${name}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: container
        image: ${image}
        ports:
        - containerPort: ${port}
        resources:
          limits:
            cpu: "${cpu}"
            memory: "${memory}"
          requests:
            cpu: "100m"
            memory: "128Mi"`);
    }
    else if (id.startsWith('k8s_service')) {
      const name = p.serviceName || 'app-service';
      const type = p.serviceType || 'ClusterIP';
      const port = p.port || 80;
      const targetPort = p.targetPort || 80;

      const linkedDeployment = k8sNodes.find(n => n.id.startsWith('k8s_deployment'));
      const selectorLabel = linkedDeployment ? ((linkedDeployment.data as any)?.parameters?.deploymentName || 'app-deploy') : 'app-deploy';

      k8sManifests.push(`apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  type: ${type}
  selector:
    app: ${selectorLabel}
  ports:
  - port: ${port}
    targetPort: ${targetPort}`);
    }
    else if (id.startsWith('k8s_configmap')) {
      const name = p.configMapName || 'app-config';
      const key = p.dataKey || 'APP_ENV';
      const value = p.dataValue || 'production';

      k8sManifests.push(`apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
data:
  ${key}: "${value}"`);
    }
    else if (id.startsWith('k8s_secret')) {
      const name = p.secretName || 'app-secret';
      const key = p.secretKey || 'DB_PASSWORD';
      const value = p.secretValue || 'SecretString123';
      const base64Value = typeof window !== 'undefined' ? btoa(value) : Buffer.from(value).toString('base64');

      k8sManifests.push(`apiVersion: v1
kind: Secret
metadata:
  name: ${name}
type: Opaque
data:
  ${key}: "${base64Value}"`);
    }
    else if (id.startsWith('k8s_ingress')) {
      const name = p.ingressName || 'app-ingress';
      const host = p.host || 'app.local';
      const path = p.path || '/';
      const svcName = p.serviceName || 'app-service';
      const svcPort = p.servicePort || 80;

      k8sManifests.push(`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: ${host}
    http:
      paths:
      - path: ${path}
        pathType: Prefix
        backend:
          service:
            name: ${svcName}
            port:
              number: ${svcPort}`);
    }
    else if (id.startsWith('k8s_pvc')) {
      const name = p.pvcName || 'app-pvc';
      const size = p.storageSize || '10Gi';
      const storageClass = p.storageClass || 'standard';

      k8sManifests.push(`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${name}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: ${size}
  storageClassName: ${storageClass}`);
    }
  });

  if (k8sManifests.length === 0) {
    k8sManifests.push(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-server-deployment
  labels:
    app: web-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-server
  template:
    metadata:
      labels:
        app: web-server
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80`);
  }

  const deploymentYamlContent = k8sManifests.join('\n---\n');

  // 7. Generate README.md
  const readmeContent = `# InfraFlow Generated Bundle

This bundle contains the generated infrastructure code for **Project Alpha - Web-Server-Orchestration**.

## Structure
- \`terraform/\`: Infrastructure provisioning scripts
- \`ansible/\`: Configuration management playbooks
- \`k8s/\`: Kubernetes deployment manifests

## Usage
1. Initialize and apply Terraform: \`cd terraform && terraform init && terraform apply\`
2. Run Ansible playbook: \`cd ansible && ansible-playbook -i hosts.ini playbook.yml\``;

  const countLines = (str: string) => str.split('\n').length;
  const getSizeKb = (str: string) => `${(str.length / 1024).toFixed(1)} KB`;

  return [
    {
      path: 'terraform/main.tf',
      name: 'main.tf',
      language: 'HCL',
      icon: 'lucide:file',
      iconColor: 'text-primary',
      lines: countLines(mainTfContent),
      size: getSizeKb(mainTfContent),
      content: mainTfContent
    },
    {
      path: 'terraform/variables.tf',
      name: 'variables.tf',
      language: 'HCL',
      icon: 'lucide:file',
      iconColor: 'text-muted-foreground',
      lines: countLines(variablesTfContent),
      size: getSizeKb(variablesTfContent),
      content: variablesTfContent
    },
    {
      path: 'terraform/outputs.tf',
      name: 'outputs.tf',
      language: 'HCL',
      icon: 'lucide:file',
      iconColor: 'text-muted-foreground',
      lines: countLines(outputsTfContent),
      size: getSizeKb(outputsTfContent),
      content: outputsTfContent
    },
    {
      path: 'ansible/playbook.yml',
      name: 'playbook.yml',
      language: 'YAML',
      icon: 'lucide:clipboard',
      iconColor: 'text-[#00A4FF]',
      lines: countLines(playbookYmlContent),
      size: getSizeKb(playbookYmlContent),
      content: playbookYmlContent
    },
    {
      path: 'ansible/hosts.ini',
      name: 'hosts.ini',
      language: 'INI',
      icon: 'lucide:settings',
      iconColor: 'text-muted-foreground',
      lines: countLines(hostsIniContent),
      size: getSizeKb(hostsIniContent),
      content: hostsIniContent
    },
    {
      path: 'k8s/deployment.yaml',
      name: 'deployment.yaml',
      language: 'YAML',
      icon: 'lucide:layers',
      iconColor: 'text-[#326CE5]',
      lines: countLines(deploymentYamlContent),
      size: getSizeKb(deploymentYamlContent),
      content: deploymentYamlContent
    },
    {
      path: 'README.md',
      name: 'README.md',
      language: 'Markdown',
      icon: 'lucide:file',
      iconColor: 'text-muted-foreground',
      lines: countLines(readmeContent),
      size: getSizeKb(readmeContent),
      content: readmeContent
    }
  ];
}

export async function downloadZipBundle(nodes: Node[], edges: Edge[]): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const files = generateBundleFiles(nodes, edges);
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'infraflow-bundle.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
