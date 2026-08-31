// server_test.go exercises the Gateway's destination-allowlist and
// per-project rate-limiting enforcement added for obsidian_memory/08.4's
// Phase 2 hardening pass (see 03.6's Security Scoping section, points 1 and
// 6). It drives only the Gateway's public HTTP/WS surface (server.Mux()),
// using a small self-contained fake Agent modeled on the Phase 0 spike's
// internal/agent (spikes/sandbox-agent-protocol) — reimplemented here rather
// than imported, since apps/agent-gateway and that spike are separate Go
// modules by design, and these tests only need to exercise the Gateway's own
// logic, not real SSH semantics.
package server_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"

	"apps/agent-gateway/internal/apiclient"
	"apps/agent-gateway/internal/server"
	"apps/agent-gateway/internal/wsconn"
)

const (
	testProjectID    = "proj_test"
	testRunnerSecret = "test-runner-secret"
)

// pairAgent runs the device-authorization flow over HTTP against a live
// Gateway, exactly as `infracanvas sandbox up` and apps/api's pairing
// endpoint would, and returns the scoped agent token.
func pairAgent(t *testing.T, gatewayHTTPURL, projectID string) string {
	t.Helper()

	resp, err := http.Post(gatewayHTTPURL+"/device/code", "application/json", nil)
	if err != nil {
		t.Fatalf("device/code: %v", err)
	}
	defer resp.Body.Close()
	var auth struct {
		DeviceCode string `json:"device_code"`
		UserCode   string `json:"user_code"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&auth); err != nil {
		t.Fatalf("decode device/code response: %v", err)
	}

	approveBody, _ := json.Marshal(map[string]string{
		"user_code":  auth.UserCode,
		"project_id": projectID,
	})
	req, err := http.NewRequest(http.MethodPost, gatewayHTTPURL+"/device/approve", bytes.NewReader(approveBody))
	if err != nil {
		t.Fatalf("build device/approve request: %v", err)
	}
	req.Header.Set("X-Gateway-Runner-Secret", testRunnerSecret)
	approveResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("device/approve: %v", err)
	}
	approveResp.Body.Close()
	if approveResp.StatusCode != http.StatusNoContent {
		t.Fatalf("device/approve: expected 204, got %d", approveResp.StatusCode)
	}

	tokenBody, _ := json.Marshal(map[string]string{"device_code": auth.DeviceCode})
	tokenResp, err := http.Post(gatewayHTTPURL+"/device/token", "application/json", bytes.NewReader(tokenBody))
	if err != nil {
		t.Fatalf("device/token: %v", err)
	}
	defer tokenResp.Body.Close()
	if tokenResp.StatusCode != http.StatusOK {
		t.Fatalf("device/token: expected 200, got %d", tokenResp.StatusCode)
	}
	var tokenOut struct {
		AgentToken string `json:"agent_token"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenOut); err != nil {
		t.Fatalf("decode device/token response: %v", err)
	}
	return tokenOut.AgentToken
}

// fakeAgent is a minimal stand-in for `infracanvas sandbox agent-run`
// (apps/cli/sandboxagent.go): it connects to the Gateway, declares an
// allowlist via allowed_services, and proxies accepted streams to local TCP
// targets. streamsAccepted lets a test prove the Gateway never even opened a
// stream to the Agent for a dial it should have rejected itself.
type fakeAgent struct {
	session         *yamux.Session
	allowlist       map[string]string // service -> local address to dial
	streamsAccepted atomic.Int64
}

func connectFakeAgent(t *testing.T, gatewayHTTPURL, token, agentID string, allowlist map[string]string) *fakeAgent {
	t.Helper()

	u, err := url.Parse(gatewayHTTPURL)
	if err != nil {
		t.Fatalf("parse gateway url: %v", err)
	}
	u.Scheme = "ws"
	u.Path = "/agent/connect"

	services := make([]string, 0, len(allowlist))
	for svc := range allowlist {
		services = append(services, svc)
	}
	q := u.Query()
	q.Set("token", token)
	q.Set("agent_id", agentID)
	q.Set("allowed_services", strings.Join(services, ","))
	u.RawQuery = q.Encode()

	ws, resp, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("agent connect: %v (resp=%v)", err, resp)
	}

	session, err := yamux.Client(wsconn.New(ws), yamux.DefaultConfig())
	if err != nil {
		ws.Close()
		t.Fatalf("agent yamux client setup: %v", err)
	}

	fa := &fakeAgent{session: session, allowlist: allowlist}
	go fa.serve()
	t.Cleanup(func() { fa.session.Close() })
	return fa
}

func (fa *fakeAgent) serve() {
	for {
		stream, err := fa.session.Accept()
		if err != nil {
			return
		}
		fa.streamsAccepted.Add(1)
		go fa.handleStream(stream)
	}
}

// streamHeader/readLine/writeLine mirror the byte-exact framing
// internal/server/protocol.go uses. Duplicated rather than imported: this
// test package deliberately only drives the Gateway's public surface.
type streamHeader struct {
	Service string `json:"service"`
}

func readLine(r io.Reader) (string, error) {
	var buf []byte
	b := make([]byte, 1)
	for {
		n, err := r.Read(b)
		if n == 1 {
			if b[0] == '\n' {
				return string(buf), nil
			}
			buf = append(buf, b[0])
		}
		if err != nil {
			return "", err
		}
	}
}

func writeLine(w io.Writer, s string) error {
	_, err := w.Write([]byte(s + "\n"))
	return err
}

func (fa *fakeAgent) handleStream(stream net.Conn) {
	defer stream.Close()

	line, err := readLine(stream)
	if err != nil {
		return
	}
	var h streamHeader
	if err := json.Unmarshal([]byte(line), &h); err != nil {
		return
	}

	target, allowed := fa.allowlist[h.Service]
	if !allowed {
		writeLine(stream, "ERR: service not in agent allowlist")
		return
	}

	local, err := net.Dial("tcp", target)
	if err != nil {
		writeLine(stream, fmt.Sprintf("ERR: local dial failed: %v", err))
		return
	}
	defer local.Close()

	if err := writeLine(stream, "OK"); err != nil {
		return
	}
	splicePipe(stream, local)
}

func splicePipe(a, b io.ReadWriteCloser) {
	done := make(chan struct{}, 2)
	go func() { io.Copy(a, b); done <- struct{}{} }()
	go func() { io.Copy(b, a); done <- struct{}{} }()
	<-done
}

// dialRunnerStream performs the Runner-side half of a dial against a live
// Gateway, exactly as `infracanvas sandbox proxy` would.
func dialRunnerStream(gatewayWSURL, agentID, service, projectID string) (*wsconn.Conn, *http.Response, error) {
	u, err := url.Parse(gatewayWSURL + "/runner/dial")
	if err != nil {
		return nil, nil, err
	}
	q := u.Query()
	q.Set("agent_id", agentID)
	q.Set("service", service)
	q.Set("project_id", projectID)
	u.RawQuery = q.Encode()

	header := http.Header{"X-Gateway-Runner-Secret": {testRunnerSecret}}
	ws, resp, err := websocket.DefaultDialer.Dial(u.String(), header)
	if err != nil {
		return nil, resp, err
	}
	return wsconn.New(ws), resp, nil
}

func newTestGateway(t *testing.T, maxStreamsPerProject int, bytesPerSecPerProject int64) (httpURL, wsURL string) {
	t.Helper()
	srv := server.New("https://www.infracanvas.dev/pair", nil, testRunnerSecret, maxStreamsPerProject, bytesPerSecPerProject)
	httpSrv := httptest.NewServer(srv.Mux())
	t.Cleanup(httpSrv.Close)
	return httpSrv.URL, "ws" + strings.TrimPrefix(httpSrv.URL, "http")
}

// listenAndHold starts a TCP listener that accepts connections and holds
// each one open (blocking on Read) without ever closing it — a stand-in
// local "service" for tests that only care about stream lifecycle, not data.
func listenAndHold(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() { io.Copy(io.Discard, conn) }()
		}
	}()
	return ln.Addr().String()
}

// listenAndWrite starts a TCP listener that, on each accepted connection,
// immediately writes payload and then blocks (does not close), so a reader
// on the other end of the tunnel receives exactly payload and nothing more
// until the test ends.
func listenAndWrite(t *testing.T, payload []byte) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				c.Write(payload)
				io.Copy(io.Discard, c)
			}(conn)
		}
	}()
	return ln.Addr().String()
}

func TestHandleAgentConnectRequiresAllowedServices(t *testing.T) {
	httpURL, wsURL := newTestGateway(t, 10, 1<<20)
	token := pairAgent(t, httpURL, testProjectID)

	u, err := url.Parse(wsURL + "/agent/connect")
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	q := u.Query()
	q.Set("token", token)
	q.Set("agent_id", "agent-no-services")
	// allowed_services deliberately omitted.
	u.RawQuery = q.Encode()

	_, resp, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err == nil {
		t.Fatal("expected connect without allowed_services to be rejected, but it succeeded")
	}
	if resp == nil || resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got resp=%v err=%v", resp, err)
	}
}

// TestGatewayEnforcesDestinationAllowlist proves the Gateway itself rejects a
// service the Agent never declared, without ever opening a stream to the
// Agent — i.e. enforcement does not depend solely on the Agent's own ack.
func TestGatewayEnforcesDestinationAllowlist(t *testing.T) {
	httpURL, wsURL := newTestGateway(t, 10, 1<<20)
	token := pairAgent(t, httpURL, testProjectID)

	target := listenAndHold(t)
	fa := connectFakeAgent(t, httpURL, token, "agent-allowlist", map[string]string{"ssh:2222": target})
	time.Sleep(50 * time.Millisecond) // let the Agent's Accept loop start listening

	_, resp, err := dialRunnerStream(wsURL, "agent-allowlist", "ssh:9999", testProjectID)
	if err == nil {
		t.Fatal("expected the dial for an undeclared service to be rejected, but it succeeded")
	}
	if resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden, got resp=%v err=%v", resp, err)
	}
	if got := fa.streamsAccepted.Load(); got != 0 {
		t.Fatalf("expected the Agent to never see a stream for the rejected dial, but it accepted %d", got)
	}
}

// TestGatewayEnforcesConcurrentStreamCap proves a project can't exceed
// MaxStreamsPerProject concurrent /runner/dial streams, and that a released
// slot becomes available again.
func TestGatewayEnforcesConcurrentStreamCap(t *testing.T) {
	httpURL, wsURL := newTestGateway(t, 1, 1<<20)
	token := pairAgent(t, httpURL, testProjectID)

	target := listenAndHold(t)
	connectFakeAgent(t, httpURL, token, "agent-cap", map[string]string{"ssh:2222": target})
	time.Sleep(50 * time.Millisecond)

	first, resp, err := dialRunnerStream(wsURL, "agent-cap", "ssh:2222", testProjectID)
	if err != nil {
		t.Fatalf("expected first dial to succeed: %v (resp=%v)", err, resp)
	}

	_, resp, err = dialRunnerStream(wsURL, "agent-cap", "ssh:2222", testProjectID)
	if err == nil {
		t.Fatal("expected the second concurrent dial to be rejected, but it succeeded")
	}
	if resp == nil || resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests, got resp=%v err=%v", resp, err)
	}

	first.Close()
	time.Sleep(100 * time.Millisecond) // let the server-side slot release unwind

	third, resp, err := dialRunnerStream(wsURL, "agent-cap", "ssh:2222", testProjectID)
	if err != nil {
		t.Fatalf("expected a dial after the slot was released to succeed: %v (resp=%v)", err, resp)
	}
	third.Close()
}

// TestStreamSlotReleasedOnEarlyError proves a dial that fails *after*
// acquiring its concurrency slot (the Agent rejects the service in its own
// ack, e.g. because it can't reach the local target it maps that service to)
// still releases the slot, so it doesn't leak and count against later dials.
// Cap is 1, so a leak here would make the second dial below fail too.
func TestStreamSlotReleasedOnEarlyError(t *testing.T) {
	httpURL, wsURL := newTestGateway(t, 1, 1<<20)
	token := pairAgent(t, httpURL, testProjectID)

	// The Gateway is told (via allowed_services) that ssh:2222 is declared,
	// so its own allowlist check passes and it acquires a slot — but the
	// Agent maps that service to an address nothing is listening on, so its
	// own local net.Dial fails and it acks back "ERR: ...", which the
	// Gateway treats as a rejection *after* the slot was already acquired.
	connectFakeAgent(t, httpURL, token, "agent-early-error", map[string]string{"ssh:2222": "127.0.0.1:1"})
	time.Sleep(50 * time.Millisecond)

	_, resp, err := dialRunnerStream(wsURL, "agent-early-error", "ssh:2222", testProjectID)
	if err == nil {
		t.Fatal("expected the dial to be rejected by the agent's own ack, but it succeeded")
	}
	if resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden (agent rejected its own local dial), got resp=%v err=%v", resp, err)
	}

	// A second dial for the same project, against the same unreachable
	// target, must fail the *same way* — 403 from the agent's own ack — not
	// 429 from the Gateway's concurrency cap (cap is 1). If the first dial's
	// slot had leaked, acquireStreamSlot would reject this one with 429
	// before ever reaching the agent; getting 403 again proves the slot was
	// available, i.e. correctly released.
	_, resp, err = dialRunnerStream(wsURL, "agent-early-error", "ssh:2222", testProjectID)
	if err == nil {
		t.Fatal("expected the second dial to also be rejected by the agent's own ack, but it succeeded")
	}
	if resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden again (proving the slot was released, not leaked as a 429), got resp=%v err=%v", resp, err)
	}
}

// TestGatewayEnforcesBytesPerSecRateLimit proves splice() actually throttles
// throughput to BytesPerSecPerProject rather than copying at line rate.
func TestGatewayEnforcesBytesPerSecRateLimit(t *testing.T) {
	const bytesPerSec = 200
	const payloadSize = 500 // burst(200) + 300 more => >= 300/200 = 1.5s minimum

	httpURL, wsURL := newTestGateway(t, 10, bytesPerSec)
	token := pairAgent(t, httpURL, testProjectID)

	payload := bytes.Repeat([]byte{'x'}, payloadSize)
	target := listenAndWrite(t, payload)
	connectFakeAgent(t, httpURL, token, "agent-rate", map[string]string{"ssh:2222": target})
	time.Sleep(50 * time.Millisecond)

	conn, resp, err := dialRunnerStream(wsURL, "agent-rate", "ssh:2222", testProjectID)
	if err != nil {
		t.Fatalf("dial: %v (resp=%v)", err, resp)
	}
	defer conn.Close()

	start := time.Now()
	got := make([]byte, 0, payloadSize)
	buf := make([]byte, 64)
	for len(got) < payloadSize {
		n, err := conn.Read(buf)
		got = append(got, buf[:n]...)
		if err != nil && len(got) < payloadSize {
			t.Fatalf("read %d/%d bytes then errored: %v", len(got), payloadSize, err)
		}
	}
	elapsed := time.Since(start)

	if !bytes.Equal(got, payload) {
		t.Fatalf("payload mismatch: got %d bytes, want %d", len(got), len(payload))
	}
	const minExpected = 1 * time.Second // generous floor well under the ~1.5s theoretical minimum, to avoid CI flakiness
	if elapsed < minExpected {
		t.Fatalf("expected the rate limit to make this transfer take at least %v, but it took %v", minExpected, elapsed)
	}
}

type recordedCallback struct {
	agentID string
	status  string
}

// fakeAPIServer stands in for apps/api's POST /api/internal/agents/{agentId}/callback
// endpoint, recording every call the Gateway makes so a test can assert on it.
func fakeAPIServer(t *testing.T) (url string, callbacks func() []recordedCallback) {
	t.Helper()
	var mu sync.Mutex
	var received []recordedCallback

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		agentID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/internal/agents/"), "/callback")
		var body struct {
			Status string `json:"status"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		mu.Lock()
		received = append(received, recordedCallback{agentID: agentID, status: body.Status})
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(srv.Close)

	return srv.URL, func() []recordedCallback {
		mu.Lock()
		defer mu.Unlock()
		out := make([]recordedCallback, len(received))
		copy(out, received)
		return out
	}
}

// waitForCallback polls callbacks() until one matching agentID/status shows
// up or timeout elapses, rather than a fixed sleep-and-hope.
func waitForCallback(t *testing.T, callbacks func() []recordedCallback, agentID, status string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		for _, cb := range callbacks() {
			if cb.agentID == agentID && cb.status == status {
				return
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out after %v waiting for a %s callback for agent %s; got %+v", timeout, status, agentID, callbacks())
}

// TestGatewayReportsDisconnectedOnSessionClose proves the Gateway notifies
// apps/api when an Agent's tunnel dies, closing the gap where
// paired_agents.status stayed ACTIVE forever after a real disconnect (see
// obsidian_memory/08.4's Phase 2 heartbeat/reconnect entry). Detection itself
// (yamux's keepalive) isn't exercised here — this test closes the fake
// Agent's session directly, which is the same CloseChan() signal a real dead
// tunnel produces.
func TestGatewayReportsDisconnectedOnSessionClose(t *testing.T) {
	apiURL, callbacks := fakeAPIServer(t)
	apiClient := apiclient.New(apiURL, testRunnerSecret)

	srv := server.New("https://www.infracanvas.dev/pair", apiClient, testRunnerSecret, 10, 1<<20)
	httpSrv := httptest.NewServer(srv.Mux())
	t.Cleanup(httpSrv.Close)

	token := pairAgent(t, httpSrv.URL, testProjectID)
	target := listenAndHold(t)
	fa := connectFakeAgent(t, httpSrv.URL, token, "agent-disconnect", map[string]string{"ssh:2222": target})

	waitForCallback(t, callbacks, "agent-disconnect", "ACTIVE", 2*time.Second)

	fa.session.Close() // simulate the tunnel dying, same signal yamux's own keepalive timeout produces

	waitForCallback(t, callbacks, "agent-disconnect", "DISCONNECTED", 2*time.Second)
}

// TestServerShutdownNotifiesAllConnectedAgents proves the fix for a real gap
// found via manual testing: stopping the Gateway process itself (not just an
// Agent's tunnel dying under a still-running Gateway) previously left every
// connected agent's paired_agents.status stuck at ACTIVE forever, since
// nothing was left alive to detect or report anything. Server.Shutdown is
// called from main.go's SIGTERM handler on a graceful stop; this test calls
// it directly to verify it notifies every currently-connected agent.
func TestServerShutdownNotifiesAllConnectedAgents(t *testing.T) {
	apiURL, callbacks := fakeAPIServer(t)
	apiClient := apiclient.New(apiURL, testRunnerSecret)

	srv := server.New("https://www.infracanvas.dev/pair", apiClient, testRunnerSecret, 10, 1<<20)
	httpSrv := httptest.NewServer(srv.Mux())
	t.Cleanup(httpSrv.Close)

	token1 := pairAgent(t, httpSrv.URL, testProjectID)
	target1 := listenAndHold(t)
	connectFakeAgent(t, httpSrv.URL, token1, "agent-shutdown-1", map[string]string{"ssh:2222": target1})
	waitForCallback(t, callbacks, "agent-shutdown-1", "ACTIVE", 2*time.Second)

	const otherProjectID = "proj_test_2"
	token2 := pairAgent(t, httpSrv.URL, otherProjectID)
	target2 := listenAndHold(t)
	connectFakeAgent(t, httpSrv.URL, token2, "agent-shutdown-2", map[string]string{"ssh:2222": target2})
	waitForCallback(t, callbacks, "agent-shutdown-2", "ACTIVE", 2*time.Second)

	srv.Shutdown()

	waitForCallback(t, callbacks, "agent-shutdown-1", "DISCONNECTED", 2*time.Second)
	waitForCallback(t, callbacks, "agent-shutdown-2", "DISCONNECTED", 2*time.Second)
}
