import dotenv from 'dotenv';
import { execSync } from 'child_process';
import fs from 'fs';
import logger from './logger.js';
import { startScheduler } from './scheduler.js';

dotenv.config();

function checkEnv() {
    const required = [
        'APIFY_TOKEN',
        'VERCEL_TOKEN',
        'SCRAPE_CITY',
        'SCRAPE_CATEGORY'
    ];
    
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        logger.error('Please check your .env file.');
        process.exit(1);
    }
}

function checkFfmpeg() {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        logger.info('ffmpeg is installed and available.');
    } catch (e) {
        logger.warn('WARNING: ffmpeg not found! Video recording will fail. Please install ffmpeg.');
    }
}

async function bootstrap() {
    logger.info('--- LeadMachine Starting ---');
    
    // Create folders
    ['logs', 'videos', 'temp_sites'].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    });

    checkEnv();
    checkFfmpeg();

    logger.info('System environment verified.');
    
    // Start the cron scheduler
    startScheduler();
    
    logger.info('LeadMachine is now running in the background.');
}

bootstrap().catch(err => {
    logger.error('Startup error: ' + err.message);
});
