FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o api-server .

# Pull prebuilt tools baseline from GHCR (installs nothing locally)
FROM ghcr.io/bishalprasad321/infra-canvas-runner-base:latest
ENV IS_DOCKER=true
ENV PORT=8080

WORKDIR /app
COPY --from=builder /src/api-server .

EXPOSE 8080
CMD ["./api-server"]
