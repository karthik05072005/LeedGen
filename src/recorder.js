import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import logger from './logger.js';

const execAsync = promisify(exec);

export async function recordSite(htmlFilePath, leadId) {
    const videoDir = path.resolve('videos');
    const tempDir = path.resolve('videos', 'temp');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const finalVideoPath = path.join(videoDir, `${leadId}.mp4`);
    const absoluteHtmlPath = path.isAbsolute(htmlFilePath) ? htmlFilePath : path.resolve(htmlFilePath);
    const fileUrl = `file://${absoluteHtmlPath}`;

    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 }, // Slightly taller viewport
            recordVideo: {
                dir: tempDir,
                size: { width: 1280, height: 800 }
            }
        });

        const page = await context.newPage();
        await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 60000 });
        logger.info('Recording started — capturing entire premium site...');

        // Wait for animations to settle
        await page.waitForTimeout(3000);

        // NATIVE SCROLLING LOGIC (40-45 Seconds Total)
        const totalDuration = 40000; // 40 seconds of movement
        const startTime = Date.now();
        
        logger.info('Starting smooth native scroll to bottom...');
        
        // Scroll down slowly (approx 30 seconds)
        while (Date.now() - startTime < 30000) {
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(150);
            
            // Check if we hit the bottom, if so, wait a bit and break or stay
            const isBottom = await page.evaluate(() => (window.innerHeight + window.scrollY) >= document.body.scrollHeight);
            if (isBottom) {
                await page.waitForTimeout(1000);
                break; 
            }
        }

        logger.info('Showing footer/contact, then scrolling back up...');
        await page.waitForTimeout(3000);

        // Scroll back up (approx 10 seconds)
        const upStartTime = Date.now();
        while (Date.now() - upStartTime < 10000) {
            await page.mouse.wheel(0, -200);
            await page.waitForTimeout(100);
            
            const isTop = await page.evaluate(() => window.scrollY <= 0);
            if (isTop) break;
        }

        // Final hold on hero
        await page.waitForTimeout(2000);

        const videoObj = await page.video();
        await context.close();
        await browser.close();
        browser = null;

        const webmPath = await videoObj.path();
        if (!webmPath || !fs.existsSync(webmPath)) return null;

        logger.info(`Processing high-quality video conversion...`);
        try {
            await execAsync(
                `"${ffmpegPath}" -y -i "${webmPath}" -c:v libx264 -preset ultrafast -crf 24 -c:a aac -movflags +faststart "${finalVideoPath}"`,
                { timeout: 300000 }
            );
            if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
            return finalVideoPath;
        } catch (e) {
            fs.renameSync(webmPath, finalVideoPath);
            return finalVideoPath;
        }

    } catch (error) {
        logger.error(`Recording error: ${error.message}`);
        if (browser) await browser.close();
        return null;
    }
}
