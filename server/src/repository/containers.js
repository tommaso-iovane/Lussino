import db from '../lib/db.js'

export function removeContainersByHostname(hostname) {
    if (!hostname) {
        throw new Error('Hostname is required')
    }

    const stmt = db.prepare('DELETE FROM containers WHERE hostname = ?')
    const result = stmt.run(hostname)

    return result.changes
}

export function addContainers(hostname, containers) {
    if (!Array.isArray(containers)) {
        throw new Error('Containers must be an array')
    }

    if (containers.length === 0) {
        return []
    }

    const insertStmt = db.prepare(`
    INSERT INTO containers (hostname, name, repository, tag, digest, imageId) 
    VALUES (?, ?, ?, ?, ?, ?)
  `)

    const insertedContainers = []

    const transaction = db.transaction((containers) => {
        for (const container of containers) {
            const { name, repository, tag, digest, imageId } = container

            const result = insertStmt.run(hostname, name, repository, tag, digest, imageId)

            insertedContainers.push({
                id: result.lastInsertRowid,
                hostname,
                name,
                repository,
                tag,
                digest,
                imageId
            })
        }
    })

    transaction(containers)
    return insertedContainers
}

export function updateContainersByHostname(hostname, containers) {
    if (!hostname) {
        throw new Error('Hostname is required')
    }

    if (!Array.isArray(containers)) {
        throw new Error('Containers must be an array')
    }

    const transaction = db.transaction(() => {
        const removedCount = removeContainersByHostname(hostname)
        const addedContainers = addContainers(hostname, containers)

        return {
            hostname,
            removedCount,
            addedContainers,
            totalAdded: addedContainers.length,
        }
    })

    return transaction()
}

export function getContainersByHostname(hostname) {
    if (!hostname) {
        throw new Error('Hostname is required')
    }

    const stmt = db.prepare('SELECT * FROM containers WHERE hostname = ? ORDER BY created_at DESC')
    return stmt.all(hostname)
}

export function getAllContainers() {
    const stmt = db.prepare('SELECT * FROM containers ORDER BY hostname, created_at DESC')
    return stmt.all()
}

export function getContainerById(id) {
    if (!id) {
        throw new Error('Container ID is required')
    }

    const stmt = db.prepare('SELECT * FROM containers WHERE id = ?')
    return stmt.get(id)
}

export function getContainersWithVulnerabilities(hostname = null) {
    // Get containers (all or filtered by hostname)
    const containers = hostname ? getContainersByHostname(hostname) : getAllContainers()
    
    // Get vulnerability counts for each container
    const containersWithVulns = containers.map(container => {
        // Get latest scan for this container
        const latestScanStmt = db.prepare(`
            SELECT id, scan_timestamp, total_vulnerabilities, critical_count,
                   high_count, medium_count, low_count, grype_version
            FROM vuln_scans 
            WHERE container_id = ? 
            ORDER BY scan_timestamp DESC 
            LIMIT 1
        `)
        
        const latestScan = latestScanStmt.get(container.id)
        
        return {
            id: container.id,
            hostname: container.hostname,
            name: container.name,
            repository: container.repository,
            tag: container.tag,
            digest: container.digest,
            imageId: container.imageId,
            hasUpdate: container.has_update === 1,
            createdAt: container.created_at,
            vulnerabilities: latestScan ? {
                scanId: latestScan.id,
                lastScanAt: latestScan.scan_timestamp,
                total: latestScan.total_vulnerabilities,
                critical: latestScan.critical_count,
                high: latestScan.high_count,
                medium: latestScan.medium_count,
                low: latestScan.low_count,
                grypVersion: latestScan.grype_version
            } : null
        }
    })
    
    return containersWithVulns
}

export function getContainerDetails(id) {
    if (!id) {
        throw new Error('Container ID is required')
    }

    // Get container basic info
    const container = getContainerById(id)
    if (!container) {
        return null
    }

    // Get all scans for this container ordered by most recent first
    const scansStmt = db.prepare(`
        SELECT id, scan_timestamp, total_vulnerabilities, critical_count,
               high_count, medium_count, low_count, grype_version,
               image_digest, image_tags, os_name, os_version, scan_results_json
        FROM vuln_scans 
        WHERE container_id = ? 
        ORDER BY scan_timestamp DESC
    `)
    
    const scans = scansStmt.all(id)
    
    // For each scan, get the vulnerability details
    const scansWithDetails = scans.map(scan => {
        const detailsStmt = db.prepare(`
            SELECT cve_id, severity, risk_score, package_name,
                   package_version, package_type, fixed_version, description, urls
            FROM vulnerability_details 
            WHERE scan_id = ?
            ORDER BY risk_score DESC, severity DESC, cve_id
        `)
        
        const vulnerabilityDetails = detailsStmt.all(scan.id)
        
        return {
            scanId: scan.id,
            scanTimestamp: scan.scan_timestamp,
            grypVersion: scan.grype_version,
            imageDigest: scan.image_digest,
            imageTags: scan.image_tags,
            osName: scan.os_name,
            osVersion: scan.os_version,
            summary: {
                total: scan.total_vulnerabilities,
                critical: scan.critical_count,
                high: scan.high_count,
                medium: scan.medium_count,
                low: scan.low_count
            },
            vulnerabilities: vulnerabilityDetails.map(vuln => ({
                cveId: vuln.cve_id,
                severity: vuln.severity,
                riskScore: vuln.risk_score,
                package: {
                    name: vuln.package_name,
                    version: vuln.package_version,
                    type: vuln.package_type,
                    fixedVersion: vuln.fixed_version
                },
                description: vuln.description,
                urls: vuln.urls ? vuln.urls.split(',') : []
            }))
        }
    })
    
    return {
        id: container.id,
        hostname: container.hostname,
        name: container.name,
        repository: container.repository,
        tag: container.tag,
        digest: container.digest,
        imageId: container.imageId,
        hasUpdate: container.has_update === 1,
        createdAt: container.created_at,
        scans: scansWithDetails
    }
}
