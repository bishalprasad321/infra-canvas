// Package apiclient is the Gateway's HTTP client back to apps/api. The Gateway
// never touches the database directly — apps/api is the single source of truth
// for pairing state (see obsidian_memory/08.4's Phase 1 design), so the only
// thing the Gateway does with agent status is report it here.
package apiclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client calls apps/api's internal agent-status callback endpoint.
type Client struct {
	APIBaseURL string
	Secret     string
	httpClient *http.Client
}

func New(apiBaseURL, secret string) *Client {
	return &Client{
		APIBaseURL: apiBaseURL,
		Secret:     secret,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// NotifyStatus reports an agent's tunnel status (ACTIVE once its WebSocket
// connects, DISCONNECTED once that session closes, REVOKED if the API should
// stop trusting it) so apps/api's paired_agents.status stays in sync with
// what the Gateway actually sees.
func (c *Client) NotifyStatus(agentID, status string) error {
	body, err := json.Marshal(map[string]string{"status": status})
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/internal/agents/%s/callback", c.APIBaseURL, agentID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gateway-Runner-Secret", c.Secret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("apiclient: notify status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		// Read the body (apps/api's http.Error responses carry the actual
		// failure reason, e.g. "Database error: ...") rather than discarding
		// it — a bare status code alone sent debugging a real failure down a
		// dead end once already (see obsidian_memory/07.2's SQLite-locking
		// incident this was found from). Capped so a misbehaving endpoint
		// can't make this balloon.
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("apiclient: notify status: unexpected response %d: %s", resp.StatusCode, respBody)
	}
	return nil
}

// RegisterToken persists a newly issued agent pairing token in apps/api so it
// still validates after this Gateway process restarts (see
// obsidian_memory/08.4's Phase 3 prerequisite — the Gateway's own
// pairing.Server only ever cached tokens in memory). Called once, right after
// pairing.Server.PollToken issues a token. Best-effort by design: a caller
// that fails to persist here still has the token cached in this process's
// own pairing.Server for as long as it stays up, so a persistence failure
// degrades restart-survival rather than breaking the pairing flow in front of
// the user.
func (c *Client) RegisterToken(token, projectID, agentID string) error {
	body, err := json.Marshal(map[string]string{
		"token":      token,
		"project_id": projectID,
		"agent_id":   agentID,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, c.APIBaseURL+"/api/internal/agent-tokens", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gateway-Runner-Secret", c.Secret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("apiclient: register token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("apiclient: register token: unexpected response %d: %s", resp.StatusCode, respBody)
	}
	return nil
}

// ValidateToken asks apps/api whether token is a live (issued, not revoked)
// agent pairing token, returning its scoped project_id if so. This is the
// fallback path handleAgentConnect takes when pairing.Server.LookupToken
// misses — i.e. exactly the case where this Gateway process didn't itself
// issue the token, most commonly because it restarted since the token was
// issued by an earlier process. found is false for a 404 (never issued, or
// revoked); a non-nil error means the check itself failed (network/API
// error), which callers should treat as "cannot confirm," not "confirmed
// invalid."
func (c *Client) ValidateToken(token string) (projectID string, found bool, err error) {
	body, err := json.Marshal(map[string]string{"token": token})
	if err != nil {
		return "", false, err
	}

	req, err := http.NewRequest(http.MethodPost, c.APIBaseURL+"/api/internal/agent-tokens/validate", bytes.NewReader(body))
	if err != nil {
		return "", false, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gateway-Runner-Secret", c.Secret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", false, fmt.Errorf("apiclient: validate token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "", false, nil
	}
	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", false, fmt.Errorf("apiclient: validate token: unexpected response %d: %s", resp.StatusCode, respBody)
	}

	var out struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", false, fmt.Errorf("apiclient: validate token: decode response: %w", err)
	}
	return out.ProjectID, true, nil
}
