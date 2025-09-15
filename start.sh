#!/bin/sh

echo "Starting Docker daemon with fuse-overlayfs for unprivileged operation..."

# Create Docker data directory
mkdir -p /var/lib/docker

# Start Docker daemon in background
dockerd --data-root=/var/lib/docker &
DOCKER_PID=$!

echo "Waiting for Docker daemon to start (PID: $DOCKER_PID)..."

# Wait for Docker daemon to be ready (up to 60 seconds)
for i in $(seq 1 30); do
  if docker version >/dev/null 2>&1; then
    echo "Docker daemon is ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

# Check if Docker daemon started successfully
if ! docker version >/dev/null 2>&1; then
  echo "Docker daemon failed to start properly"
  echo "Checking Docker daemon logs:"
  journalctl -u docker --no-pager -n 20 || echo "No systemd logs available"
else
  # Login to Docker Hub if credentials are provided
  if [ -n "$DOCKER_USERNAME" ] && [ -n "$DOCKER_TOKEN" ]; then
    echo "Logging into Docker Hub..."
    echo "$DOCKER_TOKEN" | docker login -u "$DOCKER_USERNAME" --password-stdin
    if [ $? -eq 0 ]; then
      echo "Successfully logged into Docker Hub"
    else
      echo "Warning: Failed to login to Docker Hub"
    fi
  else
    echo "No Docker Hub credentials provided - using anonymous access"
  fi
fi

echo "Starting Lussino application..."
exec bun run start