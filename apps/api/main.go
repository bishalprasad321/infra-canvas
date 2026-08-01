package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"api/runner"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type PipelineRun struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"` // PENDING, RUNNING, SUCCESS, FAILED
	Logs      string    `json:"logs"`
	Canvas    string    `json:"canvas"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type RunTracker struct {
	sync.Mutex
	clients      map[*websocket.Conn]bool
	logs         string
	status       string
	nodeStatuses map[string]string // nodeId → latest status; replayed to late-connecting WS clients
}

var (
	db             *sql.DB
	upgrader       = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	trackers       = make(map[string]*RunTracker)
	trackersMutex  sync.Mutex
)

func main() {
	log.Println("===================================================")
	log.Println("  InfraCanvas Runner Go Backend Initialization   ")
	log.Println("===================================================")

	// Ensure the db folder exists
	dbDir := "/app/data"
	if os.Getenv("IS_DOCKER") != "true" {
		dbDir = "./data"
	}
	_ = os.MkdirAll(dbDir, 0755)

	dbPath := filepath.Join(dbDir, "dev.db")
	log.Printf("[DB] Connecting to sqlite at %s\n", dbPath)

	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("[DB] Failed to open database: %v\n", err)
	}
	defer db.Close()

	// Create table if not exists
	schemaQuery := `
	CREATE TABLE IF NOT EXISTS pipeline_runs (
		id TEXT PRIMARY KEY,
		status TEXT NOT NULL,
		logs TEXT NOT NULL,
		canvas TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS teams (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		slug TEXT UNIQUE NOT NULL,
		owner_id TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
	);
	CREATE TABLE IF NOT EXISTS team_members (
		id TEXT PRIMARY KEY,
		team_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
		joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(team_id, user_id),
		FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		team_id TEXT NOT NULL,
		name TEXT NOT NULL,
		description TEXT,
		visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'TEAM', 'PUBLIC')),
		created_by TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
		FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
	);
	CREATE TABLE IF NOT EXISTS project_members (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
		added_by TEXT NOT NULL,
		joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(project_id, user_id),
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE TABLE IF NOT EXISTS project_join_requests (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
		note TEXT,
		reviewed_by TEXT,
		requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		reviewed_at DATETIME,
		UNIQUE(project_id, user_id, status),
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE TABLE IF NOT EXISTS invitations (
		id TEXT PRIMARY KEY,
		team_id TEXT NOT NULL,
		project_id TEXT,
		email TEXT NOT NULL,
		role TEXT NOT NULL,
		token TEXT UNIQUE NOT NULL,
		status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
		invited_by TEXT NOT NULL,
		expires_at DATETIME NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
		FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE TABLE IF NOT EXISTS canvas_states (
		project_id TEXT PRIMARY KEY,
		version INTEGER NOT NULL DEFAULT 1,
		nodes_json TEXT NOT NULL,
		edges_json TEXT NOT NULL,
		viewport_json TEXT NOT NULL,
		updated_by TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
	);
	CREATE TABLE IF NOT EXISTS canvas_snapshots (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		version INTEGER NOT NULL,
		commit_message TEXT,
		nodes_json TEXT NOT NULL,
		edges_json TEXT NOT NULL,
		created_by TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
	);`
	if _, err := db.Exec(schemaQuery); err != nil {
		log.Fatalf("[DB] Failed to initialize schema: %v\n", err)
	}
	// Run migrations to alter existing pipeline_runs table columns safely
	_, _ = db.Exec("ALTER TABLE pipeline_runs ADD COLUMN project_id TEXT;")
	_, _ = db.Exec("ALTER TABLE pipeline_runs ADD COLUMN user_id TEXT;")
	log.Println("[DB] Database initialized successfully.")

	// Set up routing
	mux := http.NewServeMux()

	// API Routes
	mux.Handle("GET /api/projects/{id}/runs", AuthMiddleware(RequireProjectRole("VIEWER")(http.HandlerFunc(handleGetRuns))))
	mux.HandleFunc("GET /api/runs/{id}", enableCORS(handleGetRunByID))
	mux.Handle("POST /api/projects/{id}/deploy", AuthMiddleware(RequireProjectRole("EDITOR")(http.HandlerFunc(handleDeploy))))
	mux.Handle("POST /api/projects/{id}/destroy", AuthMiddleware(RequireProjectRole("EDITOR")(http.HandlerFunc(handleDestroy))))
	mux.HandleFunc("/api/ws/runs/{id}", handleWebSocket)

	// Auth & Workspace Sync Routes
	mux.HandleFunc("POST /api/auth/signup", enableCORS(handleSignup))
	mux.HandleFunc("POST /api/auth/login", enableCORS(handleLogin))
	mux.Handle("GET /api/auth/me", AuthMiddleware(http.HandlerFunc(handleMe)))
	mux.HandleFunc("GET /api/workspace/{projectId}/sync", handleWorkspaceWebSocketSync)

	// Team Routes
	mux.Handle("GET /api/teams", AuthMiddleware(http.HandlerFunc(handleGetTeams)))
	mux.Handle("POST /api/teams", AuthMiddleware(http.HandlerFunc(handleCreateTeam)))

	// Project Routes
	mux.Handle("GET /api/projects", AuthMiddleware(http.HandlerFunc(handleGetProjects)))
	mux.Handle("POST /api/projects", AuthMiddleware(http.HandlerFunc(handleCreateProject)))
	mux.Handle("GET /api/projects/{id}", AuthMiddleware(http.HandlerFunc(handleGetProjectByID)))
	mux.Handle("PATCH /api/projects/{id}", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleUpdateProject))))
	mux.Handle("DELETE /api/projects/{id}", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleDeleteProject))))
	mux.Handle("GET /api/projects/{id}/canvas", AuthMiddleware(RequireProjectRole("VIEWER")(http.HandlerFunc(handleGetCanvasState))))
	mux.Handle("PUT /api/projects/{id}/canvas", AuthMiddleware(RequireProjectRole("EDITOR")(http.HandlerFunc(handleUpdateCanvasState))))
	mux.Handle("GET /api/projects/{id}/members", AuthMiddleware(RequireProjectRole("VIEWER")(http.HandlerFunc(handleGetProjectMembers))))
	mux.Handle("POST /api/projects/{id}/members", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleAddProjectMember))))
	mux.Handle("PUT /api/projects/{id}/members/{userId}", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleUpdateProjectMemberRole))))
	mux.Handle("DELETE /api/projects/{id}/members/{userId}", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleRemoveProjectMember))))

	// Join Requests
	mux.Handle("POST /api/projects/{id}/join-request", AuthMiddleware(http.HandlerFunc(handleCreateJoinRequest)))
	mux.Handle("GET /api/projects/{id}/join-requests", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleGetJoinRequests))))
	mux.Handle("POST /api/projects/{id}/join-requests/{reqId}/approve", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleApproveJoinRequest))))
	mux.Handle("POST /api/projects/{id}/join-requests/{reqId}/reject", AuthMiddleware(RequireProjectRole("ADMIN")(http.HandlerFunc(handleRejectJoinRequest))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[SERVER] Listening on port %s\n", port)
	if err := http.ListenAndServe(":"+port, CORSWrapper(mux)); err != nil {
		log.Fatalf("[SERVER] ListenAndServe failed: %v\n", err)
	}
}

// CORSWrapper handles CORS for all incoming API routes and intercepts OPTIONS preflight requests
func CORSWrapper(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// CORS Helper middleware
func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func handleOptions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.WriteHeader(http.StatusOK)
}

func handleGetRuns(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	rows, err := db.Query("SELECT id, status, logs, canvas, created_at, updated_at FROM pipeline_runs WHERE project_id = ? ORDER BY created_at DESC", projectID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	runs := []PipelineRun{}
	for rows.Next() {
		var run PipelineRun
		var createdStr, updatedStr string
		err := rows.Scan(&run.ID, &run.Status, &run.Logs, &run.Canvas, &createdStr, &updatedStr)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		run.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", strings.Replace(createdStr, "T", " ", 1))
		run.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", strings.Replace(updatedStr, "T", " ", 1))
		runs = append(runs, run)
	}
	if err = rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(runs)
}

func handleGetRunByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "Missing run ID", http.StatusBadRequest)
		return
	}

	row := db.QueryRow("SELECT id, status, logs, canvas, created_at, updated_at FROM pipeline_runs WHERE id = ?", id)
	var run PipelineRun
	var createdStr, updatedStr string
	err := row.Scan(&run.ID, &run.Status, &run.Logs, &run.Canvas, &createdStr, &updatedStr)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Run not found"})
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	run.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", strings.Replace(createdStr, "T", " ", 1))
	run.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", strings.Replace(updatedStr, "T", " ", 1))

	trackersMutex.Lock()
	tracker, active := trackers[id]
	trackersMutex.Unlock()

	if active {
		tracker.Lock()
		run.Logs = tracker.logs
		tracker.Unlock()
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(run)
}

type DeployPayload struct {
	Canvas      interface{}       `json:"canvas"`
	Files       []runner.FileItem `json:"files"`
	AutoDestroy bool              `json:"autoDestroy"`
}

func handleDeploy(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	user, _ := GetUserFromContext(r)

	var payload DeployPayload
	err := json.NewDecoder(r.Body).Decode(&payload)
	if err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	canvasBytes, err := json.Marshal(payload.Canvas)
	if err != nil {
		http.Error(w, "Invalid canvas format", http.StatusBadRequest)
		return
	}
	canvasStr := string(canvasBytes)

	runID := generateUUID()

	// Insert into DB as PENDING
	insertQuery := "INSERT INTO pipeline_runs (id, project_id, user_id, status, logs, canvas, created_at, updated_at) VALUES (?, ?, ?, 'PENDING', '', ?, datetime('now'), datetime('now'))"
	_, err = db.Exec(insertQuery, runID, projectID, user.ID, canvasStr)
	if err != nil {
		log.Printf("[DB] Error inserting new run %s: %v\n", runID, err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Initialize tracker
	tracker := &RunTracker{
		clients:      make(map[*websocket.Conn]bool),
		status:       "PENDING",
		nodeStatuses: make(map[string]string),
	}
	trackersMutex.Lock()
	trackers[runID] = tracker
	trackersMutex.Unlock()

	// Respond to client
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"runId":  runID,
		"status": "PENDING",
	})

	// Run pipeline asynchronously
	go func() {
		// Set status to RUNNING
		_, _ = db.Exec("UPDATE pipeline_runs SET status = 'RUNNING', updated_at = datetime('now') WHERE id = ?", runID)
		tracker.Lock()
		tracker.status = "RUNNING"
		tracker.Unlock()
		broadcastToTracker(runID, "status_change", "RUNNING")

		logChan := make(chan string, 100)

		// Goroutine to broadcast log stream from channel to WS clients
		go func() {
			for msg := range logChan {
				tracker.Lock()
				tracker.logs += msg
				tracker.Unlock()
				broadcastToTracker(runID, "log", msg)
			}
		}()

		// Start executing runner
		runner.RunPipeline(runID, canvasStr, payload.Files, "deploy", payload.AutoDestroy, logChan, func(nodeId, status string) {
			broadcastNodeStatus(runID, nodeId, status)
		}, func(status string) {
			broadcastToTracker(runID, "status_change", status)
		}, func(finalStatus string, logs string) {
			tracker.Lock()
			finalLogs := tracker.logs
			tracker.Unlock()

			// Complete execution: commit to DB
			_, err = db.Exec("UPDATE pipeline_runs SET status = ?, logs = ?, updated_at = datetime('now') WHERE id = ?", finalStatus, finalLogs, runID)
			if err != nil {
				log.Printf("[DB] Error updating run %s: %v\n", runID, err)
			}

			// Broadcast status change
			tracker.Lock()
			tracker.status = finalStatus
			tracker.Unlock()
			broadcastToTracker(runID, "status_change", finalStatus)

			// Clean up tracker after short delay to let WS clients finish reading
			time.AfterFunc(2*time.Second, func() {
				trackersMutex.Lock()
				t, exists := trackers[runID]
				if exists {
					t.Lock()
					for client := range t.clients {
						_ = client.Close()
					}
					t.Unlock()
					delete(trackers, runID)
				}
				trackersMutex.Unlock()
			})

			log.Printf("[RUNNER] Pipeline run %s completed with status: %s\n", runID, finalStatus)
		})
	}()
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "Missing run ID", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade failed for %s: %v\n", id, err)
		return
	}

	log.Printf("[WS] Client connected for run %s\n", id)

	trackersMutex.Lock()
	tracker, active := trackers[id]
	trackersMutex.Unlock()

	if active {
		tracker.Lock()
		// Register client
		tracker.clients[conn] = true
		// Write existing logs to catch up
		if tracker.logs != "" {
			_ = conn.WriteJSON(map[string]string{
				"type":    "log",
				"message": tracker.logs,
			})
		}
		// Send current status
		_ = conn.WriteJSON(map[string]string{
			"type":   "status_change",
			"status": tracker.status,
		})
		// Replay all node statuses so late-connecting clients get current per-node state
		for nodeId, nodeStatus := range tracker.nodeStatuses {
			_ = conn.WriteJSON(map[string]string{
				"type":   "node_status",
				"nodeId": nodeId,
				"status": nodeStatus,
			})
		}
		tracker.Unlock()

		// Read loop to detect disconnects
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					tracker.Lock()
					delete(tracker.clients, conn)
					tracker.Unlock()
					_ = conn.Close()
					log.Printf("[WS] Client disconnected from run %s\n", id)
					break
				}
			}
		}()
	} else {
		// Read historical log from database
		var status, logs string
		err := db.QueryRow("SELECT status, logs FROM pipeline_runs WHERE id = ?", id).Scan(&status, &logs)
		if err == nil {
			// Send historical logs and close connection immediately
			_ = conn.WriteJSON(map[string]string{
				"type":    "log",
				"message": logs,
			})
			_ = conn.WriteJSON(map[string]string{
				"type":   "status_change",
				"status": status,
			})
		}
		_ = conn.Close()
	}
}

func broadcastNodeStatus(runID, nodeId, status string) {
	trackersMutex.Lock()
	tracker, exists := trackers[runID]
	trackersMutex.Unlock()
	if !exists {
		return
	}
	tracker.Lock()
	defer tracker.Unlock()
	tracker.nodeStatuses[nodeId] = status // persist so late-connecting WS clients can catch up
	payload := map[string]string{
		"type":   "node_status",
		"nodeId": nodeId,
		"status": status,
	}
	for client := range tracker.clients {
		if err := client.WriteJSON(payload); err != nil {
			log.Printf("[WS] Node status broadcast error: %v\n", err)
			_ = client.Close()
			delete(tracker.clients, client)
		}
	}
}

func broadcastToTracker(runID string, msgType string, content string) {
	trackersMutex.Lock()
	tracker, exists := trackers[runID]
	trackersMutex.Unlock()

	if !exists {
		return
	}

	tracker.Lock()
	defer tracker.Unlock()

	payload := map[string]string{
		"type": msgType,
	}
	if msgType == "status_change" {
		payload["status"] = content
	} else {
		payload["message"] = content
	}

	for client := range tracker.clients {
		err := client.WriteJSON(payload)
		if err != nil {
			log.Printf("[WS] Broadcast error: %v\n", err)
			_ = client.Close()
			delete(tracker.clients, client)
		}
	}
}

func generateUUID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "run-random-id"
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func handleDestroy(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	user, _ := GetUserFromContext(r)

	var payload struct {
		Canvas interface{} `json:"canvas"`
	}
	err := json.NewDecoder(r.Body).Decode(&payload)
	if err != nil {
		http.Error(w, "Invalid request payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	canvasBytes, err := json.Marshal(payload.Canvas)
	if err != nil {
		http.Error(w, "Invalid canvas format", http.StatusBadRequest)
		return
	}
	canvasStr := string(canvasBytes)

	runID := generateUUID()

	// Insert into DB as PENDING
	insertQuery := "INSERT INTO pipeline_runs (id, project_id, user_id, status, logs, canvas, created_at, updated_at) VALUES (?, ?, ?, 'PENDING', '', ?, datetime('now'), datetime('now'))"
	_, err = db.Exec(insertQuery, runID, projectID, user.ID, canvasStr)
	if err != nil {
		log.Printf("[DB] Error inserting destroy run %s: %v\n", runID, err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Initialize tracker
	tracker := &RunTracker{
		clients:      make(map[*websocket.Conn]bool),
		status:       "PENDING",
		nodeStatuses: make(map[string]string),
	}
	trackersMutex.Lock()
	trackers[runID] = tracker
	trackersMutex.Unlock()

	// Respond to client
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"runId":  runID,
		"status": "PENDING",
	})

	// Run destroy pipeline asynchronously
	go func() {
		_, _ = db.Exec("UPDATE pipeline_runs SET status = 'RUNNING', updated_at = datetime('now') WHERE id = ?", runID)
		tracker.Lock()
		tracker.status = "RUNNING"
		tracker.Unlock()
		broadcastToTracker(runID, "status_change", "RUNNING")

		logChan := make(chan string, 100)

		go func() {
			for msg := range logChan {
				tracker.Lock()
				tracker.logs += msg
				tracker.Unlock()
				broadcastToTracker(runID, "log", msg)
			}
		}()

		runner.RunPipeline(runID, canvasStr, nil, "destroy", false, logChan, func(nodeId, status string) {
			broadcastNodeStatus(runID, nodeId, status)
		}, nil, func(finalStatus string, logs string) {
			tracker.Lock()
			finalLogs := tracker.logs
			tracker.Unlock()

			_, err = db.Exec("UPDATE pipeline_runs SET status = ?, logs = ?, updated_at = datetime('now') WHERE id = ?", finalStatus, finalLogs, runID)
			if err != nil {
				log.Printf("[DB] Error updating destroy run %s: %v\n", runID, err)
			}

			tracker.Lock()
			tracker.status = finalStatus
			tracker.Unlock()
			broadcastToTracker(runID, "status_change", finalStatus)

			time.AfterFunc(2*time.Second, func() {
				trackersMutex.Lock()
				t, exists := trackers[runID]
				if exists {
					t.Lock()
					for client := range t.clients {
						_ = client.Close()
					}
					t.Unlock()
					delete(trackers, runID)
				}
				trackersMutex.Unlock()
			})
		})
	}()
}

// --- AUTHENTICATION & COLLABORATION STACK IMPLEMENTATION ---

var jwtSecret = []byte("infracanvas_workspace_orchestration_secret_key_98765!")

type TokenHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

type TokenClaims struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Exp   int64  `json:"exp"`
}

func GenerateToken(userID, email, name string) (string, error) {
	header := TokenHeader{Alg: "HS256", Typ: "JWT"}
	headerJSON, _ := json.Marshal(header)
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	claims := TokenClaims{
		ID:    userID,
		Email: email,
		Name:  name,
		Exp:   time.Now().Add(24 * time.Hour).Unix(),
	}
	claimsJSON, _ := json.Marshal(claims)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)

	unsignedToken := headerB64 + "." + claimsB64

	mac := hmac.New(sha256.New, jwtSecret)
	mac.Write([]byte(unsignedToken))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return unsignedToken + "." + signature, nil
}

func VerifyToken(tokenStr string) (*TokenClaims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	unsignedToken := parts[0] + "." + parts[1]
	signatureB64 := parts[2]

	mac := hmac.New(sha256.New, jwtSecret)
	mac.Write([]byte(unsignedToken))
	expectedSignature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if signatureB64 != expectedSignature {
		return nil, fmt.Errorf("signature verification failed")
	}

	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode claims: %v", err)
	}

	var claims TokenClaims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return nil, fmt.Errorf("failed to unmarshal claims: %v", err)
	}

	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token has expired")
	}

	return &claims, nil
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func handleSignup(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(strings.ToLower(payload.Email))
	name := strings.TrimSpace(payload.Name)
	if email == "" || payload.Password == "" || name == "" {
		http.Error(w, "Email, password, and name are required", http.StatusBadRequest)
		return
	}

	hash, err := hashPassword(payload.Password)
	if err != nil {
		http.Error(w, "Failed to secure password: "+err.Error(), http.StatusInternalServerError)
		return
	}

	userID := fmt.Sprintf("usr_%d", time.Now().UnixNano())

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Transaction failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	insertQuery := "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)"
	_, err = tx.Exec(insertQuery, userID, email, hash, name)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, "Email already exists", http.StatusConflict)
		} else {
			http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// Create default personal team
	teamID := fmt.Sprintf("team_%d", time.Now().UnixNano())
	slug := "personal-" + userID
	_, err = tx.Exec("INSERT INTO teams (id, name, slug, owner_id) VALUES (?, ?, ?, ?)", teamID, name+"'s Personal Workspace", slug, userID)
	if err != nil {
		http.Error(w, "Failed to create personal team: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Add membership
	tmemID := fmt.Sprintf("tmem_%d", time.Now().UnixNano())
	_, err = tx.Exec("INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, ?)", tmemID, teamID, userID, "OWNER")
	if err != nil {
		http.Error(w, "Failed to join personal team: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to finalize registration: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"id":    userID,
		"email": email,
		"name":  name,
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload: "+err.Error(), http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(strings.ToLower(payload.Email))
	if email == "" || payload.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	var userID, name, hash string
	err := db.QueryRow("SELECT id, name, password_hash FROM users WHERE email = ?", email).Scan(&userID, &name, &hash)
	if err == sql.ErrNoRows {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	} else if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !checkPasswordHash(payload.Password, hash) {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	token, err := GenerateToken(userID, email, name)
	if err != nil {
		http.Error(w, "Failed to sign token: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user": map[string]string{
			"id":    userID,
			"email": email,
			"name":  name,
		},
	})
}

// --- WebSocket Workspace Sync Server ---

type SyncMessage struct {
	Type       string          `json:"type"` // "cursor", "change", "edit", "join", "leave", "init"
	ProjectID  string          `json:"projectId,omitempty"`
	SenderID   string          `json:"senderId,omitempty"`
	SenderName string          `json:"senderName,omitempty"`
	Color      string          `json:"color,omitempty"`
	Payload    json.RawMessage `json:"payload,omitempty"`
}

type SyncClient struct {
	conn     *websocket.Conn
	roomID   string
	userID   string
	userName string
	color    string
}

type WorkspaceRoom struct {
	sync.RWMutex
	clients map[*websocket.Conn]*SyncClient
}

var (
	rooms      = make(map[string]*WorkspaceRoom)
	roomsMutex sync.Mutex
)

var tailwindColors = []string{
	"#F43F5E", // rose-500
	"#EC4899", // pink-500
	"#D946EF", // fuchsia-500
	"#A855F7", // purple-500
	"#6366F1", // indigo-500
	"#3B82F6", // blue-500
	"#0EA5E9", // sky-500
	"#06B6D4", // cyan-500
	"#14B8A6", // teal-500
	"#10B981", // emerald-500
	"#22C55E", // green-500
	"#84CC16", // lime-500
	"#EAB308", // yellow-500
	"#F97316", // orange-500
}

func getRandomColor(seed string) string {
	sum := 0
	for _, char := range seed {
		sum += int(char)
	}
	return tailwindColors[sum%len(tailwindColors)]
}

func handleWorkspaceWebSocketSync(w http.ResponseWriter, r *http.Request) {
	// Parse projectId from URL path wildcards
	projectId := r.PathValue("projectId")
	if projectId == "" {
		http.Error(w, "ProjectId is required", http.StatusBadRequest)
		return
	}

	// Authenticate via token query parameter
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		http.Error(w, "Authorization token is required", http.StatusUnauthorized)
		return
	}

	claims, err := VerifyToken(tokenStr)
	if err != nil {
		http.Error(w, "Unauthorized token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// Upgrade the connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[SYNC] Failed to upgrade WebSocket connection: %v\n", err)
		return
	}
	defer conn.Close()

	// Register the client in the room
	roomsMutex.Lock()
	room, exists := rooms[projectId]
	if !exists {
		room = &WorkspaceRoom{
			clients: make(map[*websocket.Conn]*SyncClient),
		}
		rooms[projectId] = room
	}
	roomsMutex.Unlock()

	clientColor := getRandomColor(claims.ID)
	client := &SyncClient{
		conn:     conn,
		roomID:   projectId,
		userID:   claims.ID,
		userName: claims.Name,
		color:    clientColor,
	}

	room.Lock()
	room.clients[conn] = client
	
	// Create active users user list to send back as an initialization
	activeUsersList := make([]map[string]string, 0)
	for _, c := range room.clients {
		activeUsersList = append(activeUsersList, map[string]string{
			"id":   c.userID,
			"name": c.userName,
			"color": c.color,
		})
	}
	room.Unlock()

	log.Printf("[SYNC] User %s joined workspace %s\n", claims.Name, projectId)

	// Send initial list of active users to the new client
	initPayload, _ := json.Marshal(activeUsersList)
	_ = conn.WriteJSON(SyncMessage{
		Type:       "init",
		ProjectID:  projectId,
		SenderID:   client.userID,
		SenderName: client.userName,
		Color:      client.color,
		Payload:    initPayload,
	})

	// Broadcast JOIN to all other clients in the room
	joinMsg := SyncMessage{
		Type:       "join",
		ProjectID:  projectId,
		SenderID:   client.userID,
		SenderName: client.userName,
		Color:      client.color,
		Payload:    initPayload, // send current list of members
	}
	broadcastToRoom(projectId, joinMsg, conn)

	// Read loop
	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg SyncMessage
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			continue
		}

		// Fill system metadata details
		msg.SenderID = client.userID
		msg.SenderName = client.userName
		msg.Color = client.color
		msg.ProjectID = projectId

		// Relay message to all other clients in the room
		broadcastToRoom(projectId, msg, conn)
	}

	// Unregister client
	room.Lock()
	delete(room.clients, conn)
	
	// Re-compile active users user list post-exit
	remainingUsers := make([]map[string]string, 0)
	for _, c := range room.clients {
		remainingUsers = append(remainingUsers, map[string]string{
			"id":   c.userID,
			"name": c.userName,
			"color": c.color,
		})
	}
	room.Unlock()

	log.Printf("[SYNC] User %s left workspace %s\n", claims.Name, projectId)

	// Broadcast LEAVE to all other clients in the room
	leavePayload, _ := json.Marshal(remainingUsers)
	leaveMsg := SyncMessage{
		Type:       "leave",
		ProjectID:  projectId,
		SenderID:   client.userID,
		SenderName: client.userName,
		Payload:    leavePayload,
	}
	broadcastToRoom(projectId, leaveMsg, nil)
}

func broadcastToRoom(roomID string, msg SyncMessage, senderConn *websocket.Conn) {
	roomsMutex.Lock()
	room, exists := rooms[roomID]
	roomsMutex.Unlock()

	if !exists {
		return
	}

	room.RLock()
	defer room.RUnlock()

	for conn := range room.clients {
		if conn == senderConn {
			// Do not loopback message to the sender
			continue
		}
		_ = conn.WriteJSON(msg)
	}
}
