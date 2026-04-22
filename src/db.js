import Database from 'better-sqlite3';
import logger from './logger.js';
import path from 'path';

const dbPath = path.resolve('lead_machine.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        category TEXT,
        address TEXT,
        city TEXT,
        apify_place_id TEXT UNIQUE,
        site_url TEXT,
        video_path TEXT,
        whatsapp_sent INTEGER DEFAULT 0,
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        error TEXT
    );

    CREATE TABLE IF NOT EXISTS scrape_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city TEXT,
        category TEXT,
        total_found INTEGER,
        no_website_count INTEGER,
        ran_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

logger.info('Database initialized at ' + dbPath);

export function insertLead(lead) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO leads (name, phone, category, address, city, apify_place_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(lead.name, lead.phone, lead.category, lead.address, lead.city, lead.apify_place_id);
}

export function getUncontactedLeads(limit = 25) {
    const stmt = db.prepare(`SELECT * FROM leads WHERE whatsapp_sent = 0 AND error IS NULL ORDER BY RANDOM() LIMIT ?`);
    return stmt.all(limit);
}

export function markAsSent(id, siteUrl, videoPath) {
    const stmt = db.prepare(`
        UPDATE leads 
        SET whatsapp_sent = 1, sent_at = datetime('now'), site_url = ?, video_path = ? 
        WHERE id = ?
    `);
    return stmt.run(siteUrl, videoPath, id);
}

export function markError(id, errorMessage) {
    const stmt = db.prepare(`UPDATE leads SET error = ? WHERE id = ?`);
    return stmt.run(errorMessage, id);
}

export function getLeadCount() {
    return db.prepare(`SELECT COUNT(*) as count FROM leads`).get().count;
}

export function getUncontactedCount() {
    return db.prepare(`SELECT COUNT(*) as count FROM leads WHERE whatsapp_sent = 0 AND error IS NULL`).get().count;
}

export function insertScrapeRun(run) {
    const stmt = db.prepare(`
        INSERT INTO scrape_runs (city, category, total_found, no_website_count)
        VALUES (?, ?, ?, ?)
    `);
    return stmt.run(run.city, run.category, run.total_found, run.no_website_count);
}

export default db;
