#!/bin/bash

# Configuration file paths following Linux best practices
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/lussino"
CONFIG_FILE="$CONFIG_DIR/config"

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Function to check and install Grype
ensure_grype_installed() {
    if ! command -v grype &> /dev/null; then
        echo "Grype not found. Installing Grype..."
        if ! wget -q -O - https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin; then
            echo "Error: Failed to install Grype. Please install it manually."
            exit 1
        fi
        echo "Grype installed successfully."
    else
        echo "Grype is already installed."
    fi
}

# Function to scan container with Grype
scan_container() {
    local container_id="$1"
    local container_name="$2"
    local repository="$3"
    local tag="$4"
    local digest="$5"
    local image_id="$6"
    
    
    # Try to scan using the digest first (most specific), then repo:tag, then image ID
    local scan_result=""
    local image_ref=""
    
    if [[ -n "$digest" ]]; then
        image_ref="$digest"
        scan_result=$(grype "$image_ref" -o json --quiet 2>/dev/null)
    fi
    
    if [[ -z "$scan_result" && -n "$repository" && -n "$tag" ]]; then
        image_ref="$repository:$tag"
        scan_result=$(grype "$image_ref" -o json --quiet 2>/dev/null)
    fi
    
    if [[ -z "$scan_result" && -n "$image_id" ]]; then
        image_ref="$image_id"
        scan_result=$(grype "$image_ref" -o json --quiet 2>/dev/null)
    fi
    
    if [[ -z "$scan_result" ]]; then
        scan_result="{\"matches\":[]}"
    else
        # Basic validation that scan_result starts and ends with braces (JSON object)
        if [[ ! "$scan_result" =~ ^\{.*\}$ ]]; then
            scan_result="{\"matches\":[]}"
        fi
    fi
    
    echo "$scan_result"
}

# Function to send container data to server
send_container_data() {
    local container_name="$1"
    local repository="$2"
    local tag="$3"
    local digest="$4"
    local image_id="$5"
    local scan_data="$6"
    
    # Escape JSON strings
    container_name=$(echo "$container_name" | sed 's/"/\\"/g')
    repository=$(echo "$repository" | sed 's/"/\\"/g')
    tag=$(echo "$tag" | sed 's/"/\\"/g')
    digest=$(echo "$digest" | sed 's/"/\\"/g')
    image_id=$(echo "$image_id" | sed 's/"/\\"/g')
    
    # Create temporary file for payload
    local temp_file=$(mktemp)
    
    # Create payload with container info and scan data
    cat > "$temp_file" <<EOF
{
    "hostname": "$HOSTNAME",
    "container": {
        "name": "$container_name",
        "repository": "$repository",
        "tag": "$tag",
        "digest": "$digest",
        "imageId": "$image_id"
    },
    "scanData": $scan_data
}
EOF
    
    # Send to server using temp file
    echo "  Sending request to: $ENDPOINT/api/containers/update-container?auth_token=$AUTH_TOKEN"
    local response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
         -H "Content-Type: application/json" \
         --data "@$temp_file" \
         "$ENDPOINT/api/containers/update-container?auth_token=$AUTH_TOKEN")
    
    # Clean up temp file
    rm -f "$temp_file"
    
    # Parse response and status
    local http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    local response_body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    echo "  HTTP Status: $http_status"
    echo "  Response: $response_body"
    
    if [[ "$http_status" == "200" || "$http_status" == "201" ]]; then
        echo "  Successfully sent data for container: $container_name"
    else
        echo "  Failed to send data for container: $container_name (HTTP $http_status)"
    fi
}

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

echo "Starting Lussino agent for hostname: $HOSTNAME"
echo "Server endpoint: $ENDPOINT"

# Ensure Grype is installed
ensure_grype_installed

# Collect and process Docker containers
container_ids=$(docker ps -q)

if [ -z "$container_ids" ]; then
    echo "No running containers found."
    exit 0
fi

echo "Found $(echo $container_ids | wc -w) running containers."

# Process each container individually
for container_id in $container_ids; do
    echo ""
    echo "Processing container: $container_id"
    
    # Get container information
    container_name=$(docker inspect --format='{{.Name}}' "$container_id" | sed 's/\///')
    image_info=$(docker inspect --format='{{.Config.Image}}' "$container_id")
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
    
    echo "  Name: $container_name"
    echo "  Repository: $repository"
    echo "  Tag: $tag"
    echo "  Digest: $digest"
    echo "  Image ID: $image_id"
    
    # Scan the container with Grype
    scan_data=$(scan_container "$container_id" "$container_name" "$repository" "$tag" "$digest" "$image_id")
    
    # Send container data and scan results to server
    send_container_data "$container_name" "$repository" "$tag" "$digest" "$image_id" "$scan_data"
done

echo ""
echo "Agent execution completed."

