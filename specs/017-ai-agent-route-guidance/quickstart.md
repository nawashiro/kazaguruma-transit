# Quickstart: AIエージェント向け経路案内の検証

## 前提

- Node.js 22 と依存パッケージが利用可能であること。
- `transit-config.json` と `.env.local` は既存のトップページを起動できる状態であること。

## 自動検証

1. まず機能の振る舞いテストを実装前に追加する。
2. 対象のページテストを実行する。

   ```bash
   npm test -- --runInBand src/app/__tests__/page.test.tsx
   ```

3. 静的品質を確認する。

   ```bash
   npm run lint
   npm test -- --runInBand
   npm run build
   ```

## 手動検証

1. `npm run dev` を起動し、トップページを開く。
2. 非公式サービス案内カードの直後に「AIエージェントのかたへ」があることを確認する。
3. 初回表示時は、その案内本文が一切表示されないことを確認する。
4. 見出しをクリックまたはタップして開き、3段階の案内とURLテンプレート全体が表示されることを確認する。再度操作して閉じることを確認する。
5. Tab キーと Enter または Space キーで同じ開閉を行い、見出しのフォーカス表示と開閉状態を確認する。
6. 375px幅と1280px幅で開いた状態を確認し、案内文とURLテンプレートを横スクロールせず読めることを確認する。

詳細な表示・操作契約は [UI Contract](./contracts/ai-agent-guidance-ui.md)、状態と固定情報は [Data Model](./data-model.md) を参照する。
