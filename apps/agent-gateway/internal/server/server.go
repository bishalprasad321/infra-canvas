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
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"

	"apps/agent-gateway/internal/apiclient"
	"apps/agent-gateway/internal/pairing"
	"apps/agent-gateway/internal/wsconn"
)

type agentSession struct {
	identity pairing.AgentIdentity
	session  *yamux.Session
}

// Server is the Agent Gateway. It owns the pairing flow, the live agent
// sessions, and the shared-secret check that authenticates callers of
// /runner/dial (the "infracanvas sandbox proxy" ProxyCommand helper the hosted
// Runner spawns).
type Server struct {
	Pairing      *pairing.Server
	APIClient    *apiclient.Client
	RunnerSecret string

	upgrader websocket.Upgrader

	mu     sync.Mutex
	agents map[string]*agentSession // keyed by agent_id
}

// New creates a Gateway. verificationBaseURI is passed through to the pairing
// server (see pairing.NewServer). apiClient reports agent connect/disconnect
// status back to apps/api. runnerSecret authenticates /runner/dial callers.
func New(verificationBaseURI string, apiClient *apiclient.Client, runnerSecret string) *Server {
	return &Server{
		Pairing:      pairing.NewServer(verificationBaseURI),
		APIClient:    apiClient,
		RunnerSecret: runnerSecret,
		upgrader:     websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }},
		agents:       make(map[string]*agentSession),
	}
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
	s.agents[agentID] = &agentSession{identity: ident, session: session}
	s.mu.Unlock()

	log.Printf("gateway: agent %s connected (project=%s)", agentID, ident.ProjectID)
	if s.APIClient != nil {
		if err := s.APIClient.NotifyStatus(agentID, "ACTIVE"); err != nil {
			log.Printf("gateway: failed to notify apps/api of agent %s ACTIVE status: %v", agentID, err)
		}
	}

	// Block for the lifetime of the connection so the HTTP handler (and the
	// underlying WS conn) stays open; clean up once the session dies (closed
	// tunnel, dropped WiFi, process exit). Full reconnect UX and a distinct
	// "disconnected" status are Phase 2 scope (see obsidian_memory/08.4).
	<-session.CloseChan()

	s.mu.Lock()
	if cur, ok := s.agents[agentID]; ok && cur.session == session {
		delete(s.agents, agentID)
	}
	s.mu.Unlock()
	log.Printf("gateway: agent %s disconnected", agentID)
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

	splice(wsconn.New(ws), stream)
}

// splice copies bytes in both directions until either side closes or errors,
// then returns. This is the entire job of the Gateway's data plane: it never
// looks at what is inside these bytes.
func splice(a io.ReadWriteCloser, b io.ReadWriteCloser) {
	done := make(chan struct{}, 2)
	go func() {
		io.Copy(a, b)
		done <- struct{}{}
	}()
	go func() {
		io.Copy(b, a)
		done <- struct{}{}
	}()
	<-done
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
