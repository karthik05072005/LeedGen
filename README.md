# LeadMachine 🚀

LeadMachine is a fully automated lead generation and outreach system. It finds businesses on Google Maps that don't have websites, generates a professional site for them, deploys it, records a personalized video, and sends it to them via WhatsApp.

## Features
- **Zero Human Involvement**: Fully automated pipeline from discovery to outreach.
- **Smart Filtering**: Targets only businesses without websites and valid Indian phone numbers.
- **Dynamic Site Generation**: Creates a responsive, modern landing page for every lead.
- **Vercel Deployment**: Automatically hosts sites using the Vercel REST API.
- **Screen Recording**: Captures a realistic browsing session of the new site as a video.
- **WhatsApp Outreach**: Sends a personalized video + message using `whatsapp-web.js`.
- **Scheduled Runs**: Contact 20-25 leads daily with randomized delays to prevent spam flags.

## Prerequisites
- **Node.js 18+**
- **FFmpeg**: Required for screen recording. (Download: `https://ffmpeg.org/download.html`)
- **Apify Account**: For Google Maps scraping.
- **Vercel Account**: For site hosting.
- **WhatsApp**: A dedicated phone number for outreach.

## Installation

1. **Install Dependencies**:
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure Environment**:
   - Copy `.env.example` to `.env`
   - Fill in your `APIFY_TOKEN`, `VERCEL_TOKEN`, and scraping preferences.

3. **Initialize Database**:
   ```bash
   npm run setup
   ```

## Usage

### Start the Scheduler
This will start the cron job and wait for the scheduled time (default 10:00 AM).
```bash
npm start
```

### Manual Scrape Only
If you just want to populate the database with leads:
```bash
npm run scrape-only
```

### Manual Pipeline Test (Send Immediately)
To process and send messages to 25 leads right now:
```bash
npm run send-test
```

## First Run Instructions (WhatsApp QR)
The first time you run the system, a QR code will appear in your terminal. 
1. Open WhatsApp on your phone.
2. Go to **Linked Devices** > **Link a Device**.
3. Scan the terminal QR code.
The session will be saved in `.wwebjs_auth`, so you won't need to scan again.

## Important Notes
- **WhatsApp Ban Risk**: Outreach to strangers can lead to bans. Use a dedicated SIM/Number. The system has built-in delays (15-40 mins) to mimic human behavior.
- **Disk Space**: Site videos and temp files are deleted immediately after sending to keep the system clean.
- **Logs**: Monitor `logs/app.log` for detailed activity.

---
Built with ❤️ by Kodexa Tech.
