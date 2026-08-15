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
- Core Language: Go 1.23
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
     - `aws_security_group` (statefully configures inbound ports, descriptions, allowed CIDR ranges, HTTP/HTTPS ports, and SSH access).
     - `aws_instance.web_server` (EC2 instance parameters with custom volume size, tags, and dynamic security group bindings).
   - Generates fully dynamic `terraform/variables.tf` and `terraform/outputs.tf` files mapping all active resource instances and parameters configured on the viewport canvas.
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

9. **Functional Canvas Interaction Modes (CanvasControls)**:
   - Integrates Select, Pan, and Link tools that actively configure ReactFlow behaviors:
     - **Select Mode**: Allows node dragging, click selection, and background left-click dragging to draw selection bounding boxes for multi-select.
     - **Pan Mode**: Disables node dragging, element selection, and connection handle creation. Locks dragging anywhere on the canvas background or nodes to pan the canvas viewport (showing grab/grabbing mouse cursors).
     - **Link Mode**: Disables node dragging to enable uninterrupted connection drawing. Highlights target connection handles with an enlarged, violet pulsing glow, changing mouse cursor to crosshair and changing to cyan on hover.

10. **Canvas Execution Safety Locking**:
    - Secures visual workflows during active pipeline runs (deploying or destroying):
      - Intercepts and filters ReactFlow changes to prevent deletion of nodes or edges.
      - Protects Zustand store actions (`addNode`, `deleteNode`) from concurrent modifications.
      - Disables side Library Panel dragging, parameter inspector input fields, canvas resets, and the CanvasControls toolbar.
      - Fades out visual delete buttons and toolbar controls to indicate read-only lock state.

11. **Live Node Execution Status Tracking**:
    - Each canvas node displays a live execution status strip attached below its card during pipeline runs, driven by per-node WebSocket events (`node_status` messages carrying `nodeId` and `status` fields).
    - The Go runner (`runner/runner.go`) parses live tool output to drive individual node state transitions rather than advancing all nodes of a phase simultaneously:
      - **Deploy**: Terraform resource nodes are tracked by matching log output patterns (`resource_id: Creating...` → `running`, `resource_id: Creation complete` → `completed`), enabling each AWS resource to light up and resolve independently. Ansible task nodes advance sequentially using `TASK [` markers in playbook output, transitioning each canvas node one at a time in execution order. Source nodes transition through `running` → `completed` during git clone; Target nodes are resolved immediately at pipeline start as they carry no execution step.
      - **Destroy**: Terraform resource nodes are individually tracked via destroy log patterns (`resource_id: Destroying...` → `running`, `resource_id: Destruction complete` → `completed`). Source, Target, Ansible, and Kubernetes nodes resolve immediately to `completed` since only Terraform runs during tear-down.
    - Status states flow as: `idle` → `pending` → `running` → `completed` / `failed`.
    - Strip color adapts to the active pipeline action: pulsing **blue** for deploy running, pulsing **red** for destroy running. Completed and failed states remain green and red respectively regardless of action.
    - The `RunTracker` struct stores the latest per-node status and replays the full map to late-joining WebSocket clients, eliminating a race condition between pipeline startup and client WebSocket connection establishment.
    - An `onStatusChange` pipeline callback emits a `CLEANUP` status when the optional auto-destroy phase runs post-deployment, surfaced in the terminal drawer as a distinct "CLEANING UP" badge rather than remaining on "RUNNING".
    - Frontend: `ReactFlowCanvasNode` renders a status strip at the base of each node card — gray (pending), pulsing blue or red (running, context-dependent), green (completed), red (failed) — sourced from `executionStatuses` and `pipelineAction` in the Zustand store (`apps/web/app/store/useCanvasStore.ts`).

12. **User Authentication & Session Management**:
    - Complete signup and login registration API handlers with bcrypt password hashing and token-based state session verification.
    - Decodes and validates JWT tokens natively within a custom Go API authentication middleware.
    - Frontend dashboard and workspace routes are secured via client-side Zustand store session hooks.

13. **Real-time Collaboration Stack**:
    - Real-time room synchronization backend utilizing Gorilla WebSockets.
    - Tracks peer cursor coordinates, visual node editor locks, and active workspace member lists.
    - Broadcasts edits dynamically to all collaborators to support real-time team interaction.

14. **Project Workspaces Dashboard**:
    - Serves as the user homepage, listing existing project scopes, visibility tags (Private, Team, Public), and tech details.
    - Includes project creation wizard modules to initialize workspaces under team organizations.

15. **Optimistic-Locked Canvas Auto-Saving**:
    - Restores nodes, edges, parameters, and ReactFlow viewport position from the database when loading a project workspace.
    - Debounces local canvas changes and auto-saves the state to the Go backend via a 1500ms delay.
    - Features version verification checks (optimistic locking) to resolve concurrent editing conflicts gracefully.

16. **Access Requests Discovery & Approval Workflows**:
    - Project discovery panel allows users to search public or organization projects and request access.
    - Admins receive notifications in their dashboard requests queue to approve or reject pending requests.

17. **Project-Scoped Runner Pipelines**:
    - Restricts deploy and destroy triggers to authorized project roles (ADMIN and EDITOR) using middleware.
    - Scopes runner execution logs and pipeline status histories directly to the associated project ID.

18. **Workspace Settings & Collaborators Management**:
    - Provides a premium tabbed settings configuration interface inside the canvas header.
    - Enables project administrators to edit project names, descriptions, and visibilities (Private, Team, Public).
    - Features collaborator controls to invite new members by email, update direct roles (Admin, Editor, Viewer), and revoke user access.
    - Offers a project deletion pipeline within the danger zone, protected by owner validation.

19. **Premium Custom Node Authoring**:
    - Adds a Premium-badged custom node creation interface in the workspace Library Panel.
    - Gates access to Pro and Enterprise tier plans, prompting Free tier users with a styled sandbox upgrade pathway.
    - Validates author-provided HCL/YAML code configurations dynamically on the backend via Go abstract syntax parsers (HCL AST syntax analyzer and YAML structures linter).
    - Extracts configuration parameter variables and binds them natively to the Inspector Panel.
    - Topologically compiles custom script payloads into generated Terraform files, Ansible playbooks, and Kubernetes manifests.

20. **InfraCanvas CLI & Import Engine**:
    - Creates a lightweight, cross-platform Go command-line tool (`infracanvas`) supporting user login, projects management, and deployment pipeline runs.
    - Integrates a backend reverse-parser engine utilizing HCL syntax trees and YAML decoders to import existing configuration manifests (`.tf`, `.yml`, `.yaml`).
    - Translates code blocks into interactive library canvas nodes, extracts variables, and establishes resource dependency connections.
    - Automatically structures layout coordinates via a grid spacing algorithm and broadcasts WebSocket signals to update active browser client workspaces instantly.

21. **Social Login (Google & GitHub)**:
    - Adds "Continue with Google" / "Continue with GitHub" as alternatives to email/password on the login screen, via a standard server-side OAuth 2.0 authorization-code flow (`apps/api/oauth.go`).
    - Identities are stored in a dedicated `oauth_identities` table rather than on `users` directly, so a user can link multiple providers and future providers (SSO, magic-link, etc.) are additive rows rather than another `users` migration.
    - Auto-links an OAuth sign-in to an existing password account only when the provider confirms the email is verified, avoiding an account-takeover vector; otherwise provisions a new account (with the same personal-team bootstrapping as password signup) on first login.
    - Handles GitHub's private-email setting via a `/user/emails` fallback lookup, and hands the issued session token back to the frontend through a URL fragment (never a query param) so it's never logged or stored in browser history.
    - **Scope note:** this covers the sign-in flow only. There is currently no account-management UI for viewing, adding, or unlinking connected providers after the fact — that's tracked as follow-up work, not part of this feature.

22. **AES-256-GCM Credential Vault & Multi-Cloud Targets**:
    - Secures AWS Access Keys, GCP Service Account JSON keys, and SSH Private Keys in SQLite using GCM symmetric encryption.
    - Implements safe masking previews (fingerprints) on REST APIs and UI drawers.
    - Mounts credential registers inside the Project Settings sidebar and parameters selectors in the Inspector Panel.
    - Rewrites the pipeline runner to inject temporary private keys/SA JSON files with `0600` permissions and stream-scrub outputs for credentials masking.

23. **Dynamic Node Parameter Passing & Hydration**:
    - Visual node variable connections and output metadata schemas.
    - Reusable `InputWithVariablePicker` input wrapper component for the Inspector Panel.
    - Dynamic HCL outputs generation compiler for both AWS and GCP node types.
    - Post-provisioning backend Go runner hydrator that queries Terraform outputs and executes dynamic parameter replacements recursively on configuration files before setup starts.

---

## Non-Implemented & Mocked Features (Roadmap)

To help engineers target their efforts, the following UI and logic blocks in the project are mock placeholders and will need to be developed:

1. **OS Environment Selector (Header)**:
   - Status: Mocked. The Linux, macOS, and Windows selectors toggle component local state but have no effect on code generation options or target deployment scripts.

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

### Social Login (Google / GitHub) Setup

Optional — email/password login works without this. To test "Continue with Google" / "Continue with GitHub" locally:

1. Copy the example env file at the repo root:
   ```bash
   cp .env.example .env
   ```

2. Register an OAuth app with each provider you want to test:
   - **Google** — [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create Credentials → OAuth client ID (type: Web application). Set the authorized redirect URI to `http://localhost:8080/api/auth/google/callback`.
   - **GitHub** — [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New OAuth App. Set the authorization callback URL to `http://localhost:8080/api/auth/github/callback`.

3. Fill in the four resulting values in `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   ```
   `API_PUBLIC_URL` and `FRONTEND_URL` can stay at their defaults unless the app is reachable somewhere other than `localhost:8080`/`localhost:3000`.

`.env` is git-ignored — never commit real Client Secrets. Docker Compose loads it automatically for the `api` service; if running the API directly via `go run .`, export the four variables in your shell instead, since only `docker compose`'s `env_file` reads `.env` automatically.

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
