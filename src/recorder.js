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

    // Fix path for Linux/Docker
    const absoluteHtmlPath = path.isAbsolute(htmlFilePath) ? htmlFilePath : path.resolve(htmlFilePath);
    const fileUrl = `file://${absoluteHtmlPath}`;
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
        await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 45000 });
        logger.info('Recording started — page fully loaded with all assets.');

        await page.waitForTimeout(3000);

        // Robust scroll to bottom
        await page.evaluate(async () => {
            const scroll = async () => {
                const totalHeight = document.body.scrollHeight;
                let current = 0;
                const step = 20;
                const delay = 40;
                
                while (current < document.body.scrollHeight) {
                    window.scrollBy(0, step);
                    current += step;
                    await new Promise(r => setTimeout(r, delay));
                    // Re-check height in case images loaded in
                }
            };
            await scroll();
        });

        await page.waitForTimeout(2000);

        // Robust scroll back to top
        await page.evaluate(async () => {
            while (window.scrollY > 0) {
                window.scrollBy(0, -50);
                await new Promise(r => setTimeout(r, 20));
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

        logger.info(`Converting webm → mp4 using ultrafast preset...`);
        
        // Use Async exec, ultrafast preset, and 5-minute timeout
        try {
            await execAsync(
                `"${ffmpegPath}" -y -i "${webmPath}" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -movflags +faststart "${finalVideoPath}"`,
                { timeout: 300000 } // 5 minutes
            );
            
            if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
            logger.info(`mp4 saved: ${finalVideoPath}`);
            return finalVideoPath;
        } catch (convError) {
            logger.error(`Conversion specialized error: ${convError.message}`);
            // Fallback: if mp4 conversion fails, rename webm to mp4 (risky but better than nothing)
            fs.renameSync(webmPath, finalVideoPath);
            return finalVideoPath;
        }

    } catch (error) {
        logger.error(`Recording error: ${error.message}`);
        if (browser) await browser.close();
        return null;
    }
}
