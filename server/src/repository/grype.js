

// @ts-nocheck
import { $ } from 'bun'
import db from '../lib/db.js'
import { saveScanResults } from './vulnerabilities.js'

export const deferScanAllByHostname = async (hostname) => {
    const containerStmt = db.prepare('SELECT id FROM containers WHERE hostname = ?')
    const containers = containerStmt.all(hostname)
    for (const container of containers) {
        await scanContainer(container.id)
    }
}

export const scanAllContainers = async () => {
    const containerStmt = db.prepare('SELECT id FROM containers')
    const containers = containerStmt.all()
    for (const container of containers) {
        await scanContainer(container.id)
    }
}

export const scanContainer = async (containerId) => {
    try {
        console.log(`Starting scan for ${containerId}`)
        const containerStmt = db.prepare('SELECT * FROM containers WHERE id = ?')
        const container = containerStmt.get(containerId)

        if (!container) {
            throw new Error(`Container with ID ${containerId} not found`)
        }

        // Try to scan using the digest first (most specific)
        let imageRef = container.digest
        let result
        
        try {
            if (container.digest) {
                console.log(`Scanning with digest: ${imageRef}`)
                result = await $`grype ${imageRef} -o json`.text()
            } else {
                throw new Error('No digest available')
            }
        } catch (digestError) {
            console.log(`Digest scan failed, trying with repository:tag: ${container.repository}:${container.tag}`)
            // Fallback to using the repository:tag (local image)
            try {
                imageRef = `${container.repository}:${container.tag}`
                result = await $`grype ${imageRef} -o json`.text()
            } catch (localError) {
                console.log(`Repository:tag scan failed, trying with image ID: ${container.imageId}`)
                // Last resort: try with image ID
                try {
                    imageRef = container.imageId
                    result = await $`grype ${imageRef} -o json`.text()
                } catch (imageIdError) {
                    throw new Error(`All scan attempts failed. Digest: ${digestError.message}, Local: ${localError.message}, ImageID: ${imageIdError.message}`)
                }
            }
        }
        
        console.log(`Grype scan completed for ${containerId} using ${imageRef}`)
        
        // Parse JSON result
        let grypeScanResults
        try {
            grypeScanResults = JSON.parse(result)
        } catch (parseError) {
            throw new Error(`Failed to parse grype output: ${parseError.message}`)
        }

        // Delete existing scans for this container
        const deleteTransaction = db.transaction(() => {
            const deleteDetailsStmt = db.prepare(`
                DELETE FROM vulnerability_details 
                WHERE scan_id IN (
                    SELECT id FROM vuln_scans WHERE container_id = ?
                )
            `)
            deleteDetailsStmt.run(containerId)

            const deleteScansStmt = db.prepare('DELETE FROM vuln_scans WHERE container_id = ?')
            const deleteResult = deleteScansStmt.run(containerId)

            return deleteResult.changes
        })

        const deletedCount = deleteTransaction()
        console.log(`Deleted ${deletedCount} existing scan(s) for container ${containerId}`)

        // Save new scan results
        const scanId = saveScanResults(containerId, grypeScanResults)

        return {
            scanId,
            containerId,
            deletedScans: deletedCount,
            totalVulnerabilities: grypeScanResults.matches?.length || 0,
            severityCounts: getSeverityCounts(grypeScanResults)
        }

    } catch (error) {
        console.error(`Grype scan failed for container ${containerId}:`, error)
    }
}

const getSeverityCounts = (grypeScanResults) => {
    const counts = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
    }

    grypeScanResults.matches?.forEach(match => {
        const severity = match.vulnerability?.severity
        if (counts.hasOwnProperty(severity)) {
            counts[severity]++
        }
    })

    return counts
}