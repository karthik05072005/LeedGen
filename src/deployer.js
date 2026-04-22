import fetch from 'node-fetch';
import fs from 'fs';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

export async function deployToVercel(lead, filePath) {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
        throw new Error('VERCEL_TOKEN is not set in .env');
    }

    const projectName = `lm-${lead.apify_place_id}`.toLowerCase().substring(0, 50);
    logger.info(`Deploying ${lead.name} to Vercel as ${projectName}...`);

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Create deployment
        const response = await fetch('https://api.vercel.com/v13/deployments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: projectName,
                target: 'production',
                files: [{
                    file: 'index.html',
                    data: fileContent
                }],
                projectSettings: {
                    framework: null
                }
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(`Vercel API error: ${data.error.message}`);
        }

        const deploymentId = data.id;
        let url = data.url;

        // Poll for ready state
        logger.info(`Deployment created (ID: ${deploymentId}). Waiting for READY state...`);
        
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!isReady && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const statusData = await statusRes.json();
            
            if (statusData.readyState === 'READY') {
                isReady = true;
                url = statusData.url;
                logger.info(`Deployment for ${lead.name} is READY: https://${url}`);
            } else if (statusData.readyState === 'ERROR') {
                throw new Error('Vercel deployment failed with READYSTATE: ERROR');
            }
            attempts++;
        }

        if (!isReady) throw new Error('Vercel deployment timeout');

        return `https://${url}`;
    } catch (error) {
        logger.error(`Deployment error for ${lead.name}: ${error.message}`);
        throw error;
    }
}
