

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
        const containerStmt = db.prepare('SELECT * FROM containers WHERE id = ?')
        const container = containerStmt.get(containerId)

        if (!container) {
            throw new Error(`Container with ID ${containerId} not found`)
        }

        const digestId = container.digest
        if (!digestId) {
            throw new Error(`Container ${containerId} has no digest`)
        }

        // Run grype scan
        const result = await $`grype ${digestId} -o json`.text()
        
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
        console.error(`Grype scan failed for container ${containerId}:`, error.message)
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