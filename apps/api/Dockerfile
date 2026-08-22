FROM golang:1.23 AS builder
WORKDIR /src
COPY go.mod go.sum ./
ENV GOPROXY=direct
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 GOOS=linux go build -o api-server .

# Pull prebuilt tools baseline from GHCR (installs nothing locally)
FROM ghcr.io/bishalprasad321/infra-canvas-runner-base:latest
ENV IS_DOCKER=true
ENV PORT=8080

WORKDIR /app
COPY --from=builder /src/api-server .

EXPOSE 8080
CMD ["./api-server"]
