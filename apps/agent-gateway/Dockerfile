FROM golang:1.23 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/agent-gateway ./cmd/agent-gateway

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /out/agent-gateway .
EXPOSE 9090
ENTRYPOINT ["./agent-gateway"]
