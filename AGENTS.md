<!-- BEGIN:nextjs-agent-rules -->
# Next.js 16 App Router Conventions

This project runs Next.js 16 (App Router) and React 19. APIs, conventions, dynamic route parameters (e.g. async `params`), and file structure differ from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before modifying Next.js routes. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Knowledge Base & Second Brain Protocol

## 1. Single Source of Truth (`/obsidian_memory`)
All architectural context, design patterns, data models, compiler logic, security paradigms, historical bug post-mortems, and technical trade-offs are documented in the **Obsidian Second Brain** located at:
`obsidian_memory/` (entry point: `obsidian_memory/00 - Second Brain Index.md`).

Any AI agent working on this repository **MUST** use `/obsidian_memory` as its primary reference and touchpoint before planning, designing, or implementing new features or bug fixes.

---

## 2. Topic Mapping & Required Reading by Task

| Task Type / Feature Area | Required Notes to Read First |
| :--- | :--- |
| **System Overview & Architecture** | `obsidian_memory/01 - Vision & Architecture/01.1 - Project Vision & Core Paradigm.md`<br/>`obsidian_memory/01 - Vision & Architecture/01.2 - System Architecture & Monorepo Structure.md` |
| **Database, Schema & RBAC** | `obsidian_memory/01 - Vision & Architecture/01.3 - Data Models & SQLite Schema.md`<br/>`obsidian_memory/04 - Security & Identity/04.1 - Authentication & RBAC Access Control.md` |
| **Code Generation (Ansible / Terraform / K8s)** | `obsidian_memory/02 - Core Engines & Compilers/02.1 - Topological Ansible Compiler.md`<br/>`obsidian_memory/02 - Core Engines & Compilers/02.2 - Dynamic Multi-Resource Terraform Generator.md`<br/>`obsidian_memory/02 - Core Engines & Compilers/02.3 - Kubernetes Manifests Compiler.md` |
| **AST Parsing, Reverse Import & CLI** | `obsidian_memory/02 - Core Engines & Compilers/02.4 - HCL and YAML Reverse Importer AST.md`<br/>`obsidian_memory/06 - CLI & Tooling/06.1 - InfraCanvas CLI & Reverse Import Tool.md` |
| **Execution Runner, LocalStack & Sandbox** | `obsidian_memory/03 - Execution Runner & DevOps Sandbox/03.1 - Go Runner Pipeline Engine.md`<br/>`obsidian_memory/03 - Execution Runner & DevOps Sandbox/03.2 - DevOps Sandbox (LocalStack & SSH Containers).md`<br/>`obsidian_memory/03 - Execution Runner & DevOps Sandbox/03.3 - Dynamic Inventory & Output State Binding.md` |
| **WebSockets & Real-Time Node Tracking** | `obsidian_memory/01 - Vision & Architecture/01.4 - Realtime Sync & WebSocket Architecture.md`<br/>`obsidian_memory/03 - Execution Runner & DevOps Sandbox/03.4 - Live Node Status Tracking & Stream Scanning.md` |
| **Authentication, OAuth & Credentials Vault** | `obsidian_memory/04 - Security & Identity/04.2 - Social OAuth 2.0 Flow (Google & GitHub).md`<br/>`obsidian_memory/04 - Security & Identity/04.3 - AES-256-GCM Credential Vault & Fingerprinting.md` |
| **Canvas UI, Interaction Modes & Stores** | `obsidian_memory/05 - Frontend & Visual Canvas/05.1 - ReactFlow Canvas & Interaction Modes.md`<br/>`obsidian_memory/05 - Frontend & Visual Canvas/05.2 - Zustand State Stores Architecture.md`<br/>`obsidian_memory/05 - Frontend & Visual Canvas/05.3 - Execution Safety Locking & Readonly Modes.md` |
| **Pre-Implementation Check (Mandatory)** | `obsidian_memory/07 - Learnings, Mistakes & Gotchas/07.1 - Critical Bugs Encountered & Solutions.md`<br/>`obsidian_memory/07 - Learnings, Mistakes & Gotchas/07.2 - Technical Pitfalls & Edge Cases.md`<br/>`obsidian_memory/07 - Learnings, Mistakes & Gotchas/07.3 - Design Trade-offs & Pros-Cons Matrix.md` |

---

## 3. Documentation Style & Maintenance Rules

1. **No Emojis or Casual Icons**: Markdown documentation in this repository must maintain an engineering-grade, professional technical style. Do not use decorative emojis or casual icons in headings or body text.
2. **Update on Architectural Changes**: When adding new database tables, routes, compiler features, or resolving non-trivial bugs, immediately create or update the corresponding document in `/obsidian_memory` with technical rationale and Mermaid diagrams where applicable.
3. **Preserve Cross-Links**: Maintain Obsidian wikilinks (`[[Note Name]]`) and relative markdown file links so the second brain graph remains fully traversable.
