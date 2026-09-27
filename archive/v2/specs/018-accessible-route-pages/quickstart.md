# Quickstart: 認証・場所詳細・レート制限の専用ページ化

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**UI contract**: [contracts/ui-page-contract.md](./contracts/ui-page-contract.md)

## Prerequisites

- Node.js 22.x（リポジトリ指定）
- `npm ci`済みのリポジトリ
- 既存の`.env.local`、`transit-config.json`、認証・場所データ取得設定
- ブラウザのPasskey利用環境（認証の実機確認時のみ）

## Static checks

```bash
npx tsc --noEmit --incremental false
npm run lint
npm run test -- --runInBand

git diff --check
git status --short --untracked-files=all
```

`next lint`の廃止予定通知や既存warningは、今回の変更由来のエラーと分けて記録する。

`npm run build`はPrisma schema push、GTFS取得、Next buildを実行するため、作業ツリーへ副作用がないことを確認できる最終段階でのみ実行する。

## Final build check

```bash
npm run build
```

## Focused page checks

実装後に、tasks.mdで固定した以下の正本テストを実行する。

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/auth/__tests__/AuthenticationForm.test.tsx \
  src/app/login/__tests__/page.test.tsx \
  src/app/signup/__tests__/page.test.tsx \
  'src/app/location-detail/[id]/__tests__/page.test.tsx' \
  src/components/features/__tests__/LocationDetailContent.test.tsx \
  src/app/rate-limit/__tests__/page.test.tsx \
  src/components/features/__tests__/OriginSelector.test.tsx \
  src/components/features/__tests__/DestinationSelector.test.tsx \
  src/components/features/__tests__/RouteSearchResults.rate-limit.test.tsx \
  src/lib/navigation/__tests__/safe-return-target.test.ts \
  src/lib/navigation/__tests__/rate-limit-source.test.ts \
  src/lib/location/__tests__/location-detail-resolver.test.ts \
  src/utils/__tests__/addressLoader.test.ts \
  --silent
```

## Acceptance walkthrough

### Login / Signup

1. 未認証状態の`/settings`、Discussion作成、Discussion詳細、編集、moderator導線からログインページへ移動する。
2. `/login`で主見出し、Passkey送信、キャンセル・失敗の日本語表示、`/signup`リンクを確認する。
3. `/signup`でPasskey名、利用規約、プライバシー同意のlabelと入力保持を確認する。
4. 認証成功後に安全な同一サイト内return targetへ移動する。
5. 外部URL、`//host`、APIパス、認証ページ自身をreturn targetへ渡しても`/`へ戻る。
6. 投稿・評価などの認証前操作が自動再実行されず、戻った画面で再操作が必要であることを確認する。

### Location detail

1. `/locations`でカードの見た目が維持され、操作がnative linkとして公開されていることを確認する。
2. 有効なIDの`/location-detail/[id]`を直接開き、一覧を経由せず主見出し、説明、地域、提供情報、ライセンス、外部リンクを確認する。
3. 「ここへ行く」で既存ホームの目的地設定が引き継がれることを確認する。
4. 存在しないID、CDN取得失敗、説明・画像・地域名の欠落をそれぞれ確認し、主見出しと`/locations`への戻りリンクが残ることを確認する。
5. ブラウザの再読み込み・戻る・共有URLで同じ場所を復元する。

### Rate limit

1. home、locations、routesの各429/`limitExceeded`状態を発生させる。
2. 一度だけ`/rate-limit?source=...`へ移動し、既存の制限説明を表示する。
3. ページ表示、直接URL、再読み込みで検索・geocode・transit APIが追加実行されないことを確認する。
4. `home`は`/`、`locations`は`/locations`、`routes`は`/`へ戻る通常リンクを持つことを確認する。
5. source欠落・不正値・任意raw URLが`/locations`以外へ誘導しないことを確認する。

## Evidence to record

- 各focused Jestのsuite/test数と終了コード。
- 直接アクセス・キーボード操作・状態遷移のブラウザ確認結果。
- rate-limitページ表示前後のfetch/API呼出し回数。
- invalid ID、外部return target、重複IDを含む失敗状態。
- TypeScript、lint、build、full test、`git diff --check`の終了コード。
