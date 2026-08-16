---
title: InfraCanvas Second Brain - Map of Content (MOC)
created: 2026-08-15
type: hub
tags:
  - moc
  - index
  - architecture
  - second-brain
---

# InfraCanvas - Second Brain Index (Map of Content)

This vault serves as the persistent knowledge repository and architectural source of truth for the InfraCanvas project. It is structured as the primary touchpoint for AI agents and engineers to obtain technical context, understand architectural trade-offs, review historical bug post-mortems, and make informed engineering decisions.

---

## System Navigation & Map of Content

```mermaid
graph TD
    MOC[00 - Second Brain Index] --> Vision[01 - Vision & Architecture]
    MOC --> Compilers[02 - Core Engines & Compilers]
    MOC --> Runner[03 - Execution Runner & Sandbox]
    MOC --> Security[04 - Security & Identity]
    MOC --> Frontend[05 - Frontend & Visual Canvas]
    MOC --> CLI[06 - CLI & Tooling]
    MOC --> Learnings[07 - Learnings, Mistakes & Gotchas]
    MOC --> Roadmap[08 - Roadmap & Future Development]

    Vision --> V1[[01.1 - Project Vision & Core Paradigm]]
    Vision --> V2[[01.2 - System Architecture & Monorepo Structure]]
    Vision --> V3[[01.3 - Data Models & SQLite Schema]]
    Vision --> V4[[01.4 - Realtime Sync & WebSocket Architecture]]

    Compilers --> C1[[02.1 - Topological Ansible Compiler]]
    Compilers --> C2[[02.2 - Dynamic Multi-Resource Terraform Generator]]
    Compilers --> C3[[02.3 - Kubernetes Manifests Compiler]]
    Compilers --> C4[[02.4 - HCL and YAML Reverse Importer AST]]
    Compilers --> C5[[02.5 - ZIP Bundle Packaging & Export]]

    Runner --> R1[[03.1 - Go Runner Pipeline Engine]]
    Runner --> R2[[03.2 - DevOps Sandbox (LocalStack & SSH Containers)]]
    Runner --> R3[[03.3 - Dynamic Inventory & Output State Binding]]
    Runner --> R4[[03.4 - Live Node Status Tracking & Stream Scanning]]
    Runner --> R5[[03.5 - Teardown & Destroy Lifecycle]]

    Security --> S1[[04.1 - Authentication & RBAC Access Control]]
    Security --> S2[[04.2 - Social OAuth 2.0 Flow (Google & GitHub)]]
    Security --> S3[[04.3 - AES-256-GCM Credential Vault & Fingerprinting]]

    Frontend --> F1[[05.1 - ReactFlow Canvas & Interaction Modes]]
    Frontend --> F2[[05.2 - Zustand State Stores Architecture]]
    Frontend --> F3[[05.3 - Execution Safety Locking & Readonly Modes]]
    Frontend --> F4[[05.4 - Custom Node Authoring & Validation]]

    CLI --> T1[[06.1 - InfraCanvas CLI & Reverse Import Tool]]
    CLI --> T2[[06.2 - Build Scripts & Static Binary Distribution]]

    Learnings --> L1[[07.1 - Critical Bugs Encountered & Solutions]]
    Learnings --> L2[[07.2 - Technical Pitfalls & Edge Cases]]
    Learnings --> L3[[07.3 - Design Trade-offs & Pros-Cons Matrix]]

    Roadmap --> RM1[[08.1 - Non-Implemented & Mocked Features]]
    Roadmap --> RM2[[08.2 - AI Agent & Prompt-to-Canvas Integration]]
    Roadmap --> RM3[[08.3 - Enterprise Scalability & Cloud Roadmap]]
```

---

## Vault Structure

### 1. [[01.1 - Project Vision & Core Paradigm|01 - Vision & Architecture]]
Foundational design principles, visual-to-code compilation paradigm, monorepo architecture, database schema, and real-time collaboration.
- [[01.1 - Project Vision & Core Paradigm]]
- [[01.2 - System Architecture & Monorepo Structure]]
- [[01.3 - Data Models & SQLite Schema]]
- [[01.4 - Realtime Sync & WebSocket Architecture]]

### 2. [[02.1 - Topological Ansible Compiler|02 - Core Engines & Compilers]]
Graph-to-code compilation mechanics (Ansible Playbooks, Terraform HCL, Kubernetes YAML), AST reverse-engineering, and ZIP bundling.
- [[02.1 - Topological Ansible Compiler]]
- [[02.2 - Dynamic Multi-Resource Terraform Generator]]
- [[02.3 - Kubernetes Manifests Compiler]]
- [[02.4 - HCL and YAML Reverse Importer AST]]
- [[02.5 - ZIP Bundle Packaging & Export]]

### 3. [[03.1 - Go Runner Pipeline Engine|03 - Execution Runner & DevOps Sandbox]]
Go execution engine, LocalStack and Ubuntu SSH container sandboxing, dynamic IP binding, real-time log streaming, and teardown pipelines.
- [[03.1 - Go Runner Pipeline Engine]]
- [[03.2 - DevOps Sandbox (LocalStack & SSH Containers)]]
- [[03.3 - Dynamic Inventory & Output State Binding]]
- [[03.4 - Live Node Status Tracking & Stream Scanning]]
- [[03.5 - Teardown & Destroy Lifecycle]]

### 4. [[04.1 - Authentication & RBAC Access Control|04 - Security & Identity]]
User authentication, Team/Project RBAC authorization matrix, OAuth 2.0 flow (Google and GitHub), and the AES-256-GCM credential vault.
- [[04.1 - Authentication & RBAC Access Control]]
- [[04.2 - Social OAuth 2.0 Flow (Google & GitHub)]]
- [[04.3 - AES-256-GCM Credential Vault & Fingerprinting]]

### 5. [[05.1 - ReactFlow Canvas & Interaction Modes|05 - Frontend & Visual Canvas]]
Next.js 16 and React 19 visual workspace, Zustand state management, interaction modes (Select, Pan, Link), canvas execution safety locks, and custom node authoring.
- [[05.1 - ReactFlow Canvas & Interaction Modes]]
- [[05.2 - Zustand State Stores Architecture]]
- [[05.3 - Execution Safety Locking & Readonly Modes]]
- [[05.4 - Custom Node Authoring & Validation]]

### 6. [[06.1 - InfraCanvas CLI & Reverse Import Tool|06 - CLI & Tooling]]
Go CLI tool (`infracanvas`), automated build pipelines, and static distribution mechanisms.
- [[06.1 - InfraCanvas CLI & Reverse Import Tool]]
- [[06.2 - Build Scripts & Static Binary Distribution]]

### 7. [[07.1 - Critical Bugs Encountered & Solutions|07 - Learnings, Mistakes & Gotchas]]
**MANDATORY READING BEFORE NEW IMPLEMENTATIONS:** Detailed technical post-mortems of hard-won engineering bugs, pitfalls, and architectural trade-offs.
- [[07.1 - Critical Bugs Encountered & Solutions]]
- [[07.2 - Technical Pitfalls & Edge Cases]]
- [[07.3 - Design Trade-offs & Pros-Cons Matrix]]

### 8. [[08.1 - Non-Implemented & Mocked Features|08 - Roadmap & Future Development]]
Documented list of mocked and incomplete features, the planned AI prompt-to-canvas engine, and scaling toward multi-cloud enterprise readiness.
- [[08.1 - Non-Implemented & Mocked Features]]
- [[08.2 - AI Agent & Prompt-to-Canvas Integration]]
- [[08.3 - Enterprise Scalability & Cloud Roadmap]]

---

## Agent Operational Protocol

When an AI agent initializes in this codebase:
1. **Consult Architecture & Schema**: Review [[01.2 - System Architecture & Monorepo Structure]] and [[01.3 - Data Models & SQLite Schema]] before adding tables, routes, or components.
2. **Review Compiler Rules**: Review [[02.1 - Topological Ansible Compiler]] and [[02.2 - Dynamic Multi-Resource Terraform Generator]] before touching code synthesis.
3. **Verify Execution Pitfalls**: Read [[07.1 - Critical Bugs Encountered & Solutions]] and [[07.2 - Technical Pitfalls & Edge Cases]] to avoid known regressions (e.g., LocalStack AMI behavior, pure Go SQLite constraints, OAuth email verification rules, dpkg lock contention).
4. **Update Documentation**: Whenever new architecture patterns, data models, or breaking changes are introduced, document them immediately in this vault.
