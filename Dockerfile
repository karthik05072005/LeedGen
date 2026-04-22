# Use official Node.js image with Debian (needed for Playwright/Chromium)
FROM node:20-bullseye-slim

# Install Chromium system dependencies for Playwright + WhatsApp-web.js
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    wget \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package*.json ./

# Install Node dependencies
RUN npm install --legacy-peer-deps

# Install Playwright Chromium browser
RUN npx playwright install chromium

# Copy the rest of the project
COPY . .

# Create required directories
RUN mkdir -p videos logs temp_sites

# Environment variable hints (actual values come from Coolify dashboard)
ENV NODE_ENV=production

# Start the app
CMD ["node", "src/index.js"]
