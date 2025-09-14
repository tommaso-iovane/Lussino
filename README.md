# Lussino

A lightweight and simple container vulnerability scanning platform that helps organizations monitor and secure their containerized applications using **Grype**.

## Key Highlights

- **Zero-Dependency Agent**: Lightweight bash script requiring no installation or dependencies
- **Single Container Deployment**: Entire application runs in one Docker container
- **Minimal Footprint**: Easy deployment across any environment

## Features

- **Container Discovery**: Automatic detection and inventory of containers across hosts
- **Vulnerability Scanning**: Integration with Grype for comprehensive security analysis
- **Risk Assessment**: Visual risk scoring (0-100) with color-coded severity indicators
- **Dashboard Analytics**: Real-time statistics and vulnerability trends
- **Dark/Light Theme**: Full theme support with system preference detection
- **User Management**: Authentication with password change functionality

## Deployment

### Option 1: Build from Source
```bash
# Build the Docker image
docker build -t lussino:latest .

# Create data directory for persistence
mkdir -p ./lussino-data

# Run with data volume mounted
docker run -d \
  -p 3000:3000 \
  -v ./lussino-data:/app/data \
  --name lussino \
  lussino:latest
```

### Option 2: Single Docker Container 
```bash
# Create data directory for persistence
mkdir -p ./lussino-data

# Run with data volume mounted
docker run -d \
  -p 3000:3000 \
  -v ./lussino-data:/app/data \
  --name lussino \
  tiovane/lussino:latest
```

### Option 3: Docker Compose (Production Ready)
Create a `docker-compose.yml` file:

```yaml
services:
  lussino:
    image: tiovane/lussino:latest
    container_name: lussino
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  data:
    driver: local
```

Deploy with:
```bash
docker-compose up -d
```

### Option 4: Development Setup
```bash
# Server
cd server && bun install && bun run dev

# Frontend  
cd frontend && bun install && bun run dev
```

## Agent Deployment

Deploy the scanning agent on any host with Docker - **no dependencies required** (except of course docker):

### Environment Variables

Configure the agent by setting these environment variables:

```bash
# Required: Lussino server endpoint
export LUSSINO_SERVER_ENDPOINT="http://your-lussino-server:3000"
# Optional: Authentication token
export LUSSINO_AUTH_TOKEN="your-auth-token"
# Optional: Set a custom hostname
export AGENT_HOSTNAME="yourHostname"
```

### Method 1: Direct Download (Recommended)
```bash
# Download agent directly from GitHub
wget https://raw.githubusercontent.com/tommaso-iovane/Lussino/refs/heads/main/agent/agent.sh
chmod +x agent.sh

# Set environment variables
export LUSSINO_SERVER_ENDPOINT="http://your-lussino-server:3000"

# Run scan
./agent.sh
```


### Automated Scanning with Crontab

Set up automatic vulnerability scanning:

```bash
# Download and install agent
wget -O /opt/lussino-agent.sh https://raw.githubusercontent.com/tommaso-iovane/Lussino/refs/heads/main/agent/agent.sh
chmod +x /opt/lussino-agent.sh

# Create environment file
cat > /opt/lussino-agent.env << EOF
LUSSINO_SERVER_ENDPOINT=http://your-lussino-server:3000
LUSSINO_AUTH_TOKEN=your-auth-token
AGENT_NAME=$(hostname)
AGENT_HOSTNAME=$(hostname -f)
EOF

# Create wrapper script for cron
cat > /opt/lussino-cron.sh << 'EOF'
#!/bin/bash
source /opt/lussino-agent.env
/opt/lussino-agent.sh
EOF
chmod +x /opt/lussino-cron.sh

# Add to crontab for daily scans at 2 AM
echo "0 2 * * * /opt/lussino-cron.sh" | crontab -

# Or edit crontab manually
crontab -e
# Add: 0 2 * * * /opt/lussino-cron.sh
```

