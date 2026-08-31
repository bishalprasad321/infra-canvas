// Command agent-gateway runs the Agent Gateway service described in
// obsidian_memory/03.6 and 08.4: a small, independently deployable relay that
// authenticates local Sandbox Agent connections and bridges Runner-side SSH
// dials through to them. See apps/agent-gateway/README.md for the Phase 1
// scope and known limitations.
package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"apps/agent-gateway/internal/apiclient"
	"apps/agent-gateway/internal/server"
)

func main() {
	listen := flag.String("listen", ":9090", "address to listen on")
	apiURL := flag.String("api-url", "http://localhost:8080", "base URL of the InfraCanvas API (apps/api)")
	verificationURI := flag.String("verification-uri", "http://localhost:3000/pair", "browser-facing pairing approval page")
	runnerSecret := flag.String("runner-secret", "", "shared secret required on X-Gateway-Runner-Secret for /runner/dial and the apps/api status callback (required)")
	maxStreamsPerProject := flag.Int("max-streams-per-project", 10,
		"maximum concurrent /runner/dial streams allowed per project_id at once (obsidian_memory/03.6 rate limiting)")
	bytesPerSecPerProject := flag.Int64("bytes-per-sec-per-project", 2*1024*1024,
		"sustained bytes/sec budget shared across all concurrent streams for one project_id — sized for interactive SSH/Ansible output, not bulk transfer")
	flag.Parse()

	if *runnerSecret == "" {
		log.Fatal("agent-gateway: --runner-secret is required (must match GATEWAY_RUNNER_SECRET on apps/api)")
	}

	apiClient := apiclient.New(*apiURL, *runnerSecret)
	srv := server.New(*verificationURI, apiClient, *runnerSecret, *maxStreamsPerProject, *bytesPerSecPerProject)
	httpServer := &http.Server{Addr: *listen, Handler: srv.Mux()}

	// Graceful-stop handling: `docker stop`, systemd stop, and a k8s pod
	// eviction all send SIGTERM (with a grace period) before force-killing —
	// use that window to tell apps/api every currently-connected Agent just
	// went DISCONNECTED, closing the gap where stopping the Gateway itself
	// (as opposed to an Agent's tunnel dying under a still-running Gateway)
	// left paired_agents.status stuck at ACTIVE forever. A hard crash/SIGKILL
	// still isn't covered — see Server.Shutdown's doc comment.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh
		log.Println("agent-gateway: shutting down, notifying apps/api of all connected agents...")
		srv.Shutdown()

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			log.Printf("agent-gateway: http shutdown: %v", err)
		}
	}()

	log.Printf("agent-gateway: listening on %s (api-url=%s)", *listen, *apiURL)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("agent-gateway: ListenAndServe failed: %v", err)
	}
}
