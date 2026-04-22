import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import logger from './logger.js';
import fs from 'fs';
import path from 'path';

export async function initWhatsApp() {
    return new Promise((resolve, reject) => {
        logger.info('Initializing WhatsApp client...');
        
        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        client.on('qr', (qr) => {
            logger.info('WhatsApp QR Code received. Scan it now:');
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', () => {
            logger.info('WhatsApp client is READY');
            resolve(client);
        });

        client.on('auth_failure', (msg) => {
            logger.error('WhatsApp authentication failure: ' + msg);
            reject(msg);
        });

        client.initialize().catch(err => {
            logger.error('Failed to initialize WhatsApp: ' + err.message);
            reject(err);
        });
    });
}

export async function sendLeadMessage(client, phone, siteUrl, videoPath, businessName) {
    try {
        // WhatsApp ID format: 91XXXXXXXXXX@c.us (remove + prefix)
        const chatId = phone.replace('+', '') + '@c.us';
        logger.info(`Sending message to ${businessName} (${chatId})...`);

        // 1. Send video if it was successfully recorded
        if (videoPath && fs.existsSync(videoPath)) {
            const ext = path.extname(videoPath).toLowerCase();
            const mimeType = ext === '.webm' ? 'video/webm' : 'video/mp4';
            const fileData = fs.readFileSync(videoPath).toString('base64');
            const media = new MessageMedia(mimeType, fileData, `website_preview${ext}`);

            const caption = `Hi! Is this ${businessName}? 🙏\n\nI'm Karthik from Kodexa Tech — I build websites for local businesses in Bangalore.\n\nI noticed you don't have a website yet, so I went ahead and built a free preview for you.\nCheck the video above 👆\n\nIf you like it, I can put it live on the internet with your name on it for just ₹4,999.\n\nInterested?`;

            await client.sendMessage(chatId, media, { caption });
            logger.info(`Video + caption sent to ${businessName}`);
        } else {
            // Fallback: send text-only if video recording failed
            logger.warn(`No video for ${businessName}, sending text-only message.`);
            const message = `Hi! 👋
I noticed *${businessName}* doesn't have a website yet.

I went ahead and built one specially for you — it looks amazing! 🚀

We build professional websites for local businesses starting at just ₹4,999.
Want to take it live with your own domain? Reply and I'll send you all the details!

— Raka, Kodexa Tech`;
            await client.sendMessage(chatId, message);
            logger.info(`Text message sent to ${businessName}`);
        }

        return true;
    } catch (error) {
        logger.error(`WhatsApp send error for ${businessName}: ${error.message}`);
        return false;
    }
}
