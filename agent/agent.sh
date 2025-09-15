#!/bin/bash

# Configuration file paths following Linux best practices
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/lussino"
CONFIG_FILE="$CONFIG_DIR/config"

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Function to prompt for configuration
prompt_config() {
    echo "Lussino Agent Configuration"
    echo "============================"
    echo
    
    # Prompt for server endpoint
    while [[ -z "$LUSSINO_SERVER_ENDPOINT" ]]; do
        read -p "Enter Lussino server endpoint (e.g., http://localhost:3000): " LUSSINO_SERVER_ENDPOINT
        if [[ -z "$LUSSINO_SERVER_ENDPOINT" ]]; then
            echo "Server endpoint is required. Please enter a valid URL."
        fi
    done
    
    # Prompt for auth token (optional)
    read -p "Enter authentication token (optional, press Enter to skip): " LUSSINO_AUTH_TOKEN
    
    # Prompt for hostname (optional, defaults to system hostname)
    read -p "Enter custom hostname (optional, defaults to $(hostname)): " AGENT_HOSTNAME
    if [[ -z "$AGENT_HOSTNAME" ]]; then
        AGENT_HOSTNAME=$(hostname)
    fi
    
    # Save configuration to file
    echo "# Lussino Agent Configuration" > "$CONFIG_FILE"
    echo "# Generated on $(date)" >> "$CONFIG_FILE"
    echo >> "$CONFIG_FILE"
    echo "LUSSINO_SERVER_ENDPOINT=\"$LUSSINO_SERVER_ENDPOINT\"" >> "$CONFIG_FILE"
    echo "LUSSINO_AUTH_TOKEN=\"$LUSSINO_AUTH_TOKEN\"" >> "$CONFIG_FILE"
    echo "AGENT_HOSTNAME=\"$AGENT_HOSTNAME\"" >> "$CONFIG_FILE"
    
    # Set secure permissions (readable only by owner)
    chmod 600 "$CONFIG_FILE"
    
    echo
    echo "Configuration saved to: $CONFIG_FILE"
    echo "You can edit this file directly or delete it to reconfigure."
    echo
}

# Check if config file exists and load it
if [[ -f "$CONFIG_FILE" ]]; then
    echo "Loading configuration from: $CONFIG_FILE"
    source "$CONFIG_FILE"
else
    echo "Configuration file not found. Setting up Lussino agent..."
    prompt_config
fi

# Validate required configuration
if [[ -z "$LUSSINO_SERVER_ENDPOINT" ]]; then
    echo "Error: LUSSINO_SERVER_ENDPOINT is not set. Please reconfigure."
    echo "Delete $CONFIG_FILE and run the script again to reconfigure."
    exit 1
fi

# Set defaults for optional values
HOSTNAME=${AGENT_HOSTNAME:-$(hostname)}
AUTH_TOKEN=${LUSSINO_AUTH_TOKEN:-}
ENDPOINT="$LUSSINO_SERVER_ENDPOINT"

# Collect Docker container information
containers_json="[]"

# Get container IDs
container_ids=$(docker ps -q)

if [ ! -z "$container_ids" ]; then
    containers_data=""
    
    for container_id in $container_ids; do
        container_name=$(docker inspect --format='{{.Name}}' "$container_id" | sed 's/\///')
        
        # Get image information
        image_info=$(docker inspect --format='{{.Config.Image}}' "$container_id")
        
        # Get image digest
        image_id=$(docker inspect --format='{{.Image}}' "$container_id")
        digest=$(docker inspect --format='{{index .RepoDigests 0}}' "$image_id" 2>/dev/null || echo "")
        
        # Parse repository and tag from image info
        if [[ "$image_info" == *":"* ]]; then
            repository=$(echo "$image_info" | cut -d':' -f1)
            tag=$(echo "$image_info" | cut -d':' -f2)
        else
            repository="$image_info"
            tag="latest"
        fi
        
        # Escape quotes for JSON
        container_name=$(echo "$container_name" | sed 's/"/\\"/g')
        repository=$(echo "$repository" | sed 's/"/\\"/g')
        tag=$(echo "$tag" | sed 's/"/\\"/g')
        digest=$(echo "$digest" | sed 's/"/\\"/g')
        image_id=$(echo "$image_id" | sed 's/"/\\"/g')
        
        # Build JSON object for this container
        container_json="{\"name\":\"$container_name\",\"repository\":\"$repository\",\"tag\":\"$tag\",\"digest\":\"$digest\",\"imageId\":\"$image_id\"}"
        
        if [ -z "$containers_data" ]; then
            containers_data="$container_json"
        else
            containers_data="$containers_data,$container_json"
        fi
    done
    
    containers_json="[$containers_data]"
fi

payload="{\"hostname\":\"$HOSTNAME\",\"containers\":$containers_json}"


curl -X POST \
     -H "Content-Type: application/json" \
     -d "$payload" \
     "$ENDPOINT/api/containers/update-containers?auth_token=$AUTH_TOKEN"

