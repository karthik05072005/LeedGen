import fs from 'fs';
import path from 'path';
import logger from './logger.js';

export async function generateSite(lead) {
    const templatePath = path.resolve('templates/index.html');
    const tempDir = path.resolve('temp_sites', lead.apify_place_id);
    
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
        let html = fs.readFileSync(templatePath, 'utf8');

        const tagline = `Your trusted ${lead.category.toLowerCase()} in ${lead.city}`;
        const year = new Date().getFullYear().toString();

        const replacements = {
            '{{BUSINESS_NAME}}': lead.name,
            '{{CATEGORY}}': lead.category,
            '{{PHONE}}': lead.phone,
            '{{ADDRESS}}': lead.address || 'Contact us for location',
            '{{CITY}}': lead.city,
            '{{TAGLINE}}': tagline,
            '{{YEAR}}': year
        };

        for (const [placeholder, value] of Object.entries(replacements)) {
            html = html.replace(new RegExp(placeholder, 'g'), value);
        }

        const outputPath = path.join(tempDir, 'index.html');
        fs.writeFileSync(outputPath, html);

        logger.info(`Generated site for ${lead.name} at ${outputPath}`);
        return outputPath;
    } catch (error) {
        logger.error(`Site generation error for ${lead.name}: ${error.message}`);
        throw error;
    }
}
