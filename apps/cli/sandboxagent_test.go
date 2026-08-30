package main

// Tests for the reconnect logic added for obsidian_memory/08.4's Phase 2
// heartbeat/reconnect item: the pure backoff shape, and that connectAndServe
// is safely re-callable across repeated reconnect attempts (the actual unit
// the outer runSandboxAgentRun retry loop depends on). runSandboxAgentRun
// itself — flag parsing plus an infinite loop with log.Fatal exit paths — is
// left as manual-verification-only; see obsidian_memory/08.4 for why.

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"
)

func TestReconnectBackoff(t *testing.T) {
	b := newReconnectBackoff()
	want := []time.Duration{1 * time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second, 30 * time.Second}
	for i, w := range want {
		if got := b.next(); got != w {
			t.Fatalf("next() call %d: got %v, want %v", i+1, got, w)
		}
	}
	// A further call must stay capped, not keep doubling past reconnectMaxDelay.
	if got := b.next(); got != reconnectMaxDelay {
		t.Fatalf("expected backoff to stay capped at %v, got %v", reconnectMaxDelay, got)
	}

	b.reset()
	if got := b.next(); got != reconnectInitialDelay {
		t.Fatalf("reset() should restart at %v, got %v", reconnectInitialDelay, got)
	}
}

// startFakeGateway is a minimal stand-in for apps/agent-gateway's
// /agent/connect handler — reimplemented here rather than imported, since
// apps/cli and apps/agent-gateway are separate Go modules by design (matching
// the duplication precedent this file's own header comment already
// establishes for wsAdapter/readLine/writeLine/splicePipe). It upgrades to a
// WebSocket, wraps it as a yamux server session, and closes the session
// shortly after — simulating a tunnel dying so connectAndServe returns,
// exactly like a real dead connection does via yamux's own keepalive.
func startFakeGateway(t *testing.T) (wsURL string, connectionCount func() int32) {
	t.Helper()
	var count int32
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

	mux := http.NewServeMux()
	mux.HandleFunc("/agent/connect", func(w http.ResponseWriter, r *http.Request) {
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		atomic.AddInt32(&count, 1)

		session, err := yamux.Server(&wsAdapter{ws: ws}, yamux.DefaultConfig())
		if err != nil {
			ws.Close()
			return
		}
		// Give connectAndServe a moment to be actively Accept()-ing before
		// closing, so this deterministically exercises the "tunnel closed"
		// return path rather than racing the initial handshake.
		time.Sleep(50 * time.Millisecond)
		session.Close()
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return "ws" + strings.TrimPrefix(srv.URL, "http") + "/agent/connect", func() int32 { return atomic.LoadInt32(&count) }
}

// TestConnectAndServeReconnectsAcrossCalls proves connectAndServe leaves no
// state behind that would break a second call — the property the outer
// reconnect loop in runSandboxAgentRun depends on to safely retry forever.
func TestConnectAndServeReconnectsAcrossCalls(t *testing.T) {
	wsURL, connectionCount := startFakeGateway(t)
	allowlist := map[string]string{}

	for i := 0; i < 2; i++ {
		err := connectAndServe(wsURL, "agent-test", wsURL, allowlist)
		if err == nil {
			t.Fatalf("call %d: expected connectAndServe to return once the tunnel closed, got nil", i+1)
		}
	}

	if got := connectionCount(); got != 2 {
		t.Fatalf("expected the fake gateway to see 2 separate connections, got %d", got)
	}
}
