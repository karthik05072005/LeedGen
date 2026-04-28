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
    let webmPath = null;

    // Total timeout for the entire recording process (e.g. 5 minutes)
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Recording timed out after 5 minutes')), 300000)
    );

    const recordingTask = (async () => {
        try {
            browser = await chromium.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] // Better for VPS/Docker
            });
            const context = await browser.newContext({
                viewport: { width: 1280, height: 800 },
                recordVideo: {
                    dir: tempDir,
                    size: { width: 1280, height: 800 }
                }
            });

            const page = await context.newPage();
            await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 60000 });
            logger.info('Recording started...');

            await page.waitForTimeout(3000);

            // SCROLLING LOGIC
            const startTime = Date.now();
            while (Date.now() - startTime < 25000) { // 25 seconds scroll down
                await page.mouse.wheel(0, 150);
                await page.waitForTimeout(200);
                const isBottom = await page.evaluate(() => (window.innerHeight + window.scrollY) >= document.body.scrollHeight);
                if (isBottom) break; 
            }

            await page.waitForTimeout(2000);

            const upStartTime = Date.now();
            while (Date.now() - upStartTime < 10000) { // 10 seconds scroll up
                await page.mouse.wheel(0, -300);
                await page.waitForTimeout(150);
                const isTop = await page.evaluate(() => window.scrollY <= 0);
                if (isTop) break;
            }

            await page.waitForTimeout(2000);

            const videoObj = await page.video();
            webmPath = await videoObj.path();
            
            await context.close();
            await browser.close();
            browser = null;

            if (!webmPath || !fs.existsSync(webmPath)) {
                throw new Error('WebM file not generated');
            }

            logger.info(`Converting to MP4...`);
            await execAsync(
                `"${ffmpegPath}" -y -i "${webmPath}" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -movflags +faststart "${finalVideoPath}"`,
                { timeout: 120000 }
            );

            return finalVideoPath;
        } catch (error) {
            if (browser) {
                try { await browser.close(); } catch (e) {}
            }
            throw error;
        } finally {
            // Cleanup the raw webm file
            if (webmPath && fs.existsSync(webmPath)) {
                try { fs.unlinkSync(webmPath); } catch (e) {}
            }
        }
    })();

    try {
        return await Promise.race([recordingTask, timeoutPromise]);
    } catch (error) {
        logger.error(`Recording error for ${leadId}: ${error.message}`);
        return null;
    }
}
