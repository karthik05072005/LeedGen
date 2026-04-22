import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import logger from './logger.js';

export async function recordSite(htmlFilePath, leadId) {
    const videoDir = path.resolve('videos');
    const tempDir = path.resolve('videos', 'temp');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const finalVideoPath = path.join(videoDir, `${leadId}.mp4`);

    // Open the local HTML file directly — no hosting needed!
    const fileUrl = `file:///${htmlFilePath.replace(/\\/g, '/')}`;
    logger.info(`Recording local file: ${fileUrl}`);

    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });

        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            recordVideo: {
                dir: tempDir,
                size: { width: 1280, height: 720 }
            }
        });

        const page = await context.newPage();
        await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
        logger.info('Recording started — page loaded.');

        // 3s pause on load
        await page.waitForTimeout(3000);

        // Smooth scroll down through the whole page
        await page.evaluate(async () => {
            const totalHeight = document.body.scrollHeight;
            const step = 5;
            const delay = 55;
            let current = 0;
            while (current < totalHeight) {
                window.scrollBy(0, step);
                current += step;
                await new Promise(r => setTimeout(r, delay));
            }
        });

        await page.waitForTimeout(2000);

        // Scroll back to top
        await page.evaluate(async () => {
            const step = 10;
            const delay = 40;
            while (window.scrollY > 0) {
                window.scrollBy(0, -step);
                await new Promise(r => setTimeout(r, delay));
            }
        });

        await page.waitForTimeout(3000);

        const videoObj = await page.video();
        await context.close();
        await browser.close();
        browser = null;

        const webmPath = await videoObj.path();

        if (!webmPath || !fs.existsSync(webmPath)) {
            logger.warn('Playwright did not produce a video file.');
            return null;
        }

        logger.info(`Converting webm → mp4 using bundled ffmpeg...`);
        execSync(
            `"${ffmpegPath}" -y -i "${webmPath}" -c:v libx264 -preset fast -crf 28 -c:a aac -movflags +faststart "${finalVideoPath}"`,
            { stdio: 'pipe', timeout: 120000 }
        );

        fs.unlinkSync(webmPath);
        logger.info(`mp4 saved: ${finalVideoPath}`);
        return finalVideoPath;

    } catch (error) {
        logger.error(`Recording error: ${error.message}`);
        if (browser) await browser.close();
        return null;
    }
}
