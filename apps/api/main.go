package main

import (
	"crypto/rand"
	"database/sql"
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
	clients map[*websocket.Conn]bool
	logs    string
	status  string
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
	);`
	if _, err := db.Exec(schemaQuery); err != nil {
		log.Fatalf("[DB] Failed to initialize schema: %v\n", err)
	}
	log.Println("[DB] Database initialized successfully.")

	// Set up routing
	mux := http.NewServeMux()

	// API Routes
	mux.HandleFunc("GET /api/runs", enableCORS(handleGetRuns))
	mux.HandleFunc("GET /api/runs/{id}", enableCORS(handleGetRunByID))
	mux.HandleFunc("POST /api/deploy", enableCORS(handleDeploy))
	mux.HandleFunc("/api/ws/runs/{id}", handleWebSocket)

	// Fallback/options endpoint for preflight requests
	mux.HandleFunc("OPTIONS /api/deploy", handleOptions)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[SERVER] Listening on port %s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("[SERVER] ListenAndServe failed: %v\n", err)
	}
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
	rows, err := db.Query("SELECT id, status, logs, canvas, created_at, updated_at FROM pipeline_runs ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var runs []PipelineRun
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

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(run)
}

type DeployPayload struct {
	Canvas interface{}        `json:"canvas"`
	Files  []runner.FileItem `json:"files"`
}

func handleDeploy(w http.ResponseWriter, r *http.Request) {
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
	insertQuery := "INSERT INTO pipeline_runs (id, status, logs, canvas, created_at, updated_at) VALUES (?, 'PENDING', '', ?, datetime('now'), datetime('now'))"
	_, err = db.Exec(insertQuery, runID, canvasStr)
	if err != nil {
		log.Printf("[DB] Error inserting new run %s: %v\n", runID, err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Initialize tracker
	tracker := &RunTracker{
		clients: make(map[*websocket.Conn]bool),
		status:  "PENDING",
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
		runner.RunPipeline(runID, canvasStr, payload.Files, logChan, func(finalStatus string, logs string) {
			// Complete execution: commit to DB
			_, err = db.Exec("UPDATE pipeline_runs SET status = ?, logs = ?, updated_at = datetime('now') WHERE id = ?", finalStatus, logs, runID)
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
