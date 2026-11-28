# Proposal

## Why

利用者のnpubを画面のあちこちで全文表示している。63文字の英数字は末尾まで読めず、携帯幅では1行を占めて周りの情報を押し出す。npubは利用者が読むための値ではなく、同じ人物を指す日本語の呼び名が直上に出ている場面でも、全文が読み手の負担になっている。画面に出すのは、誰を指しているかを見分ける手がかりとして最低限の長さで足りる。

## What Changes

- npubの画面表示を、先頭の `npub1` と続く4文字までに短縮する。そのあとは `…` で示す（例: `npub1ef93…`）。文字数で上限を決めるので、表示は10文字を超えない。
- 狭い画面で `npub1` 以降が4文字より手前で切れることは許す。幅に収まらないときは、今までどおりCSSの省略に任せる。読ませる価値のない値なので、全部見えることより行を短く保つことを優先する。
- 短縮は表示だけに限る。コピー操作はこれまでどおりnpub全体をクリップボードへ渡す。
- 9文字以下の値は短縮しない。末尾に `…` を足して長くしない。
- 表示の実装は `NpubDisplay` の1箇所に閉じる。設定画面、モデレーター一覧、会話の作成・編集画面の表示は、この部品を通るので同じ上限になる。
- 削除ボタンの読み上げ名を、npub全文から日本語の呼び名へ変える（`モデレーター とんかつ やたい うごかす を削除`）。読み手に意味のない値を最後まで読み上げさせない。
- 会話の参照に使うnaddrなど、npub以外の識別子の表示は変えない。

## Capabilities

### New Capabilities

- `user-identity-display`: 画面に出す利用者識別子（npub）の長さと、読み上げにnpubを使わないこと、短縮表示から全体をコピーできることを定める。

### Modified Capabilities

なし。

## Impact

- `src/components/ui/NpubDisplay.tsx`: 表示文字列の上限。
- `src/app/discussions/create/page.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`: 削除ボタンの読み上げ名。
- `src/components/ui/__tests__/NpubDisplay.test.tsx`、`src/components/ui/__tests__/UserIdentity.test.tsx`、`src/components/discussion/__tests__/ModeratorManagementSection.test.tsx`、`src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`、`src/app/discussions/create/__tests__/page.test.tsx`: 期待値の更新。
- 画面の外にある値（Nostrイベントのタグ、API、保存データ）とコピーされる値は変えない。
- 依存パッケージの追加はない。
