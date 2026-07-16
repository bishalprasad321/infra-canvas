FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o api-server .

FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
ENV IS_DOCKER=true
ENV PORT=8080

# Install basic tools and python (needed for ansible)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    software-properties-common \
    python3 \
    python3-pip \
    openssh-client \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Terraform
RUN curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com/ $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/hashicorp.list \
    && apt-get update && apt-get install -y terraform

# Install Ansible
RUN pip3 install --no-cache-dir ansible

# Install Kubectl
RUN curl -LO "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

WORKDIR /app
COPY --from=builder /src/api-server .

EXPOSE 8080
CMD ["./api-server"]
