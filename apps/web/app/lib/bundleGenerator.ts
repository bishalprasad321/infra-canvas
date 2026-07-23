import { Node, Edge } from '@xyflow/react';
import { generateAnsibleYAML } from './exportYaml';
import { DEFAULT_INSTANCE_PARAMS, DEFAULT_SG_PARAMS } from './terraformDefaults';

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

export interface TerraformFiles {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
}

export function generateTerraformFiles(nodes: Node[]): TerraformFiles {
  const targetNode = nodes.find(n => (n.data as any)?.tech === 'Target');
  const awsRegion = ((targetNode?.data as any)?.region as string) || 'us-east-1';
  const environment = ((targetNode?.data as any)?.environment as string) || 'localstack';

  const providerBlock = environment === 'localstack'
    ? `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

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
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "infracanvas-state-bucket"
    key    = "terraform.tfstate"
    region = "${awsRegion}"
  }
}

provider "aws" {
  region = "${awsRegion}"
}`;

  const instanceNode = nodes.find(n => n.id.startsWith('aws_instance.web_server'));
  const parameters = (instanceNode?.data as any)?.parameters || DEFAULT_INSTANCE_PARAMS;
  const { instanceName = 'web_server', amiId = 'ami-785db401', instanceType = 't3.medium', subnetId = 'subnet-0123456789abcdef0', rootVolumeSize = 50, tags = [] } = parameters;

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
    : `"${subnetId}"`;

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
      const sgLink = hasSg
        ? `aws_security_group.${((tfNodes.find(n => n.id.startsWith('aws_security_group'))?.data) as any)?.parameters?.sgName || 'web_sg'}.id`
        : 'aws_security_group.web_sg.id';

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
      const allowedCidr = p.allowedCidr || '0.0.0.0/0';

      let ingressRules = '';
      if (p.httpPort !== undefined || p.httpsPort !== undefined) {
        const httpPort = p.httpPort ?? 80;
        const httpsPort = p.httpsPort ?? 443;
        const sshEnabled = p.sshEnabled !== false;

        ingressRules += `  ingress {
    from_port   = ${httpPort}
    to_port     = ${httpPort}
    protocol    = "tcp"
    cidr_blocks = ["${allowedCidr}"]
  }

  ingress {
    from_port   = ${httpsPort}
    to_port     = ${httpsPort}
    protocol    = "tcp"
    cidr_blocks = ["${allowedCidr}"]
  }`;

        if (sshEnabled) {
          ingressRules += `

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${allowedCidr}"]
  }`;
        }
      } else {
        const portsStr = p.ingressPorts || '80, 443, 22';
        const ports = portsStr.split(',').map((x: string) => x.trim()).filter((x: string) => x !== '' && !isNaN(Number(x)));
        ports.forEach((port: string) => {
          ingressRules += `  ingress {
    from_port   = ${port}
    to_port     = ${port}
    protocol    = "tcp"
    cidr_blocks = ["${allowedCidr}"]
  }\n\n`;
        });
      }

      tfResourcesBlock += `resource "aws_security_group" "${name}" {
  name        = "${name}"
  description = "${desc}"

${ingressRules}

  egress {
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
    const sgNodeLocal = nodes.find(n => n.id.startsWith('aws_security_group'));
    const sgParams = (sgNodeLocal?.data?.parameters as any) || DEFAULT_SG_PARAMS;
    const { sgName: sgNameParam = 'web_sg', httpPort = 80, httpsPort = 443, sshEnabled = true, allowedCidr = '0.0.0.0/0' } = sgParams;

    tfResourcesBlock += `resource "aws_security_group" "${sgNameParam}" {
  name        = "${sgNameParam}"
  description = "Allows HTTP/HTTPS inbound & SSH access"

  ingress {
    from_port   = ${httpPort}
    to_port     = ${httpPort}
    protocol    = "tcp"
    cidr_blocks = ["${allowedCidr}"]
  }

  ingress {
    from_port   = ${httpsPort}
    to_port     = ${httpsPort}
    protocol    = "tcp"
    cidr_blocks = ["${allowedCidr}"]
  }${sshEnabled ? `

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${allowedCidr}"]
  }` : ''}

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}\n\n`;
  }

  const mainTf = `# Generated by InfraFlow Visual Orchestration Platform
# Project: Project Alpha - Web-Server-Orchestration

${providerBlock}

${subnetBlock}

${tfResourcesBlock}`;

  const variablesTf = `# Input variables for Terraform deployment

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

  return { mainTf, variablesTf, outputsTf: outputsTfContent };
}

export async function downloadTerraformZip(nodes: Node[]): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const { mainTf, variablesTf, outputsTf } = generateTerraformFiles(nodes);
  const zip = new JSZip();
  zip.file('main.tf', mainTf);
  zip.file('variables.tf', variablesTf);
  zip.file('outputs.tf', outputsTf);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'terraform-config.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateBundleFiles(nodes: Node[], edges: Edge[]): FileItem[] {
  const hasTerraform = nodes.some(n => (n.data as any)?.tech === 'Terraform');
  const hasAnsible = nodes.some(n => (n.data as any)?.tech === 'Ansible');
  const hasKubernetes = nodes.some(n => (n.data as any)?.tech === 'Kubernetes');

  const countLines = (str: string) => str.split('\n').length;
  const getSizeKb = (str: string) => `${(str.length / 1024).toFixed(1)} KB`;

  const files: FileItem[] = [];

  if (hasTerraform) {
    const { mainTf, variablesTf, outputsTf } = generateTerraformFiles(nodes);
    files.push(
      { path: 'terraform/main.tf', name: 'main.tf', language: 'HCL', icon: 'lucide:file', iconColor: 'text-primary', lines: countLines(mainTf), size: getSizeKb(mainTf), content: mainTf },
      { path: 'terraform/variables.tf', name: 'variables.tf', language: 'HCL', icon: 'lucide:file', iconColor: 'text-muted-foreground', lines: countLines(variablesTf), size: getSizeKb(variablesTf), content: variablesTf },
      { path: 'terraform/outputs.tf', name: 'outputs.tf', language: 'HCL', icon: 'lucide:file', iconColor: 'text-muted-foreground', lines: countLines(outputsTf), size: getSizeKb(outputsTf), content: outputsTf },
    );
  }

  if (hasAnsible) {
    const instanceNode = nodes.find(n => n.id.startsWith('aws_instance.web_server'));
    const instanceName = ((instanceNode?.data as any)?.parameters || DEFAULT_INSTANCE_PARAMS).instanceName || 'web_server';
    const playbookYml = generateAnsibleYAML(nodes, edges);
    const colon = ':';
    const hostsIni = `[webservers]
web_server_1 ansible_host=aws_instance.${instanceName}.public_ip ansible_user=ubuntu

[all${colon}vars]
ansible_python_interpreter=/usr/bin/python3`;
    files.push(
      { path: 'ansible/playbook.yml', name: 'playbook.yml', language: 'YAML', icon: 'lucide:clipboard', iconColor: 'text-[#00A4FF]', lines: countLines(playbookYml), size: getSizeKb(playbookYml), content: playbookYml },
      { path: 'ansible/hosts.ini', name: 'hosts.ini', language: 'INI', icon: 'lucide:settings', iconColor: 'text-muted-foreground', lines: countLines(hostsIni), size: getSizeKb(hostsIni), content: hostsIni },
    );
  }

  if (hasKubernetes) {
    const k8sManifests: string[] = [];
    const k8sNodes = nodes.filter(n => (n.data as any)?.tech === 'Kubernetes');
    k8sNodes.forEach(node => {
      const id = node.id;
      const p = (node.data as any)?.parameters || {};

      if (id.startsWith('k8s_deployment')) {
        const name = p.deploymentName || 'app-deploy';
        const replicas = p.replicas || 3;
        const image = p.imageName || 'nginx:1.21';
        const port = p.containerPort || 80;
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
            memory: "${memory}"`);
      }
      else if (id.startsWith('k8s_service')) {
        const name = p.serviceName || 'app-service';
        const type = p.serviceType || 'ClusterIP';
        const port = p.port || 80;
        const targetPort = p.targetPort || 80;

        k8sManifests.push(`apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  type: ${type}
  ports:
  - port: ${port}
    targetPort: ${targetPort}
  selector:
    app: app-deploy`);
      }
      else if (id.startsWith('k8s_configmap')) {
        const name = p.configMapName || 'app-config';
        const key = p.dataKey || 'APP_ENV';
        const val = p.dataValue || 'production';

        k8sManifests.push(`apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
data:
  ${key}: "${val}"`);
      }
      else if (id.startsWith('k8s_secret')) {
        const name = p.secretName || 'app-secret';
        const key = p.secretKey || 'DB_PASSWORD';
        const val = p.secretValue || 'SecretString123';
        const base64Val = typeof window !== 'undefined' ? btoa(val) : Buffer.from(val).toString('base64');

        k8sManifests.push(`apiVersion: v1
kind: Secret
metadata:
  name: ${name}
type: Opaque
data:
  ${key}: "${base64Val}"`);
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
    files.push(
      { path: 'k8s/deployment.yaml', name: 'deployment.yaml', language: 'YAML', icon: 'lucide:layers', iconColor: 'text-[#326CE5]', lines: countLines(deploymentYamlContent), size: getSizeKb(deploymentYamlContent), content: deploymentYamlContent },
    );
  }

  const techList = [hasTerraform && 'Terraform', hasAnsible && 'Ansible', hasKubernetes && 'Kubernetes'].filter(Boolean).join(', ');
  const readmeContent = `# InfraFlow Generated Bundle

This bundle contains the generated infrastructure code for **Project Alpha - Web-Server-Orchestration**.

## Technologies
${techList || 'No technologies configured on canvas yet.'}

## Usage
${hasTerraform ? '1. Initialize and apply Terraform: `cd terraform && terraform init && terraform apply`\n' : ''}${hasAnsible ? '2. Run Ansible playbook: `cd ansible && ansible-playbook -i hosts.ini playbook.yml`\n' : ''}${hasKubernetes ? '3. Apply Kubernetes manifests: `kubectl apply -f k8s/`\n' : ''}`;

  files.push(
    { path: 'README.md', name: 'README.md', language: 'Markdown', icon: 'lucide:file', iconColor: 'text-muted-foreground', lines: countLines(readmeContent), size: getSizeKb(readmeContent), content: readmeContent },
  );

  return files;
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
