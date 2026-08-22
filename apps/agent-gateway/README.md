# Agent Gateway

The hosted relay described in [`obsidian_memory/03.6 - Remote Sandbox Agent &
Bridging Connection
Protocol`](<../../obsidian_memory/03%20-%20Execution%20Runner%20&%20DevOps%20Sandbox/03.6%20-%20Remote%20Sandbox%20Agent%20&%20Bridging%20Connection%20Protocol.md>),
built for [`obsidian_memory/08.4`'s Phase
1](<../../obsidian_memory/08%20-%20Roadmap%20&%20Future%20Development/08.4%20-%20Local%20Sandbox%20Agent%20Rollout%20&%20Migration%20Plan.md>)
opt-in beta.

It authenticates a local Sandbox Agent's outbound WebSocket connection (see
`infracanvas sandbox up` / `agent-run` in `apps/cli`), keeps one
`yamux.Session` per `agent_id`, and — on request from `infracanvas sandbox
proxy` (the ProxyCommand helper the hosted Runner's `ansible-playbook`
subprocess spawns) — opens a new logical stream to that Agent and splices it
through. It never parses SSH, Terraform, or Ansible bytes.

This is an independent, standalone Go module (`go.mod` at this directory),
following the same pattern already used by `apps/api`, `apps/cli`, and
`spikes/sandbox-agent-protocol` — no `go.work` ties them together.

## Running it

```bash
cd apps/agent-gateway
go run ./cmd/agent-gateway --runner-secret=<shared-secret> --api-url=http://localhost:8080
```

`apps/api` must be started with the matching `GATEWAY_RUNNER_SECRET` env var
and `SANDBOX_AGENT_BETA=true` for pairing/status callbacks to work.

## Relationship to `apps/api`

The Gateway never touches the database directly. `apps/api` is the single
source of truth for `paired_agents.status`; the Gateway only calls back into
it over HTTP (`POST /api/internal/agents/{agentId}/callback`) to report when
an Agent's tunnel connects.

## Known Phase 1 limitations (not silent gaps — tracked for Phase 2)

- **`/runner/dial` auth is a single shared secret** (`X-Gateway-Runner-Secret`),
  not per-Runner-instance credentials. This is the minimum viable
  authentication to keep the Gateway from being an open relay for this beta;
  real Runner↔Gateway authentication hardening is Phase 2 scope per
  `obsidian_memory/08.4`.
- **In-memory pairing state.** A single Gateway process holds all pending and
  active pairings; horizontal scaling / a shared store is out of scope for the
  beta.
- **No heartbeat/reconnect UX.** An Agent's tunnel dying (laptop sleep, WiFi
  drop) is only visible as the yamux session closing — no "Sandbox
  Disconnected" status is surfaced yet. Phase 2 scope.
- **No destination-allowlist hardening beyond the Agent's own fixed
  allowlist, and no rate limiting.** Also Phase 2 scope.
