FROM node:20-slim
WORKDIR /app

# SQLite3のビルドに必要な依存関係をインストール
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]