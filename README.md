# かざぐるま乗換案内

千代田区福祉交通「風ぐるま」の乗換案内ウェブアプリケーション

## セットアップ

```bash
npm install
```

## 環境変数の設定

プロジェクトのルートに環境変数ファイル（開発環境：`.env.local`、本番環境：`.env`）を作成し、以下の環境変数を設定してください：

```
# Google Maps API設定
GOOGLE_MAPS_API_KEY=your_api_key_here

# 支援先のurl
NEXT_PUBLIC_KOFI_TIER_PAGE_URL=ko_fi_url_here

# アプリケーションのベースURL
NEXT_PUBLIC_APP_URL=http://example.com

# Cloudflare Tunnelの設定
CLOUDFLARE_TUNNEL_TOKEN=your_api_key_here

# GoogleAnalytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-ID
```

プロジェクトのルートに`transit-config.json`を作成してください。

```json
{
  "sqlitePath": "prisma/.temp/data.db",
  "agencies": [
    {
      "agency_key": "chiyoda",
      "url": "https://example.com"
    }
  ],
  "verbose": true
}
```

## 開発サーバーの起動

`docs/manual/docker-setup.md` を参照のこと。

## テストの実行

```bash
npm test
```

## 主な機能

- 住所や現在地からの乗換案内の検索
- バス停の出発時刻の表示

## 技術スタック

- Next.js
- TypeScript
- DaisyUI (Tailwind CSS)
- Jest + React Testing Library

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
