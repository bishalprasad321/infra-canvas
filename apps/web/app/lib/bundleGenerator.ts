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

export function generateTerraformFiles(nodes: Node[], edges: Edge[] = []): TerraformFiles {
  // Collect all Target nodes present on the canvas
  let connectedTargets: Node[] = nodes.filter(n => (n.data as any)?.tech === 'Target' || n.id.startsWith('aws_target') || n.id.startsWith('gcp_target') || n.id.startsWith('azure_target'));

  // Default fallback if no target node exists on canvas
  if (connectedTargets.length === 0) {
    connectedTargets = [{
      id: 'aws_target_default',
      data: { tech: 'Target', environment: 'localstack', region: 'us-east-1' }
    } as any];
  }

  const hasAws = connectedTargets.some(t => t.id.startsWith('aws_target'));
  const hasGcp = connectedTargets.some(t => t.id.startsWith('gcp_target'));
  const hasAzure = connectedTargets.some(t => t.id.startsWith('azure_target'));

  let requiredProviders = '';
  let providers = '';

  if (hasAws) {
    const awsTarget = connectedTargets.find(t => t.id.startsWith('aws_target'));
    const awsRegion = ((awsTarget?.data as any)?.region as string) || 'us-east-1';
    const environment = ((awsTarget?.data as any)?.environment as string) || 'localstack';

    requiredProviders += `    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }\n`;

    if (environment === 'localstack') {
      providers += `provider "aws" {
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
}\n\n`;
    } else {
      providers += `provider "aws" {
  region = "${awsRegion}"
}\n\n`;
    }
  }

  if (hasGcp) {
    requiredProviders += `    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }\n`;

    providers += `provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}\n\n`;
  }

  if (hasAzure) {
    requiredProviders += `    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }\n`;

    providers += `provider "azurerm" {
  features {}
}\n\n`;
  }

  let providerBlock = `terraform {
  required_providers {
${requiredProviders}  }
`;

  const awsTarget = connectedTargets.find(t => t.id.startsWith('aws_target'));
  if (awsTarget && ((awsTarget?.data as any)?.environment as string) === 'localstack') {
    const awsRegion = ((awsTarget?.data as any)?.region as string) || 'us-east-1';
    providerBlock += `
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
`;
  }

  providerBlock += `}`;

  const tfNodes = nodes.filter(n => (n.data as any)?.tech === 'Terraform');
  let tfResourcesBlock = '';
  let subnetBlock = '';
  let variablesTf = '# Input variables for Terraform deployment\n\n';
  let outputsTfContent = '# Output values to retrieve after deployment\n\n';

  // Read AWS instance params if AWS is used
  let awsInstanceType = 't3.medium';
  const instanceNode = nodes.find(n => n.id.startsWith('aws_instance.web_server'));
  const p = (instanceNode?.data as any)?.parameters || {};
  if (p.instanceType) {
    awsInstanceType = p.instanceType;
  }

  if (hasAws) {
    variablesTf += `variable "aws_region" {
  type        = string
  default     = "${awsTarget && ((awsTarget?.data as any)?.region as string) || 'us-east-1'}"
  description = "Target AWS region for deployment"
}

variable "instance_type" {
  type        = string
  default     = "${awsInstanceType}"
  description = "EC2 instance size"
}\n\n`;
  }

  const dummySshKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAAgQC2R1m2hJc6eC+7737t8t8O1/Y2N5hDkK1aP4+rD2mZ6bJ9mF7C8F9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2m8B9eD0rC2= dummy-infracanvas-key";

  if (hasGcp) {
    const gcpTarget = connectedTargets.find(t => t.id.startsWith('gcp_target'));
    const gcpRegion = ((gcpTarget?.data as any)?.region as string) || 'us-central1';
    const gcpZone = ((gcpTarget?.data as any)?.gcpZone as string) || 'us-central1-a';
    const gcpProjectId = ((gcpTarget?.data as any)?.projectId as string) || 'infracanvas-prod-12345';

    variablesTf += `variable "gcp_project_id" {
  type    = string
  default = "${gcpProjectId}"
}

variable "gcp_region" {
  type    = string
  default = "${gcpRegion}"
}

variable "gcp_zone" {
  type    = string
  default = "${gcpZone}"
}

variable "gcp_ssh_pub_key" {
  type    = string
  default = "${dummySshKey}"
}\n\n`;
  }

  if (hasAzure) {
    variablesTf += `variable "azure_ssh_pub_key" {
  type    = string
  default = "${dummySshKey}"
}\n\n`;
  }

  tfNodes.forEach(node => {
    const id = node.id;
    const p = (node.data as any)?.parameters || {};

    if (id.startsWith('aws_instance.web_server')) {
      if (hasAws) {
        const name = p.instanceName || 'web_server';
        const ami = p.amiId || 'ami-785db401';
        const type = p.instanceType || 't3.medium';
        const rootVolume = p.rootVolumeSize || 50;
        const tagsList = p.tags || [{ key: 'Environment', value: 'prod' }, { key: 'Role', value: 'web' }];
        const tagLines = tagsList.map((t: any) => `${t.key} = "${t.value}"`).join('\n    ');

        const awsTargetNode = connectedTargets.find(t => t.id.startsWith('aws_target'));
        const awsEnv = ((awsTargetNode?.data as any)?.environment as string) || 'localstack';
        let subnetLine = '';
        if (p.subnetId) {
          subnetLine = `\n  subnet_id     = "${p.subnetId}"`;
        } else if (awsEnv === 'localstack') {
          subnetBlock = `data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}`;
          subnetLine = `\n  subnet_id     = tolist(data.aws_subnets.default.ids)[0]`;
        }

        const hasSg = tfNodes.some(n => n.id.startsWith('aws_security_group'));
        const sgLine = hasSg
          ? `\n  vpc_security_group_ids = [aws_security_group.${((tfNodes.find(n => n.id.startsWith('aws_security_group'))?.data) as any)?.parameters?.sgName || 'web_sg'}.id]`
          : '';

        tfResourcesBlock += `resource "aws_instance" "${name}" {
  ami           = "${ami}"
  instance_type = "${type}"${subnetLine}${sgLine}

  root_block_device {
    volume_size = ${rootVolume}
  }

  tags = {
    Name = "${name}"
    ${tagLines}
  }
}\n\n`;

        outputsTfContent += `output "${name}_public_ip" {
  value       = aws_instance.${name}.public_ip
  description = "Public IP address of the virtual machine"
}\n\n`;
      }

      if (hasGcp) {
        const instanceName = p.gcpInstanceName || p.instanceName || 'web-server';
        const machineType = p.gcpMachineType || 'e2-micro';
        const diskSizeGb = p.gcpDiskSize || p.rootVolumeSize || 50;
        const gcpImage = p.gcpImage || 'ubuntu-os-cloud/ubuntu-2204-lts';

        tfResourcesBlock += `resource "google_compute_network" "vpc_network" {
  name                    = "infracanvas-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "infracanvas-subnet"
  ip_cidr_range = "10.10.1.0/24"
  region        = var.gcp_region
  network       = google_compute_network.vpc_network.id
}

resource "google_compute_instance" "vm_instance" {
  name         = "${instanceName}"
  machine_type = "${machineType}"
  zone         = var.gcp_zone

  boot_disk {
    initialize_params {
      image = "${gcpImage}"
      size  = ${diskSizeGb}
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      // Ephemeral public IP for SSH access
    }
  }

  metadata = {
    ssh-keys = "ubuntu:\${var.gcp_ssh_pub_key}"
  }
}\n\n`;

        outputsTfContent += `output "gcp_instance_public_ip" {
  value       = google_compute_instance.vm_instance.network_interface.0.access_config.0.nat_ip
  description = "The public IP of the GCP VM instance"
}\n\n`;
      }

      if (hasAzure) {
        const vmName = p.azureVmName || p.instanceName || 'web-vm';
        const vmSize = p.azureVmSize || 'Standard_B1s';
        const diskSizeGb = p.azureDiskSize || p.rootVolumeSize || 50;
        const publisher = p.azurePublisher || 'Canonical';
        const offer = p.azureOffer || 'UbuntuServer';
        const sku = p.azureSku || '18.04-LTS';

        tfResourcesBlock += `resource "azurerm_resource_group" "rg" {
  name     = "infracanvas-rg"
  location = "East US"
}

resource "azurerm_virtual_network" "vnet" {
  name                = "infracanvas-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "subnet" {
  name                 = "infracanvas-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_public_ip" "pip" {
  name                = "${vmName}-pip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Dynamic"
}

resource "azurerm_network_interface" "nic" {
  name                = "${vmName}-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.pip.id
  }
}

resource "azurerm_linux_virtual_machine" "vm" {
  name                = "${vmName}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = "${vmSize}"
  admin_username      = "azureuser"
  network_interface_ids = [
    azurerm_network_interface.nic.id,
  ]

  admin_ssh_key {
    username   = "azureuser"
    public_key = var.azure_ssh_pub_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = ${diskSizeGb}
  }

  source_image_reference {
    publisher = "${publisher}"
    offer     = "${offer}"
    sku       = "${sku}"
    version   = "latest"
  }
}
\n\n`;

        outputsTfContent += `output "azure_instance_public_ip" {
  value       = azurerm_public_ip.pip.ip_address
  description = "The public IP of the Azure VM instance"
}\n\n`;
      }
    }
    else if (id.startsWith('aws_security_group') && hasAws) {
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
    else if (id.startsWith('aws_s3_bucket') && hasAws) {
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
    else if (id.startsWith('aws_db_instance') && hasAws) {
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
    else if (id.startsWith('aws_vpc') && hasAws) {
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
    else if (id.startsWith('aws_subnet') && hasAws) {
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
    else if ((node.data as any)?.isCustom && (node.data as any)?.tech === 'Terraform') {
      let customCode = (node.data as any).rawCode || '';
      const params = (node.data as any).parameters || {};
      Object.keys(params).forEach(key => {
        customCode = customCode.replace(new RegExp(`var\\.${key}`, 'g'), `"${params[key]}"`);
      });
      tfResourcesBlock += `# Custom Node: ${node.data?.label || id}\n${customCode}\n\n`;
    }
  });

  const mainTf = `# Generated by InfraFlow Visual Orchestration Platform
# Project: Project Alpha - Web-Server-Orchestration

${providerBlock}

${providers}

${subnetBlock}

${tfResourcesBlock}`;

  tfNodes.forEach(node => {
    const id = node.id;
    const p = (node.data as any)?.parameters || {};
    if (id.startsWith('aws_s3_bucket') && hasAws) {
      const name = p.bucketName || 'infracanvas-user-bucket';
      outputsTfContent += `output "${name}_bucket_arn" {
  value       = aws_s3_bucket.${name}.arn
  description = "ARN of the S3 bucket"
}\n\n`;
    }
    else if (id.startsWith('aws_db_instance') && hasAws) {
      const name = p.dbName || 'appdb';
      outputsTfContent += `output "${name}_endpoint" {
  value       = aws_db_instance.${name}.endpoint
  description = "Endpoint of the database instance"
}\n\n`;
    }
  });

  return { mainTf, variablesTf, outputsTf: outputsTfContent };
}

export async function downloadTerraformZip(nodes: Node[], edges: Edge[] = []): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const { mainTf, variablesTf, outputsTf } = generateTerraformFiles(nodes, edges);
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
    const { mainTf, variablesTf, outputsTf } = generateTerraformFiles(nodes, edges);
    files.push(
      { path: 'terraform/main.tf', name: 'main.tf', language: 'HCL', icon: 'lucide:file', iconColor: 'text-primary', lines: countLines(mainTf), size: getSizeKb(mainTf), content: mainTf },
      { path: 'terraform/variables.tf', name: 'variables.tf', language: 'HCL', icon: 'lucide:file', iconColor: 'text-muted-foreground', lines: countLines(variablesTf), size: getSizeKb(variablesTf), content: variablesTf },
      { path: 'terraform/outputs.tf', name: 'outputs.tf', language: 'HCL', icon: 'lucide:file', iconColor: 'text-muted-foreground', lines: countLines(outputsTf), size: getSizeKb(outputsTf), content: outputsTf },
    );
  }

  if (hasAnsible) {
    const targetNode = nodes.find(n => (n.data as any)?.tech === 'Target');
    const isGcp = targetNode?.id.startsWith('gcp_target');
    const instanceNode = nodes.find(n => n.id.startsWith('aws_instance.web_server'));
    const instanceName = ((instanceNode?.data as any)?.parameters || DEFAULT_INSTANCE_PARAMS).instanceName || 'web_server';
    const playbookYml = generateAnsibleYAML(nodes, edges);
    const colon = ':';
    
    const hostLine = isGcp
      ? `web_server_1 ansible_host=google_compute_instance.${instanceName}.public_ip ansible_user=ubuntu`
      : `web_server_1 ansible_host=aws_instance.${instanceName}.public_ip ansible_user=ubuntu`;

    const hostsIni = `[webservers]
${hostLine}

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
      else if ((node.data as any)?.isCustom && (node.data as any)?.tech === 'Kubernetes') {
        let customYaml = (node.data as any).rawCode || '';
        const params = (node.data as any).parameters || {};
        
        Object.entries(params).forEach(([key, val]) => {
          const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          customYaml = customYaml.replace(re, `${val}`);
        });
        k8sManifests.push(customYaml);
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
