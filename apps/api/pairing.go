package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"api/runner"
	"api/vault"
)

// Sandbox Agent pairing/registration handlers — Phase 1 opt-in beta.
// See obsidian_memory/08.4 (rollout plan) and 03.6 (bridging protocol).
//
// These handlers are only reachable when SANDBOX_AGENT_BETA=true (see the
// conditional route registration in main.go); the Gateway service
// (apps/agent-gateway) is the thing that actually terminates the Agent's
// outbound tunnel, and calls back into these endpoints over HTTP so this API
// stays the single source of truth for pairing state.

// gatewayRunnerSecret authenticates the Gateway's server-to-server callback
// and, indirectly, the "infracanvas sandbox proxy" ProxyCommand helper the
// Runner spawns — both present it as X-Gateway-Runner-Secret.
func gatewayRunnerSecret() string {
	return os.Getenv("GATEWAY_RUNNER_SECRET")
}

// POST /api/projects/{id}/agents/register
// Called by `infracanvas sandbox up` once the CLI has generated a
// per-installation keypair and baked the public half into the local sandbox
// SSH containers. The private half is uploaded once, over this already
// project-authenticated channel, and stored encrypted — never as a bare file
// server-side — exactly like the existing SSH cloud_credentials flow.
func handleRegisterAgent(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	user, ok := GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		AgentID       string `json:"agent_id"`
		Name          string `json:"name"`
		PublicKey     string `json:"public_key"`
		PrivateKeyPEM string `json:"private_key_pem"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload: "+err.Error(), http.StatusBadRequest)
		return
	}
	if payload.AgentID == "" || payload.PublicKey == "" || payload.PrivateKeyPEM == "" {
		http.Error(w, "Missing agent_id, public_key, or private_key_pem in payload", http.StatusBadRequest)
		return
	}
	if payload.Name == "" {
		payload.Name = payload.AgentID
	}

	cipherText, nonce, authTag, err := vault.Encrypt([]byte(payload.PrivateKeyPEM))
	if err != nil {
		http.Error(w, "Vault encryption failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	fingerprint := vault.Fingerprint("SSH", []byte(payload.PrivateKeyPEM))

	recordID := generateUUID()
	_, err = db.Exec(`INSERT INTO paired_agents
		(id, project_id, agent_id, name, public_key, encrypted_private_key, nonce, auth_tag, key_fingerprint, status, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
		recordID, projectID, payload.AgentID, payload.Name, payload.PublicKey, cipherText, nonce, authTag, fingerprint, user.ID)
	if err != nil {
		if isUniqueConstraintErr(err) {
			http.Error(w, "An agent with this agent_id is already registered", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to register agent: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"id":              recordID,
		"agent_id":        payload.AgentID,
		"status":          "PENDING",
		"key_fingerprint": fingerprint,
	})
}

// POST /api/projects/{id}/agents/pair
// Approves a pending device-authorization pairing request on the Gateway.
// `infracanvas sandbox up` calls this with the user_code it printed from the
// Gateway's /device/code response, immediately after requesting it — this API
// call is the RBAC check (RequireProjectRole("EDITOR") below) that stands in
// for the browser approval step described in obsidian_memory/06.3, so pairing
// stays fully scriptable in this beta without a dedicated frontend page.
func handlePairAgent(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	var payload struct {
		UserCode string `json:"user_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload: "+err.Error(), http.StatusBadRequest)
		return
	}
	if payload.UserCode == "" {
		http.Error(w, "Missing user_code in payload", http.StatusBadRequest)
		return
	}

	if err := approveAgentPairing(payload.UserCode, projectID); err != nil {
		http.Error(w, "Failed to approve pairing: "+err.Error(), http.StatusBadGateway)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// approveAgentPairing calls the Agent Gateway's internal-only /device/approve
// endpoint (see apps/agent-gateway/internal/server), authenticated with the
// same shared secret used for /runner/dial and the status callback.
func approveAgentPairing(userCode, projectID string) error {
	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:9090"
	}

	body, err := json.Marshal(map[string]string{
		"user_code":  userCode,
		"project_id": projectID,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, gatewayURL+"/device/approve", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gateway-Runner-Secret", gatewayRunnerSecret())

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("gateway returned status %d", resp.StatusCode)
	}
	return nil
}

// GET /api/projects/{id}/agents/{agentId}
// Polled by `infracanvas sandbox up` (waiting for PENDING -> ACTIVE) and
// `infracanvas sandbox status`.
func handleGetAgentStatus(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	agentID := r.PathValue("agentId")

	var name, status, fingerprint string
	var registeredAt string
	var lastSeenAt sql.NullString
	err := db.QueryRow(`SELECT name, status, key_fingerprint, registered_at, last_seen_at
		FROM paired_agents WHERE project_id = ? AND agent_id = ?`, projectID, agentID).
		Scan(&name, &status, &fingerprint, &registeredAt, &lastSeenAt)
	if err == sql.ErrNoRows {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp := map[string]interface{}{
		"agent_id":        agentID,
		"name":            name,
		"status":          status,
		"key_fingerprint": fingerprint,
		"registered_at":   registeredAt,
	}
	if lastSeenAt.Valid {
		resp["last_seen_at"] = lastSeenAt.String
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// POST /api/internal/agents/{agentId}/callback
// Called by the Agent Gateway (not a browser/CLI client) once an Agent's
// tunnel actually connects, authenticated via the shared X-Gateway-Runner-Secret
// rather than a user JWT — the Gateway has no concept of InfraCanvas user
// sessions. This is a deliberately minimal, known Phase-1 auth boundary; see
// apps/agent-gateway/README.md.
func handleAgentStatusCallback(w http.ResponseWriter, r *http.Request) {
	secret := gatewayRunnerSecret()
	if secret == "" || r.Header.Get("X-Gateway-Runner-Secret") != secret {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	agentID := r.PathValue("agentId")
	var payload struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload: "+err.Error(), http.StatusBadRequest)
		return
	}
	if payload.Status != "ACTIVE" && payload.Status != "REVOKED" {
		http.Error(w, "status must be ACTIVE or REVOKED", http.StatusBadRequest)
		return
	}

	res, err := db.Exec(`UPDATE paired_agents SET status = ?, last_seen_at = datetime('now') WHERE agent_id = ?`,
		payload.Status, agentID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// resolvePairedAgent looks up the active paired agent for a project (if any)
// and decrypts its private key, returning an *runner.AgentContext for
// RunPipeline. Returns nil whenever the beta flag is off, no agent is paired,
// or decryption fails — callers treat nil exactly like "no local_agent
// target", falling back to the existing live/docker behavior untouched.
func resolvePairedAgent(projectID string) *runner.AgentContext {
	if os.Getenv("SANDBOX_AGENT_BETA") != "true" {
		return nil
	}

	var agentID string
	var cipherText, nonce, authTag []byte
	err := db.QueryRow(`SELECT agent_id, encrypted_private_key, nonce, auth_tag
		FROM paired_agents WHERE project_id = ? AND status = 'ACTIVE'
		ORDER BY registered_at DESC LIMIT 1`, projectID).
		Scan(&agentID, &cipherText, &nonce, &authTag)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Printf("[SANDBOX AGENT] Failed to look up paired agent for project %s: %v\n", projectID, err)
		}
		return nil
	}

	plainText, err := vault.Decrypt(cipherText, nonce, authTag)
	if err != nil {
		log.Printf("[SANDBOX AGENT] Failed to decrypt agent key for project %s: %v\n", projectID, err)
		return nil
	}

	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:9090"
	}

	return &runner.AgentContext{
		AgentID:       agentID,
		GatewayURL:    gatewayURL,
		PrivateKeyPEM: string(plainText),
	}
}

func isUniqueConstraintErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}
