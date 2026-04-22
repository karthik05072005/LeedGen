import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { insertLead } from './db.js';
import crypto from 'crypto';

export async function importFromRawData() {
    const filePath = path.resolve('leads_to_import.csv');
    
    if (!fs.existsSync(filePath)) {
        logger.error('leads_to_import.csv not found!');
        return;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').map(l => l.trim());

        let count = 0;
        let skipped = 0;

        for (let i = 0; i < lines.length; i++) {
            // Entries in your raw data start with a number (Index)
            if (/^\d+$/.test(lines[i])) {
                try {
                    const name = lines[i + 1];
                    const city = lines[i + 5];
                    const phoneCandidate = lines[i + 8];
                    const category = lines[i + 11];

                    // Check if phoneCandidate actually looks like a phone number
                    // (It should start with +91 or have lots of digits, not "1 item" or a URL)
                    if (phoneCandidate && (phoneCandidate.startsWith('+') || /\d{10}/.test(phoneCandidate)) && !phoneCandidate.includes('item') && !phoneCandidate.includes('http')) {
                        
                        const lead = {
                            name: name,
                            phone: phoneCandidate,
                            category: category || 'Business',
                            city: city || 'Bangalore',
                            address: lines[i + 4] || 'Local Area',
                            apify_place_id: 'manual_' + crypto.randomBytes(4).toString('hex')
                        };

                        // Normalize phone format for WhatsApp
                        let cleanPhone = lead.phone.replace(/[\s\-\(\)]/g, '');
                        if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
                            cleanPhone = '+' + cleanPhone;
                        } else if (cleanPhone.length === 10) {
                            cleanPhone = '+91' + cleanPhone;
                        }

                        lead.phone = cleanPhone;

                        const result = insertLead(lead);
                        if (result.changes > 0) {
                            count++;
                        }
                    } else {
                        skipped++;
                    }
                    
                    // Move index forward to skip the rest of this block
                    i += 10; 
                } catch (e) {
                    // Skip errors in parsing specific blocks
                }
            }
        }

        logger.info(`Successfully imported ${count} leads. Skipped ${skipped} leads without phone numbers.`);
    } catch (error) {
        logger.error(`Import error: ${error.message}`);
    }
}

importFromRawData();
