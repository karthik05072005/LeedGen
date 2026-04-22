import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import logger from './logger.js';
import { insertLead, insertScrapeRun } from './db.js';

dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

export async function runScraper() {
    const city = process.env.SCRAPE_CITY || 'Bangalore';
    const category = process.env.SCRAPE_CATEGORY || 'restaurants';
    const maxResults = parseInt(process.env.SCRAPE_MAX_RESULTS || '200');

    logger.info(`Starting scraper for ${category} in ${city}...`);

    try {
        const input = {
            "searchStringsArray": [`${category} in ${city}`],
            "maxCrawledPlacesPerSearch": maxResults,
            "language": "en",
            "maxImages": 0,
            "exportPlaceUrls": false
        };

        // Start the actor and wait for it to finish
        const run = await client.actor("apify/google-maps-scraper").call(input);
        
        logger.info(`Scrape run finished. Fetching results...`);

        // Get results from the dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        let totalFound = items.length;
        let noWebsiteCount = 0;

        for (const item of items) {
            // Filter: No website, has phone, Indian number (+91 or 10 digits)
            if (!item.website && item.phone) {
                let normalizedPhone = item.phone.replace(/[\s\-\(\)]/g, '');
                
                // Simple Indian phone validation/normalization
                if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
                    normalizedPhone = '+' + normalizedPhone;
                } else if (normalizedPhone.length === 10 && /^\d+$/.test(normalizedPhone)) {
                    normalizedPhone = '+91' + normalizedPhone;
                }

                if (normalizedPhone.startsWith('+91') && normalizedPhone.length === 13) {
                    const lead = {
                        name: item.title,
                        phone: normalizedPhone,
                        category: item.categoryName || category,
                        address: item.address,
                        city: city,
                        apify_place_id: item.placeId
                    };

                    const result = insertLead(lead);
                    if (result.changes > 0) {
                        noWebsiteCount++;
                    }
                }
            }
        }

        insertScrapeRun({
            city,
            category,
            total_found: totalFound,
            no_website_count: noWebsiteCount
        });

        logger.info(`Scrape complete. Found ${totalFound} total, added ${noWebsiteCount} new leads without websites.`);
        return noWebsiteCount;

    } catch (error) {
        logger.error(`Scraper error: ${error.message}`);
        throw error;
    }
}
