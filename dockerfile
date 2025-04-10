FROM node:20-slim
WORKDIR /app

# SQLite3とPuppeteer(Chrome)の実行に必要な依存関係をインストール
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    # Puppeteer/Chrome用の依存関係
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    gnupg \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Puppeteerの設定 - サンドボックスなしで実行するための設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Google Chromeをインストール (新しい方法)
RUN wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get update \
    && apt-get install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

# ChromeをPuppeteerで実行する際のサンドボックス問題を回避するための設定
ENV PUPPETEER_ARGS='--no-sandbox --disable-setuid-sandbox'

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]