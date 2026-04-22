import dotenv from 'dotenv';
import logger from './logger.js';
import { initializeDB } from './db.js';
import { startScheduler, runDailyPipeline } from './scheduler.js';

// Load environment variables
dotenv.config();

async function main() {
    try {
        // 1. Initialize Database
        initializeDB();

        logger.info('--- LeadMachine Starting ---');
        logger.info('System environment verified.');

        // 2. Start the Daily Scheduler (for 10 AM runs)
        startScheduler();

        // 3. RUN IMMEDIATELY ON STARTUP
        logger.info('Initial startup run triggered...');
        runDailyPipeline();

        logger.info('LeadMachine is now active and running in the background.');

    } catch (error) {
        logger.error(`Failed to start LeadMachine: ${error.message}`);
        process.exit(1);
    }
}

main();
