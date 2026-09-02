// Package pairing implements an RFC 8628-style device-authorization flow so an
// unattended Sandbox Agent process (no browser, no login form) can be scoped to a
// project the same way `gh auth login` or `docker login` pair a headless device:
// the agent requests a code, the user approves it in an already authenticated
// browser tab, and the agent polls until a scoped token is issued.
//
// This package is deliberately standalone — it knows nothing about WebSockets,
// yamux, or the Gateway's HTTP transport. It is reused by internal/server, which
// exposes it over HTTP.
//
// Adapted from the Phase 0 spike (spikes/sandbox-agent-protocol/internal/pairing):
// scoping is by project_id only, not account_id+project_id — this codebase has no
// account concept, only projects/teams (see obsidian_memory/01.3).
package pairing

import (
	"crypto/rand"
	"encoding/base32"
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	// ErrAuthorizationPending is returned by PollToken while the user has not
	// yet approved (or denied) the pairing request. Callers should back off by
	// the interval reported at request time and poll again, exactly as RFC 8628
	// clients do.
	ErrAuthorizationPending = errors.New("pairing: authorization pending")
	// ErrAccessDenied is returned once the user explicitly denies the request.
	ErrAccessDenied = errors.New("pairing: access denied")
	// ErrExpired is returned once the device code's TTL has elapsed without approval.
	ErrExpired = errors.New("pairing: device code expired")
	// ErrNotFound is returned for an unrecognized device or user code.
	ErrNotFound = errors.New("pairing: code not found")
)

const (
	defaultTTL      = 10 * time.Minute
	defaultInterval = 5 * time.Second
)

type status int

const (
	statusPending status = iota
	statusApproved
	statusDenied
)

// DeviceAuth is what `infracanvas sandbox up` receives from RequestDeviceCode:
// a long opaque code it polls with, and a short human-typeable code it prints
// alongside a verification URL for the user to open in their browser.
type DeviceAuth struct {
	DeviceCode      string
	UserCode        string
	VerificationURI string
	ExpiresAt       time.Time
	Interval        time.Duration
}

// AgentIdentity is the scope baked into an issued agent token: which project the
// Agent is allowed to act on behalf of. The Gateway looks this up on every agent
// connection so one project's Runner traffic can never be routed to another
// project's laptop.
type AgentIdentity struct {
	ProjectID string
	AgentID   string
	Token     string
	IssuedAt  time.Time
}

type entry struct {
	userCode  string
	status    status
	projectID string
	agentID   string
	token     string // set once a token has been issued; codes are single-use.
	consumed  bool
	expiresAt time.Time
}

// Server holds pending and completed pairing requests in memory. It is safe for
// concurrent use. A production Gateway with multiple replicas would back this
// with a shared store (Redis, Postgres); for this Phase 1 beta a single Gateway
// instance with an in-memory map is sufficient (see obsidian_memory/08.4 —
// horizontal scaling is out of scope for the beta).
type Server struct {
	baseVerificationURI string

	mu       sync.Mutex
	byDevice map[string]*entry
	byUser   map[string]*entry
	byToken  map[string]*entry
}

// NewServer creates a pairing server. baseVerificationURI is the browser-facing
// pairing page (e.g. "https://www.infracanvas.dev/pair") that DeviceAuth.VerificationURI
// is built from.
func NewServer(baseVerificationURI string) *Server {
	return &Server{
		baseVerificationURI: baseVerificationURI,
		byDevice:            make(map[string]*entry),
		byUser:              make(map[string]*entry),
		byToken:             make(map[string]*entry),
	}
}

// RequestDeviceCode starts a new pairing request. Called by the Agent at
// `infracanvas sandbox up` time.
func (s *Server) RequestDeviceCode() (DeviceAuth, error) {
	deviceCode, err := randomToken(32)
	if err != nil {
		return DeviceAuth{}, err
	}
	userCode, err := randomUserCode()
	if err != nil {
		return DeviceAuth{}, err
	}

	e := &entry{
		userCode:  userCode,
		status:    statusPending,
		expiresAt: time.Now().Add(defaultTTL),
	}

	s.mu.Lock()
	s.byDevice[deviceCode] = e
	s.byUser[userCode] = e
	s.mu.Unlock()

	return DeviceAuth{
		DeviceCode:      deviceCode,
		UserCode:        userCode,
		VerificationURI: fmt.Sprintf("%s?code=%s", s.baseVerificationURI, userCode),
		ExpiresAt:       e.expiresAt,
		Interval:        defaultInterval,
	}, nil
}

// Approve is called from the browser-side handler once the already-authenticated
// user confirms pairing and picks which project the Agent should be scoped to.
func (s *Server) Approve(userCode, projectID, agentID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	e, ok := s.byUser[userCode]
	if !ok {
		return ErrNotFound
	}
	if time.Now().After(e.expiresAt) {
		return ErrExpired
	}
	e.status = statusApproved
	e.projectID = projectID
	e.agentID = agentID
	return nil
}

// Deny is called if the user rejects the pairing request in the browser.
func (s *Server) Deny(userCode string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	e, ok := s.byUser[userCode]
	if !ok {
		return ErrNotFound
	}
	e.status = statusDenied
	return nil
}

// PollToken is called by the Agent on the interval reported in DeviceAuth. It
// returns ErrAuthorizationPending until Approve/Deny has been called, and issues
// a long-lived scoped agent token (not the user's own session JWT) exactly once
// on the first successful poll after approval.
func (s *Server) PollToken(deviceCode string) (AgentIdentity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	e, ok := s.byDevice[deviceCode]
	if !ok {
		return AgentIdentity{}, ErrNotFound
	}
	if time.Now().After(e.expiresAt) {
		return AgentIdentity{}, ErrExpired
	}

	switch e.status {
	case statusDenied:
		return AgentIdentity{}, ErrAccessDenied
	case statusPending:
		return AgentIdentity{}, ErrAuthorizationPending
	}

	if !e.consumed {
		token, err := randomToken(32)
		if err != nil {
			return AgentIdentity{}, err
		}
		e.token = token
		e.consumed = true
		ident := AgentIdentity{
			ProjectID: e.projectID,
			AgentID:   e.agentID,
			Token:     token,
			IssuedAt:  time.Now(),
		}
		s.byToken[token] = e
		return ident, nil
	}

	return AgentIdentity{
		ProjectID: e.projectID,
		AgentID:   e.agentID,
		Token:     e.token,
		IssuedAt:  time.Now(),
	}, nil
}

// LookupToken validates a previously issued agent token against this
// process's own in-memory cache, as the Gateway does on every incoming agent
// connection. This only ever has entries for tokens issued since this
// process started — it deliberately does not reach out to apps/api itself
// (see internal/server's handleAgentConnect, which does that as a fallback
// on a miss here) so the common case — a token looked up by the same process
// that issued it — never pays for a network round-trip.
func (s *Server) LookupToken(token string) (AgentIdentity, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	e, ok := s.byToken[token]
	if !ok {
		return AgentIdentity{}, false
	}
	return AgentIdentity{
		ProjectID: e.projectID,
		AgentID:   e.agentID,
		Token:     e.token,
	}, true
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b), nil
}

// randomUserCode produces a short, human-typeable code in the "ABCD-1234" shape
// used by real device-authorization flows so it is easy to read off a terminal
// and type into a browser.
func randomUserCode() (string, error) {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ" // no I/O, avoids confusion with 1/0
	const digits = "0123456789"

	letterPart, err := randomFrom(letters, 4)
	if err != nil {
		return "", err
	}
	digitPart, err := randomFrom(digits, 4)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%s", letterPart, digitPart), nil
}

func randomFrom(alphabet string, n int) (string, error) {
	b := make([]byte, n)
	idx := make([]byte, n)
	if _, err := rand.Read(idx); err != nil {
		return "", err
	}
	for i, v := range idx {
		b[i] = alphabet[int(v)%len(alphabet)]
	}
	return string(b), nil
}
