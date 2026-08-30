FROM golang:1.23 AS builder
WORKDIR /src
COPY go.mod go.sum ./
# go.mod's `go` directive can be newer than this image's built-in toolchain
# (e.g. a dependency bump like golang.org/x/time requiring go >= 1.25) — the
# golang base image ships with GOTOOLCHAIN=local (no auto download), so this
# is explicitly overridden to `auto`, on the default GOPROXY (not
# GOPROXY=direct, which doesn't serve toolchain downloads), so `go` fetches
# whatever toolchain go.mod declares. Same pattern as apps/api/Dockerfile's
# apps/cli build step.
RUN GOTOOLCHAIN=auto go mod download
COPY . .
RUN GOTOOLCHAIN=auto CGO_ENABLED=0 GOOS=linux go build -o /out/agent-gateway ./cmd/agent-gateway

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /out/agent-gateway .
EXPOSE 9090
ENTRYPOINT ["./agent-gateway"]
