
// @ts-nocheck
import db from '../lib/db'


// Helper functions for vulnerability scans
export const saveScanResults = (containerid, grypeScanResults) => {
    // Get risk threshold from environment (default to 0 if not set)
    const ignoreRiskBelow = parseFloat(Bun.env.IGNORE_RISK_BELOW || '0')
    
    // Filter vulnerabilities based on risk threshold
    const filteredMatches = grypeScanResults.matches?.filter(match => {
        const riskScore = match.vulnerability?.risk || 0
        return riskScore >= ignoreRiskBelow
    }) || []
    
    console.log(`Filtering vulnerabilities: ${grypeScanResults.matches?.length || 0} total, ${filteredMatches.length} above risk threshold ${ignoreRiskBelow}`)
    
    const stmt = db.prepare(`
        INSERT INTO vuln_scans (
            container_id, grype_version, total_vulnerabilities,
            critical_count, high_count, medium_count, low_count,
            image_digest, image_tags, os_name, os_version, scan_results_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    // Count vulnerabilities by severity (only filtered ones)
    const severityCounts = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
    }
    
    filteredMatches.forEach(match => {
        const severity = match.vulnerability?.severity
        if (severityCounts.hasOwnProperty(severity)) {
            severityCounts[severity]++
        }
    })
    
    const totalVulns = filteredMatches.length
    const imageDigest = grypeScanResults.source?.target?.manifestDigest || null
    const imageTags = grypeScanResults.source?.target?.tags?.join(',') || null
    const osName = grypeScanResults.distro?.name || null
    const osVersion = grypeScanResults.distro?.version || null
    const gryeVersion = grypeScanResults.descriptor?.name + ' ' + grypeScanResults.descriptor?.version || null
    
    // Store original scan results but use filtered counts
    const result = stmt.run(
        containerid,
        gryeVersion,
        totalVulns,
        severityCounts.Critical,
        severityCounts.High,
        severityCounts.Medium,
        severityCounts.Low,
        imageDigest,
        imageTags,
        osName,
        osVersion,
        JSON.stringify(grypeScanResults) // Keep original for reference
    )
    
    const scanId = result.lastInsertRowid
    
    // Save individual vulnerability details (only filtered ones)
    if (filteredMatches.length > 0) {
        const detailStmt = db.prepare(`
            INSERT INTO vulnerability_details (
                scan_id, cve_id, severity, risk_score, package_name,
                package_version, package_type, fixed_version, description, urls
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        
        filteredMatches.forEach(match => {
            const vuln = match.vulnerability
            const artifact = match.artifact
            
            detailStmt.run(
                scanId,
                vuln.id || '',
                vuln.severity || '',
                vuln.risk || 0,
                artifact.name || '',
                artifact.version || '',
                artifact.type || '',
                vuln.fix?.versions?.join(',') || null,
                vuln.description || '',
                vuln.urls?.join(',') || ''
            )
        })
    }
    
    return scanId
}

export const getScanHistory = (containerId) => {
    const stmt = db.prepare(`
        SELECT id, scan_timestamp, total_vulnerabilities, critical_count,
               high_count, medium_count, low_count, grype_version
        FROM vuln_scans 
        WHERE container_id = ? 
        ORDER BY scan_timestamp DESC
    `)
    return stmt.all(containerId)
}

export const getScanDetails = (scanId) => {
    const scanStmt = db.prepare('SELECT * FROM vuln_scans WHERE id = ?')
    const detailsStmt = db.prepare('SELECT * FROM vulnerability_details WHERE scan_id = ?')
    
    const scan = scanStmt.get(scanId)
    const vulnerabilities = detailsStmt.all(scanId)
    
    return {
        scan,
        vulnerabilities
    }
}