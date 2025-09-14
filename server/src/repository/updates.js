

// @ts-nocheck
import db from '../lib/db.js'

export const checkContainerForUpdates = async (containerId) => {
    try {
        // Get container details from database
        const containerStmt = db.prepare('SELECT * FROM containers WHERE id = ?')
        const container = containerStmt.get(containerId)
        
        if (!container) {
            throw new Error(`Container with ID ${containerId} not found`)
        }

        const { repository, tag, digest } = container

        if (!repository || !tag) {
            console.log(`Container ${containerId} missing repository or tag, skipping update check`)
            return { containerId, hasUpdate: false, reason: 'Missing repository or tag' }
        }

        console.log(`Checking for updates: ${repository}:${tag}`)

        // Check Docker Hub for latest digest
        const latestDigest = await getLatestDigestFromDockerHub(repository, tag)
        
        if (!latestDigest) {
            console.log(`Could not fetch latest digest for ${repository}:${tag}`)
            return { containerId, hasUpdate: false, reason: 'Could not fetch latest digest' }
        }

        // Compare digests to determine if update is available
        const hasUpdate = digest !== latestDigest
        const updateFlag = hasUpdate ? 1 : 0

        // Update the has_update field in database
        const updateStmt = db.prepare('UPDATE containers SET has_update = ? WHERE id = ?')
        updateStmt.run(updateFlag, containerId)

        console.log(`Container ${containerId} (${repository}:${tag}): ${hasUpdate ? 'UPDATE AVAILABLE' : 'UP TO DATE'}`)

        return {
            containerId,
            hasUpdate,
            currentDigest: digest,
            latestDigest,
            repository,
            tag
        }

    } catch (error) {
        console.error(`Update check failed for container ${containerId}:`, error.message)
        
        // Set has_update to 0 on error to avoid false positives
        const updateStmt = db.prepare('UPDATE containers SET has_update = 0 WHERE id = ?')
        updateStmt.run(containerId)
        
        throw new Error(`Update check failed: ${error.message}`)
    }
}

const getLatestDigestFromDockerHub = async (repository, tag) => {
    try {
        // Handle official Docker images (e.g., nginx -> library/nginx)
        const repoPath = repository.includes('/') ? repository : `library/${repository}`
        
        // Docker Hub Registry API v2
        const manifestUrl = `https://registry-1.docker.io/v2/${repoPath}/manifests/${tag}`
        
        console.log(`Fetching manifest from: ${manifestUrl}`)

        // Get auth token first
        const tokenResponse = await fetch(`https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repoPath}:pull`)
        
        if (!tokenResponse.ok) {
            throw new Error(`Failed to get auth token: ${tokenResponse.status}`)
        }

        const tokenData = await tokenResponse.json()
        const token = tokenData.token

        // Fetch manifest with auth token
        const manifestResponse = await fetch(manifestUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json'
            }
        })

        if (!manifestResponse.ok) {
            if (manifestResponse.status === 404) {
                throw new Error(`Image not found: ${repository}:${tag}`)
            }
            throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`)
        }

        // Get digest from Docker-Content-Digest header
        const digest = manifestResponse.headers.get('Docker-Content-Digest')
        
        if (!digest) {
            throw new Error('No digest found in manifest response')
        }

        console.log(`Latest digest for ${repository}:${tag}: ${digest}`)
        return digest

    } catch (error) {
        console.error(`Failed to get latest digest for ${repository}:${tag}:`, error.message)
        return null
    }
}

export const checkAllContainersForUpdates = async (hostname = null) => {
    try {
        let containersStmt
        let containers
        
        if (hostname) {
            containersStmt = db.prepare('SELECT id FROM containers WHERE hostname = ?')
            containers = containersStmt.all(hostname)
            console.log(`Checking updates for containers on hostname: ${hostname}`)
        } else {
            containersStmt = db.prepare('SELECT id FROM containers')
            containers = containersStmt.all()
            console.log('Checking updates for all containers')
        }
        
        const results = []
        
        for (const container of containers) {
            try {
                const result = await checkContainerForUpdates(container.id)
                results.push(result)
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100))
            } catch (error) {
                console.error(`Failed to check updates for container ${container.id}:`, error.message)
                results.push({
                    containerId: container.id,
                    hasUpdate: false,
                    error: error.message
                })
            }
        }
        
        const updatesAvailable = results.filter(r => r.hasUpdate).length
        const target = hostname ? `hostname ${hostname}` : 'all containers'
        console.log(`Update check complete for ${target}: ${updatesAvailable} containers have updates available`)
        
        return {
            hostname: hostname || 'all',
            totalChecked: results.length,
            updatesAvailable,
            results
        }
        
    } catch (error) {
        console.error('Failed to check containers for updates:', error.message)
        throw error
    }
}