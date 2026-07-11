# InfraCanvas

InfraCanvas (also referenced as InfraFlow) is a visual orchestration web platform designed to unify infrastructure-as-code provisioning (Terraform), configuration management (Ansible), and container orchestration (Kubernetes) into a single, interactive drag-and-drop workspace. By placing node blocks on a visual editor and linking them together, team members can automatically generate deployable, modular infrastructure bundles.

This project is built as a Next.js web application utilizing ReactFlow for visual node mapping.

---

## Technical Stack

- **Core Framework**: Next.js 15 (App Router) & React 19
- **Visual Mapping**: `@xyflow/react` (ReactFlow)
- **State Management**: Zustand
- **Styling**: TailwindCSS & Vanilla CSS
- **Package Compilation**: JSZip

---

## Directory Structure

```text
infra-canvas/
├── app/
│   ├── components/       # UI and canvas subcomponents
│   │   ├── ReactFlowCanvasNode.tsx # Dynamic visual canvas node type
│   │   └── ...           # Legacy components (RightPanel, Sidebar, NodeConfigPanel)
│   ├── workspace/        # Visual canvas dashboard editor page
│   │   └── page.tsx
│   ├── export-code/      # Bundle directory preview and download page
│   │   └── page.tsx
│   ├── lib/              # Core generation logic
│   │   ├── bundleGenerator.ts # Prepares files for ZIP download
│   │   ├── exportYaml.ts      # Topologically sorts and compiles Ansible playbooks
│   │   └── uiComponents.tsx   # Reusable layout controls
│   ├── store/
│   │   └── useCanvasStore.ts  # Zustand canvas store (nodes, edges, selection state)
│   ├── globals.css       # Core design system and color palette
│   └── layout.tsx
├── public/               # Static assets
└── package.json
```

---

## Implemented & Functional Features

Future engineers picking up the codebase should note the following features are actively implemented:

1. **Topological Ansible Compilation**:
   - Connection edges between visual nodes are used to topologically sort the deployment steps in `app/lib/exportYaml.ts`.
   - Generates sequential, valid YAML task playbooks (`ansible/playbook.yml`) representing system updates, UFW firewall configurations, installations (Nginx, Node.js, PostgreSQL), user configurations, and file distributions.
   - Detects used variables and inserts a standard `vars` declarations section at the playbook level.

2. **Parametric AWS EC2 Generation**:
   - The AWS EC2 Node (`aws_instance.web_server`) allows users to change its parameters dynamically in the Inspector sidebar.
   - Modifying fields like Instance Name, AMI ID, Subnet ID, Instance Type, Root Volume Size, and Custom Tags dynamically regenerates corresponding HCL block outputs in the Live Preview and in the export bundle files (`terraform/main.tf`).

3. **ZIP Bundle Compiler**:
   - Compiles a complete workspace directory including `terraform/`, `ansible/`, `k8s/`, and project documentation on-the-fly.
   - Packs file items using `jszip` and downloads them directly as a `.zip` archive on the user's local machine.

---

## Non-Implemented & Mocked Features (Roadmap)

To help engineers target their efforts, the following UI and logic blocks in the project are mock placeholders and will need to be developed:

1. **OS Environment Selector (Header)**:
   - *Status*: Mocked. The Linux, macOS, and Windows selectors toggle component local state but have no effect on code generation options or target deployment scripts.

2. **Collaboration Stack & Live Sync (Header)**:
   - *Status*: Mocked. The user avatars and "Live Syncing" status spinner are static visual elements. Future developers should integrate a signaling framework or WebSockets (e.g., Y.js) to enable real-time collaborative workspace synchronization.

3. **Canvas Interaction Modes (CanvasControls)**:
   - *Status*: Mocked. The Select, Pan, and Link buttons modify UI selection states but do not configure ReactFlow behaviors (e.g., locking/unlocking panning, editing connection handles).

4. **Terraform Security Group Node**:
   - *Status*: Mocked. The HCL output is hardcoded, and the node currently lacks configurable fields in the Parameters panel.

5. **Kubernetes Integration**:
   - *Status*: Mocked. The Kubernetes Deployments are represented by static manifests (`k8s/deployment.yaml`), and Kubernetes visual nodes do not have parameter bindings or a dynamic code generator.

6. **Static File Configurations**:
   - *Status*: Mocked. The files `terraform/variables.tf`, `terraform/outputs.tf`, and `ansible/hosts.ini` are static templates that do not fully adapt to reflect all resources and connections on the canvas.

---

## Local Development Setup

To run the project locally, execute the following commands in the project root:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the landing page and visual workspace.
