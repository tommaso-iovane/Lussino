# Lussino

A lightweight and simple container vulnerability scanning platform that helps organizations monitor and secure their containerized applications using **Grype**.

![dashboard](./images/image.png)

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

Create a `docker-compose.yml` file:

```yaml
services:
  lussino:
    image: tiovane/lussino:latest
    container_name: lussino
    ports:
      - "3007:3000"
    volumes:
      - ./data:/app/data
    environment:
      NODE_ENV: production
      APP_URL: "http://localhost:3000"
      # generate with openssl rand -hex 32
      AGENT_TOKEN: "1234"
      # Lussino will not save vulnerabilities with a risk % below IGNORE_RISK_BELOW
      IGNORE_RISK_BELOW: 10
      # Container scan cron job schedule
      SCAN_CRON_STRING: "0 2 * * *"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Deploy with:
```bash
docker-compose up -d
```

Default credentials: admin / changeme
Be sure to change the password in the profile page

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
sudo mkdir -p /opt/lussino
sudo chown $USER: /opt/lussino
wget -O /opt/lussino/lussino-agent.sh https://raw.githubusercontent.com/tommaso-iovane/Lussino/refs/heads/main/agent/agent.sh
chmod +x /opt/lussino/lussino-agent.sh
wget -O /opt/lussino/lussino.env https://raw.githubusercontent.com/tommaso-iovane/Lussino/refs/heads/main/agent/lussino.env
# Edit variables
vim /opt/lussino/lussino.env

# Add to crontab for daily scans at 4 AM
echo "0 4 * * * /opt/lussino/lussino-agent.sh" | crontab -

# Or edit crontab manually
crontab -e
# Add: 0 2 * * * /opt/lussino-cron.sh
```

