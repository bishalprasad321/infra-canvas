// Package apiclient is the Gateway's HTTP client back to apps/api. The Gateway
// never touches the database directly — apps/api is the single source of truth
// for pairing state (see obsidian_memory/08.4's Phase 1 design), so the only
// thing the Gateway does with agent status is report it here.
package apiclient

import (
	"bytes"
	"encoding/json"
	"fmt"
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
// connects, REVOKED if the API should stop trusting it) so apps/api's
// paired_agents.status stays in sync with what the Gateway actually sees.
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
		return fmt.Errorf("apiclient: notify status: unexpected response %d", resp.StatusCode)
	}
	return nil
}
