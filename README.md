# InfraCanvas

InfraCanvas (also referenced as InfraFlow) is a visual orchestration web platform designed to unify infrastructure-as-code provisioning (Terraform), configuration management (Ansible), and container orchestration (Kubernetes) into a single, interactive drag-and-drop workspace. By placing node blocks on a visual editor and linking them together, team members can automatically generate deployable, modular infrastructure bundles.

This project is built as a monorepo containing a Next.js web application utilizing ReactFlow for visual node mapping, and a Go runner API backend that executes deployment bundles in a simulated sandbox environment.

---

## Technical Stack

### Frontend
- Core Framework: Next.js 16 (App Router) & React 19
- Visual Mapping: @xyflow/react (ReactFlow)
- State Management: Zustand
- Styling: TailwindCSS & Vanilla CSS
- Package Compilation: JSZip

### Backend
- Core Language: Go 1.22
- WebSockets: Gorilla WebSocket (for live run logs streaming)
- Database: SQLite (via modernc.org/sqlite, pure Go without CGO dependencies)

### DevOps Sandbox
- Cloud Simulation: LocalStack (AWS VPC, EC2, S3, RDS API mock)
- Server Simulation: Ubuntu SSH Docker containers
- Automation Tools: Terraform, Ansible, and Kubectl (installed inside the runner base image)

---

## Directory Structure

```text
infra-canvas/
├── apps/
│   ├── api/                 # Go runner API backend
│   │   ├── main.go          # Server entry point, DB setup, and HTTP/WS routing
│   │   ├── Dockerfile       # API server production Dockerfile (multi-stage)
│   │   ├── Dockerfile.base  # Runner base image Dockerfile (pre-installed DevOps tools)
│   │   └── runner/          # Pipeline execution engine
│   │       └── runner.go    # Runner orchestration, sandbox detection, and stdout/stderr stream scanning
│   └── web/                 # Next.js web workspace frontend
│       ├── app/
│       │   ├── components/  # UI components (inspector, canvas nodes, sidebar)
│       │   ├── lib/         # Ansible, Terraform, and K8s configuration generator logic
│       │   ├── store/       # Zustand state store for canvas management
│       │   └── workspace/   # Workspace visual editor page
│       └── package.json
├── sandbox/                 # Mock DevOps cloud environment configuration
│   ├── Dockerfile.ssh       # SSH-enabled simulated Ubuntu server image
│   ├── docker-compose.sandbox.yml # Docker Compose config for the dev sandbox (localstack + SSH containers)
│   └── id_rsa / id_rsa.pub  # Pre-generated SSH key pair for passwordless dev sandbox access
├── package.json             # Root Monorepo configuration
├── turbo.json               # Turborepo task runner configuration
└── docker-compose.yml       # Production-ready compose configuration containing the API + sandbox resources
```

---

## Implemented & Functional Features

Future engineers picking up the codebase should note the following features are actively implemented:

1. **Topological Ansible Compilation**:
   - Connection edges between visual nodes are used to topologically sort the deployment steps in `apps/web/app/lib/exportYaml.ts`.
   - Generates sequential, valid YAML task playbooks (`ansible/playbook.yml`) representing system updates, UFW firewall configurations, installations (Nginx, Node.js, PostgreSQL), user configurations, and file distributions.
   - Includes dynamic tasks such as `deploy-node-app` (automated Node app deployment using pm2 and npm install), `git_clone` (automated repository cloning), `apt_install` (custom system packages), `create_user` (system user provisioning), `systemd_service` (service controls), and `shell_command` (script execution).
   - Injects optimization configurations (unsafe-io) and automatic apt-lock cleanups to speed up execution inside containers.
   - Detects used variables and inserts a standard `vars` declarations section at the playbook level.

2. **Dynamic Multi-Resource Terraform Generation**:
   - Supports parametric HCL generation for multiple AWS components:
     - `aws_vpc` (with configurable name, CIDR blocks, and DNS hostnames toggles).
     - `aws_subnet` (linked dynamically to the VPC with AZ selection and public IP settings).
     - `aws_s3_bucket` (with force-destroy and bucket versioning configurations).
     - `aws_db_instance` (allocated storage, database credentials, engine version, and instance classes).
     - `aws_security_group` (statefully configures inbound ports, descriptions, and allowed CIDR ranges).
     - `aws_instance.web_server` (EC2 instance parameters with custom volume size, tags, and dynamic security group bindings).
   - Resources on the canvas are mapped dynamically (e.g., EC2 instances automatically reference custom security groups in their configuration).

3. **Kubernetes Multi-Resource Manifests Compiler**:
   - Compiles valid manifests (`k8s/deployment.yaml`) dynamically based on canvas configurations:
     - `k8s_deployment` (replicas count, container image, ports, CPU/memory limits).
     - `k8s_service` (ClusterIP, NodePort, LoadBalancer exposure).
     - `k8s_configmap` & `k8s_secret` (key-value config pairs, with automatic base64 encoding for secrets).
     - `k8s_ingress` (HTTP host, path, and backend service bindings).
     - `k8s_pvc` (volume storage requests and storage classes).

4. **Source Code Fetching & Target Environment Control**:
   - **Code Repository Node (tech: "Source")**: Instructs the pipeline to clone application code via git at `Phase 00` prior to provisioning.
   - **AWS Target Node (tech: "Target")**: Configures destination environments. Handles overrides for `localstack` sandbox and redirects Terraform endpoints to LocalStack's container ports.

5. **Intelligent Sandbox Translation & Inventory Binding**:
   - The Go backend runner detects target environments dynamically. During `localstack` sandboxing, it patches Terraform configurations, pre-creates S3 state buckets, and registers dummy AMIs on-the-fly to prevent execution crashes.
   - Post-provisioning, the runner executes state output queries (`terraform output -json`) to resolve the EC2 instance's IP addresses and dynamically maps them to the SSH ports of the sandbox containers (`ubuntu_ssh_1`, `ubuntu_ssh_2`) in the Ansible inventory (`hosts.ini`).

6. **Teardown & Clean-up Pipeline**:
   - The platform supports teardown pipelines. Triggering the "Destroy" action runs a full teardown execution (`terraform destroy`) in the sandbox environment.

7. **Persistent Pipeline Run Tracking**:
   - Spawns runner processes, captures execution logs, and streams stdout/stderr output line-by-line over WebSockets.
   - Saves deployment histories, logs, canvas assets, and run statuses (PENDING, RUNNING, SUCCESS, FAILED) inside a local SQLite database (`apps/api/data/dev.db`).

8. **ZIP Bundle Compiler**:
   - Compiles a complete workspace directory including `terraform/`, `ansible/`, `k8s/`, and project documentation on-the-fly.
   - Packs file items using `jszip` and downloads them directly as a `.zip` archive on the user's local machine.

---

## Non-Implemented & Mocked Features (Roadmap)

To help engineers target their efforts, the following UI and logic blocks in the project are mock placeholders and will need to be developed:

1. **OS Environment Selector (Header)**:
   - Status: Mocked. The Linux, macOS, and Windows selectors toggle component local state but have no effect on code generation options or target deployment scripts.

2. **Collaboration Stack & Live Sync (Header)**:
   - Status: Mocked. The user avatars and "Live Syncing" status spinner are static visual elements. Future developers should integrate a signaling framework or WebSockets (e.g., Y.js) to enable real-time collaborative workspace synchronization.

3. **Canvas Interaction Modes (CanvasControls)**:
   - Status: Mocked. The Select, Pan, and Link buttons modify UI selection states but do not configure ReactFlow behaviors (e.g., locking/unlocking panning, editing connection handles).

4. **Static File Configurations**:
   - Status: Mocked. The files `terraform/variables.tf` and `terraform/outputs.tf` generate static templates that do not fully map all resources and connections on the canvas.

---

## Local Development Setup

To run the project locally, ensure you have the following prerequisites installed:
- Node.js (v18+)
- Go (v1.22+)
- Docker and Docker Compose

### Developer Sandbox Setup

Before running the application or executing deployments, you must spin up the local DevOps sandbox. This simulates the target cloud environment (AWS via LocalStack, and virtual machines via SSH-enabled Ubuntu containers) without incurring costs or needing real servers.

1. Generate the SSH key pair:
   ```bash
   ssh-keygen -t rsa -b 4096 -f sandbox/id_rsa -N ""
   ```
   - _Note: If you already have an SSH key pair, you can skip this step._

2. Spin up the sandbox services:
   ```bash
   docker compose -f sandbox/docker-compose.sandbox.yml up -d
   ```

This starts:
- LocalStack on port 4566 (simulating AWS VPC, S3, EC2 APIs)
- ubuntu_ssh_1 on port 2222 (representing Ansible server target 1)
- ubuntu_ssh_2 on port 2223 (representing Ansible server target 2)

The Go backend runner automatically reads the private key from `sandbox/id_rsa` to execute commands against the containers.

### Running the Full Stack (Frontend + Backend)

To launch both the Next.js frontend application and the Go API backend concurrently for development:

1. Install all dependencies from the root directory:
   ```bash
   npm install
   ```

2. Start the development servers:
   ```bash
   npm run dev
   ```

This uses Turborepo to run:
- Next.js frontend at `http://localhost:3000`
- Go API backend at `http://localhost:8080`

### Running the Backend Server Separately

If you are focusing on backend development or debugging the Go runner, you can run the API server independently:

1. Ensure the developer sandbox is running:
   ```bash
   docker compose -f sandbox/docker-compose.sandbox.yml up -d
   ```

2. Navigate to the API app directory:
   ```bash
   cd apps/api
   ```

3. Run the Go server:
   ```bash
   go run main.go
   ```

By default:
- The server listens on port `8080` (overwrite by setting the `PORT` environment variable).
- It creates and connects to a SQLite database at `apps/api/data/dev.db`.
- It reads the private SSH key from `../../sandbox/id_rsa` to authenticate against the sandbox containers.

### Running Everything inside Docker

To run the entire ecosystem (Next.js web client, Go API, database, and DevOps sandbox) in containerized form:

```bash
docker compose up --build
```
