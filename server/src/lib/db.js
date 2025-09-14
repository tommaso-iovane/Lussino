import { Database } from 'bun:sqlite'
import crypt from './crypt'
import fs from 'fs/promises'

// Create data directory if it doesn't exist
try {
    await fs.access('./data')
} catch {
    await fs.mkdir('./data', { recursive: true })
}

const db = new Database('./data/lussino.sqlite', { create: true })
db.run("PRAGMA journal_mode = WAL;");

export const initDB = async () => {
    // check if users and containers tables exist
    const query = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    const usersExists = query.get('users')
    const containersExists = query.get('containers')
    const vuln_scansExists = query.get('vuln_scans')

    if (!usersExists) {
        db.run(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `)
        const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
        stmt.run('admin', await crypt.hashPassword('changeme'))
    }

    if (!containersExists) {
        db.run(`
            CREATE TABLE containers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hostname TEXT,
                name TEXT,
                repository TEXT,
                tag TEXT,
                digest TEXT,
                imageId TEXT,
                has_update INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `)
    }

    if (!vuln_scansExists) {
        db.run(`
            CREATE TABLE vuln_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                container_id INTEGER NOT NULL,
                scan_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                grype_version TEXT,
                total_vulnerabilities INTEGER DEFAULT 0,
                critical_count INTEGER DEFAULT 0,
                high_count INTEGER DEFAULT 0,
                medium_count INTEGER DEFAULT 0,
                low_count INTEGER DEFAULT 0,
                image_digest TEXT,
                image_tags TEXT,
                os_name TEXT,
                os_version TEXT,
                scan_results_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (container_id) REFERENCES containers (id) ON DELETE CASCADE
            )
        `)
        
        // Create vulnerability details table for individual vulnerabilities
        db.run(`
            CREATE TABLE vulnerability_details (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id INTEGER NOT NULL,
                cve_id TEXT NOT NULL,
                severity TEXT NOT NULL,
                risk_score REAL,
                package_name TEXT NOT NULL,
                package_version TEXT NOT NULL,
                package_type TEXT,
                fixed_version TEXT,
                description TEXT,
                urls TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (scan_id) REFERENCES vuln_scans (id) ON DELETE CASCADE
            )
        `)
        
        // Create index for better query performance
        db.run(`
            CREATE INDEX idx_vuln_scans_container_id ON vuln_scans(container_id);
            CREATE INDEX idx_vuln_scans_timestamp ON vuln_scans(scan_timestamp);
            CREATE INDEX idx_vulnerability_details_scan_id ON vulnerability_details(scan_id);
            CREATE INDEX idx_vulnerability_details_cve_id ON vulnerability_details(cve_id);
            CREATE INDEX idx_vulnerability_details_severity ON vulnerability_details(severity);
        `)
    }
}



export default db
