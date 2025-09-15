# Multi-stage build for Lussino container security platform
FROM oven/bun:alpine AS builder

# Set working directory
WORKDIR /build

COPY ./frontend /build/

RUN rm .env && bun install && bun run build


# Production stage
FROM oven/bun:alpine AS production

ENV NODE_ENV=production

# Install curl for health checks and Grype for vulnerability scanning
RUN apk add --no-cache curl wget docker openrc fuse-overlayfs

# Install Grype
RUN wget -q -O - https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Configure Docker daemon for container environment with better unprivileged support
RUN mkdir -p /etc/docker /var/lib/docker && \
    echo '{"storage-driver": "fuse-overlayfs", "iptables": false, "bridge": "none", "userland-proxy": false, "experimental": true}' > /etc/docker/daemon.json

# Add Docker to boot services and prepare Docker daemon
RUN rc-update add docker boot

# Create app directory and data directory
WORKDIR /app

COPY ./server /app/

RUN rm -rf /app/data /app/node_modules && mkdir -p /app/data
RUN bun install

COPY --from=builder /build/dist/ /app/src/fe-dist

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/healthz || exit 1

# Create startup script to start Docker daemon and application
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting Docker daemon with fuse-overlayfs for unprivileged operation..."' >> /app/start.sh && \
    echo 'mkdir -p /var/lib/docker' >> /app/start.sh && \
    echo 'dockerd --data-root=/var/lib/docker &' >> /app/start.sh && \
    echo 'DOCKER_PID=$!' >> /app/start.sh && \
    echo 'echo "Waiting for Docker daemon to start (PID: $DOCKER_PID)..."' >> /app/start.sh && \
    echo 'for i in $(seq 1 30); do' >> /app/start.sh && \
    echo '  if docker version >/dev/null 2>&1; then' >> /app/start.sh && \
    echo '    echo "Docker daemon is ready!"' >> /app/start.sh && \
    echo '    break' >> /app/start.sh && \
    echo '  fi' >> /app/start.sh && \
    echo '  echo "Waiting... ($i/30)"' >> /app/start.sh && \
    echo '  sleep 2' >> /app/start.sh && \
    echo 'done' >> /app/start.sh && \
    echo 'if ! docker version >/dev/null 2>&1; then' >> /app/start.sh && \
    echo '  echo "Docker daemon failed to start properly"' >> /app/start.sh && \
    echo '  echo "Checking Docker daemon logs:"' >> /app/start.sh && \
    echo '  journalctl -u docker --no-pager -n 20 || echo "No systemd logs available"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Starting Lussino application..."' >> /app/start.sh && \
    echo 'exec bun run start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start the application with Docker daemon
CMD ["/app/start.sh"]
