// Command agent-gateway runs the Agent Gateway service described in
// obsidian_memory/03.6 and 08.4: a small, independently deployable relay that
// authenticates local Sandbox Agent connections and bridges Runner-side SSH
// dials through to them. See apps/agent-gateway/README.md for the Phase 1
// scope and known limitations.
package main

import (
	"flag"
	"log"
	"net/http"

	"apps/agent-gateway/internal/apiclient"
	"apps/agent-gateway/internal/server"
)

func main() {
	listen := flag.String("listen", ":9090", "address to listen on")
	apiURL := flag.String("api-url", "http://localhost:8080", "base URL of the InfraCanvas API (apps/api)")
	verificationURI := flag.String("verification-uri", "http://localhost:3000/pair", "browser-facing pairing approval page")
	runnerSecret := flag.String("runner-secret", "", "shared secret required on X-Gateway-Runner-Secret for /runner/dial and the apps/api status callback (required)")
	flag.Parse()

	if *runnerSecret == "" {
		log.Fatal("agent-gateway: --runner-secret is required (must match GATEWAY_RUNNER_SECRET on apps/api)")
	}

	apiClient := apiclient.New(*apiURL, *runnerSecret)
	srv := server.New(*verificationURI, apiClient, *runnerSecret)

	log.Printf("agent-gateway: listening on %s (api-url=%s)", *listen, *apiURL)
	if err := http.ListenAndServe(*listen, srv.Mux()); err != nil {
		log.Fatalf("agent-gateway: ListenAndServe failed: %v", err)
	}
}
