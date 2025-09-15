#!/bin/bash

source /opt/lussino/lussino.env

HOSTNAME=${AGENT_HOSTNAME:-$(hostname)}

ENDPOINT="${LUSSINO_SERVER_ENDPOINT:?LUSSINO_SERVER_ENDPOINT must be set}"

AUTH_TOKEN=${LUSSINO_AUTH_TOKEN:-}

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

