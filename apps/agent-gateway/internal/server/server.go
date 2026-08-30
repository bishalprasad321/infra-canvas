// Package server implements the Agent Gateway side of the tunnel described in
// obsidian_memory/03.6: a hosted relay that authenticates an Agent's outbound
// WebSocket connection, keeps a live yamux session per agent_id, and — on
// request from the Runner side — opens a new logical stream to that Agent and
// splices it to the caller.
//
// Per 03.6, the Gateway is deliberately dumb: it authenticates, routes by
// agent_id, and enforces that a dial request's project matches the Agent's
// registered scope. It never parses SSH, Terraform, or Ansible bytes — once a
// stream's tiny routing header is exchanged, the Gateway just copies bytes in
// both directions.
//
// Ported from the Phase 0 spike (spikes/sandbox-agent-protocol/internal/gateway)
// for the Phase 1 opt-in beta: scoping is by project_id only (this codebase has
// no account concept), pairing approvals and agent connect/disconnect are
// reported back to apps/api so it stays the single source of truth for
// paired_agents.status, and /runner/dial requires a shared-secret header —
// a deliberately minimal Phase 1 auth boundary, not full Runner<->Gateway
// authentication (that hardening is Phase 2 territory, see obsidian_memory/08.4).
package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"
	"golang.org/x/time/rate"

	"apps/agent-gateway/internal/apiclient"
	"apps/agent-gateway/internal/pairing"
	"apps/agent-gateway/internal/wsconn"
)

type agentSession struct {
	identity pairing.AgentIdentity
	session  *yamux.Session

	// allowedServices is the fixed set of logical services this Agent
	// declared it will proxy to, reported once at connect time (see
	// handleAgentConnect). The Gateway checks a dial's requested service
	// against this set itself in handleRunnerDial, rather than trusting the
	// Agent's own per-stream ack/reject as the sole enforcement point — the
	// "Agent itself defines" allowlist model from obsidian_memory/03.6's
	// security section, point 1.
	allowedServices map[string]struct{}
}

// Server is the Agent Gateway. It owns the pairing flow, the live agent
// sessions, and the shared-secret check that authenticates callers of
// /runner/dial (the "infracanvas sandbox proxy" ProxyCommand helper the hosted
// Runner spawns).
type Server struct {
	Pairing      *pairing.Server
	APIClient    *apiclient.Client
	RunnerSecret string

	// MaxStreamsPerProject and BytesPerSecPerProject implement obsidian_memory/03.6's
	// rate-limiting requirement (point 6): cap concurrent streams and bytes/sec
	// per project regardless of tier, so a bug in the destination allowlist
	// above isn't the only thing standing between this tunnel and an open relay.
	MaxStreamsPerProject  int
	BytesPerSecPerProject int64

	upgrader websocket.Upgrader

	mu     sync.Mutex
	agents map[string]*agentSession // keyed by agent_id

	// limitsMu guards streamCounts and limiters together — bookkeeping for a
	// different concern (per-request dial limits) than mu (agent connect/
	// disconnect), kept under its own lock so the two never contend.
	//
	// Both maps are keyed by project_id and, unlike agents, have no natural
	// eviction hook (an agent disconnecting doesn't mean its project is done
	// dialing). Every distinct project_id ever seen leaves one small entry in
	// each map for the life of the process — negligible at beta scale, a
	// known and intentionally-deferred gap rather than something worth
	// over-engineering away here.
	limitsMu     sync.Mutex
	streamCounts map[string]int
	limiters     map[string]*rate.Limiter
}

// New creates a Gateway. verificationBaseURI is passed through to the pairing
// server (see pairing.NewServer). apiClient reports agent connect/disconnect
// status back to apps/api. runnerSecret authenticates /runner/dial callers.
// maxStreamsPerProject and bytesPerSecPerProject are the per-project_id caps
// described above.
func New(verificationBaseURI string, apiClient *apiclient.Client, runnerSecret string, maxStreamsPerProject int, bytesPerSecPerProject int64) *Server {
	return &Server{
		Pairing:               pairing.NewServer(verificationBaseURI),
		APIClient:             apiClient,
		RunnerSecret:          runnerSecret,
		MaxStreamsPerProject:  maxStreamsPerProject,
		BytesPerSecPerProject: bytesPerSecPerProject,
		upgrader:              websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }},
		agents:                make(map[string]*agentSession),
		streamCounts:          make(map[string]int),
		limiters:              make(map[string]*rate.Limiter),
	}
}

// acquireStreamSlot reports whether projectID is under MaxStreamsPerProject
// concurrent /runner/dial streams and, if so, reserves one. Callers that get
// true back must call releaseStreamSlot exactly once, via a defer placed
// immediately after the successful acquire so no later return path (including
// a recovered panic) can leak the slot.
func (s *Server) acquireStreamSlot(projectID string) bool {
	s.limitsMu.Lock()
	defer s.limitsMu.Unlock()
	if s.streamCounts[projectID] >= s.MaxStreamsPerProject {
		return false
	}
	s.streamCounts[projectID]++
	return true
}

func (s *Server) releaseStreamSlot(projectID string) {
	s.limitsMu.Lock()
	defer s.limitsMu.Unlock()
	s.streamCounts[projectID]--
}

// limiterFor returns the shared bytes/sec token bucket for projectID,
// creating it on first use and reusing it thereafter so every concurrent
// stream for that project — in both directions — draws from one budget
// instead of each stream getting its own.
func (s *Server) limiterFor(projectID string) *rate.Limiter {
	s.limitsMu.Lock()
	defer s.limitsMu.Unlock()
	lim, ok := s.limiters[projectID]
	if !ok {
		lim = rate.NewLimiter(rate.Limit(s.BytesPerSecPerProject), int(s.BytesPerSecPerProject))
		s.limiters[projectID] = lim
	}
	return lim
}

// Mux builds an http.ServeMux wired to every Gateway endpoint, ready to hand to
// http.Serve or httptest.NewServer.
func (s *Server) Mux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/device/code", s.handleDeviceCode)
	mux.HandleFunc("/device/approve", s.handleApprove)
	mux.HandleFunc("/device/token", s.handleToken)
	mux.HandleFunc("/agent/connect", s.handleAgentConnect)
	mux.HandleFunc("/runner/dial", s.handleRunnerDial)
	return mux
}

// ---- Device-authorization pairing (HTTP JSON) ----

func (s *Server) handleDeviceCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	auth, err := s.Pairing.RequestDeviceCode()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"device_code":      auth.DeviceCode,
		"user_code":        auth.UserCode,
		"verification_uri": auth.VerificationURI,
		"expires_at":       auth.ExpiresAt,
		"interval_seconds": int(auth.Interval.Seconds()),
	})
}

// handleApprove is internal-only: it is never called directly by the CLI or a
// browser, only by apps/api's authenticated POST /api/projects/{id}/agents/pair
// handler (which has already checked the caller holds EDITOR+ on the project)
// making a server-to-server call carrying the shared secret. This is what lets
// `infracanvas sandbox up` approve its own pairing request scriptably, without
// a separate browser approval page — a Phase 1 simplification of 06.3's
// browser-approval flow, tracked as a UI follow-up rather than a silent gap.
func (s *Server) handleApprove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.RunnerSecret == "" || r.Header.Get("X-Gateway-Runner-Secret") != s.RunnerSecret {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		UserCode  string `json:"user_code"`
		ProjectID string `json:"project_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if err := s.Pairing.Approve(body.UserCode, body.ProjectID); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		DeviceCode string `json:"device_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	ident, err := s.Pairing.PollToken(body.DeviceCode)
	if err != nil {
		switch err {
		case pairing.ErrAuthorizationPending:
			writeJSON(w, http.StatusPreconditionRequired, map[string]any{"error": "authorization_pending"})
		case pairing.ErrAccessDenied:
			writeJSON(w, http.StatusForbidden, map[string]any{"error": "access_denied"})
		case pairing.ErrExpired:
			writeJSON(w, http.StatusGone, map[string]any{"error": "expired_token"})
		default:
			http.Error(w, err.Error(), http.StatusNotFound)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"agent_token": ident.Token,
		"project_id":  ident.ProjectID,
	})
}

// ---- Agent registration (WebSocket, upgraded to a yamux server session) ----

func (s *Server) handleAgentConnect(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	agentID := r.URL.Query().Get("agent_id")
	if token == "" || agentID == "" {
		http.Error(w, "missing token or agent_id", http.StatusBadRequest)
		return
	}

	// allowed_services is the small, fixed set of logical services this
	// Agent itself defines at registration time (obsidian_memory/03.6,
	// security section point 1) — required so the Gateway can reject a dial
	// for anything else itself, rather than relying solely on the Agent's
	// own per-stream ack. Sent as a comma-separated query param alongside
	// token/agent_id, matching this same request's existing style; service
	// names (proto:port) never contain commas, so no escaping is needed.
	rawServices := r.URL.Query().Get("allowed_services")
	if rawServices == "" {
		http.Error(w, "missing allowed_services", http.StatusBadRequest)
		return
	}
	allowedServices := make(map[string]struct{})
	for _, svc := range strings.Split(rawServices, ",") {
		if svc != "" {
			allowedServices[svc] = struct{}{}
		}
	}
	if len(allowedServices) == 0 {
		http.Error(w, "missing allowed_services", http.StatusBadRequest)
		return
	}

	ident, ok := s.Pairing.LookupToken(token)
	if !ok {
		http.Error(w, "invalid agent token", http.StatusUnauthorized)
		return
	}

	ws, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("gateway: agent %s upgrade failed: %v", agentID, err)
		return
	}

	session, err := yamux.Server(wsconn.New(ws), yamux.DefaultConfig())
	if err != nil {
		ws.Close()
		log.Printf("gateway: agent %s yamux setup failed: %v", agentID, err)
		return
	}

	s.mu.Lock()
	s.agents[agentID] = &agentSession{identity: ident, session: session, allowedServices: allowedServices}
	s.mu.Unlock()

	log.Printf("gateway: agent %s connected (project=%s)", agentID, ident.ProjectID)
	if s.APIClient != nil {
		if err := s.APIClient.NotifyStatus(agentID, "ACTIVE"); err != nil {
			log.Printf("gateway: failed to notify apps/api of agent %s ACTIVE status: %v", agentID, err)
		}
	}

	// Block for the lifetime of the connection so the HTTP handler (and the
	// underlying WS conn) stays open; clean up once the session dies (closed
	// tunnel, dropped WiFi, process exit). Detection itself is free: yamux's
	// DefaultConfig() already pings every 30s with a 10s pong timeout, so a
	// dead tunnel closes this session within roughly 30-40s on its own — see
	// obsidian_memory/08.4's Phase 2 heartbeat/reconnect entry.
	<-session.CloseChan()

	s.mu.Lock()
	isCurrentSession := false
	if cur, ok := s.agents[agentID]; ok && cur.session == session {
		delete(s.agents, agentID)
		isCurrentSession = true
	}
	s.mu.Unlock()
	log.Printf("gateway: agent %s disconnected", agentID)

	// Skip the notify if a reconnect already replaced this session in s.agents
	// before this goroutine's check ran — that newer connection's own ACTIVE
	// notify already reflects reality, and sending DISCONNECTED here too could
	// race it and arrive second, incorrectly flipping status back. Narrows the
	// common case a lot; does not fully eliminate the race (two independent
	// HTTP requests have no cross-request ordering guarantee) — accepted
	// residual risk, documented in obsidian_memory/08.4, not engineered further.
	if isCurrentSession && s.APIClient != nil {
		if err := s.APIClient.NotifyStatus(agentID, "DISCONNECTED"); err != nil {
			log.Printf("gateway: failed to notify apps/api of agent %s DISCONNECTED status: %v", agentID, err)
		}
	}
}

// ---- Runner-side dial (WebSocket in, spliced to a new yamux stream) ----

func (s *Server) handleRunnerDial(w http.ResponseWriter, r *http.Request) {
	if s.RunnerSecret == "" || r.Header.Get("X-Gateway-Runner-Secret") != s.RunnerSecret {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	agentID := r.URL.Query().Get("agent_id")
	service := r.URL.Query().Get("service")
	projectID := r.URL.Query().Get("project_id")
	if agentID == "" || service == "" {
		http.Error(w, "missing agent_id or service", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	as, ok := s.agents[agentID]
	s.mu.Unlock()
	if !ok {
		http.Error(w, "agent not connected", http.StatusNotFound)
		return
	}

	// Security scoping from 03.6: a dial request must belong to the same
	// project as the agent it targets, or one project's traffic could be
	// routed to another project's laptop.
	if as.identity.ProjectID != projectID {
		http.Error(w, "agent does not belong to the requesting project", http.StatusForbidden)
		return
	}

	// Destination allowlisting (03.6, security section point 1): reject a
	// service the Agent never declared at connect time ourselves, instead of
	// forwarding every request and trusting the Agent's own ack/reject as the
	// only check — a bug in that check would otherwise turn this tunnel into
	// a general proxy.
	if _, allowed := as.allowedServices[service]; !allowed {
		http.Error(w, fmt.Sprintf("service %q not in agent's declared allowlist", service), http.StatusForbidden)
		return
	}

	// Rate limiting (03.6, security section point 6): cap concurrent streams
	// per project regardless of tier, closing off the abuse vector in point 1
	// even if the allowlist check above has a bug. The release is deferred
	// immediately after a successful acquire, before any other statement, so
	// every later return path here — including a recovered panic — can never
	// leak the slot.
	if !s.acquireStreamSlot(projectID) {
		http.Error(w, "too many concurrent sandbox streams for this project", http.StatusTooManyRequests)
		return
	}
	defer s.releaseStreamSlot(projectID)

	stream, err := as.session.Open()
	if err != nil {
		http.Error(w, fmt.Sprintf("could not open tunnel stream: %v", err), http.StatusBadGateway)
		return
	}

	if err := writeHeader(stream, service); err != nil {
		stream.Close()
		http.Error(w, fmt.Sprintf("could not write stream header: %v", err), http.StatusBadGateway)
		return
	}

	ack, err := readLine(stream)
	if err != nil {
		stream.Close()
		http.Error(w, fmt.Sprintf("agent did not acknowledge stream: %v", err), http.StatusBadGateway)
		return
	}
	if ack != ackOK {
		stream.Close()
		http.Error(w, fmt.Sprintf("agent rejected service %q: %s", service, ack), http.StatusForbidden)
		return
	}

	ws, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		stream.Close()
		log.Printf("gateway: runner dial upgrade failed: %v", err)
		return
	}
	defer ws.Close()
	defer stream.Close()

	splice(wsconn.New(ws), stream, s.limiterFor(projectID))
}

// splice copies bytes in both directions until either side closes or errors,
// then returns. This is the entire job of the Gateway's data plane: it never
// looks at what is inside these bytes. lim throttles both directions to a
// shared bytes/sec budget (03.6's rate-limiting requirement) — the same
// *rate.Limiter is reused across every concurrent stream for one project, so
// the budget is per-project, not per-stream.
func splice(a io.ReadWriteCloser, b io.ReadWriteCloser, lim *rate.Limiter) {
	done := make(chan struct{}, 2)
	go func() {
		io.Copy(a, &rateLimitedReader{r: b, lim: lim})
		done <- struct{}{}
	}()
	go func() {
		io.Copy(b, &rateLimitedReader{r: a, lim: lim})
		done <- struct{}{}
	}()
	<-done
}

// rateLimitedReader wraps an io.Reader so each Read draws from a shared
// bytes/sec token bucket before returning data. Reads are clamped to the
// limiter's burst size so a single Read can never need more tokens than the
// bucket will ever hold (which would otherwise block forever) — as a result,
// WaitN never blocks longer than roughly one burst's worth of time.
type rateLimitedReader struct {
	r   io.Reader
	lim *rate.Limiter
}

func (rr *rateLimitedReader) Read(p []byte) (int, error) {
	if burst := rr.lim.Burst(); len(p) > burst {
		p = p[:burst]
	}
	n, err := rr.r.Read(p)
	if n > 0 {
		if werr := rr.lim.WaitN(context.Background(), n); werr != nil {
			return n, werr
		}
	}
	return n, err
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
