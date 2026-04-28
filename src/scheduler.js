import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from './logger.js';
import { runScraper } from './scraper.js';
import { getUncontactedLeads, getUncontactedCount, markAsSent, markError } from './db.js';
import { generateSite } from './siteGenerator.js';
import { recordSite } from './recorder.js';
import { initWhatsApp, sendLeadMessage } from './whatsapp.js';

dotenv.config();

let whatsappClient = null;
let isPipelineRunning = false;

export async function runDailyPipeline() {
    if (isPipelineRunning) {
        logger.warn('Daily pipeline is already running. Skipping this trigger.');
        return;
    }

    isPipelineRunning = true;
    logger.info('Starting Daily LeadMachine Pipeline...');

    // Startup cleanup
    cleanupTempDirs();

    try {
        // 1. Initialize WhatsApp if not already
        if (!whatsappClient) {
            whatsappClient = await initWhatsApp();
        }

        // 2. Check if we need to scrape more leads
        const uncontactedCount = getUncontactedCount();
        logger.info(`Currently have ${uncontactedCount} uncontacted leads in DB.`);

        if (uncontactedCount < 50) {
            logger.info('Low lead count, running scraper...');
            await runScraper();
        }

        // 3. Pick leads for today
        const limit = parseInt(process.env.DAILY_LEAD_LIMIT || '25');
        const leads = getUncontactedLeads(limit);
        logger.info(`Processing ${leads.length} leads for today.`);

        let successCount = 0;
        let errorCount = 0;

        for (const lead of leads) {
            let videoPath = null;
            let htmlPath = null;
            
            try {
                logger.info(`--------------------------------------------------`);
                logger.info(`Processing Lead: ${lead.name} (${lead.phone})`);

                // a. Generate site HTML locally
                htmlPath = await generateSite(lead);

                // b. Record video from local file
                videoPath = await recordSite(htmlPath, lead.apify_place_id);

                // c. Send WhatsApp video
                const sent = await sendLeadMessage(
                    whatsappClient,
                    lead.phone,
                    null,
                    videoPath,
                    lead.name
                );

                if (sent) {
                    markAsSent(lead.id, null, videoPath);
                    successCount++;
                    logger.info(`✅ Lead ${lead.name} successfully processed.`);
                } else {
                    throw new Error('WhatsApp sending failed');
                }

            } catch (err) {
                logger.error(`Error processing lead ${lead.name}: ${err.message}`);
                markError(lead.id, err.message);
                errorCount++;
            } finally {
                // Ensure cleanup of temporary files regardless of success/failure
                try {
                    if (videoPath && fs.existsSync(videoPath)) {
                        fs.unlinkSync(videoPath);
                        logger.info(`Cleaned up video: ${videoPath}`);
                    }
                    if (htmlPath) {
                        const tempDir = path.dirname(htmlPath);
                        if (fs.existsSync(tempDir)) {
                            fs.rmSync(tempDir, { recursive: true, force: true });
                            logger.info(`Cleaned up temp site: ${tempDir}`);
                        }
                    }
                } catch (cleanupErr) {
                    logger.error(`Cleanup error: ${cleanupErr.message}`);
                }
            }

            // Random delay before next lead (15–40 minutes)
            const minMin = parseInt(process.env.DELAY_MIN_MINUTES || '15');
            const maxMin = parseInt(process.env.DELAY_MAX_MINUTES || '40');
            const delayMs = Math.floor(Math.random() * (maxMin - minMin + 1) + minMin) * 60000;
            logger.info(`Waiting ${Math.round(delayMs / 60000)} minutes before next lead...`);
            await new Promise(r => setTimeout(r, delayMs));
        }

        logger.info('Daily pipeline complete.');
        logger.info(`Summary: ${successCount} sent, ${errorCount} errors.`);

    } catch (err) {
        logger.error(`Critical pipeline failure: ${err.message}`);
    } finally {
        isPipelineRunning = false;
    }
}

function cleanupTempDirs() {
    logger.info('Performing startup cleanup of temporary directories...');
    const dirsToClean = [
        path.resolve('videos/temp'),
        path.resolve('videos'),
        path.resolve('temp_sites')
    ];

    dirsToClean.forEach(dir => {
        if (fs.existsSync(dir)) {
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (fs.lstatSync(fullPath).isDirectory()) {
                        if (file !== 'temp') { // Don't delete the temp dir itself if we are inside videos
                             fs.rmSync(fullPath, { recursive: true, force: true });
                        }
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                }
                logger.info(`Cleaned directory: ${dir}`);
            } catch (err) {
                logger.warn(`Could not fully clean ${dir}: ${err.message}`);
            }
        }
    });
}

export function startScheduler() {
    const cronTime = process.env.CRON_TIME || '0 10 * * *';
    logger.info(`Scheduler started with cron: ${cronTime}`);
    cron.schedule(cronTime, () => {
        runDailyPipeline();
    });
}
