# Issue #98 調査

## 調査対象

- 基準ブランチ: `dev` / `origin/dev`
- 実装ブランチ: `fix/issue-98-no-auto-navigation`
- Issue: [#98](https://github.com/nawashiro/kazaguruma-transit/issues/98)
- Issue状態: open、コメント0件、関連PRなし

## 事実確認

- `dev` は `origin/dev` へ fast-forward し、基準HEADは `9be674d62af5db40723d324a2f6ca2db666bce83` になった。
- 変更前の作業ツリーは clean だった。
- Issue本文は「自動遷移は減らしたい。一瞬表示されたものを見逃すと、不安になる。単にリンクがあればいい。」である。
- 変更前の編集ページテストは `--runTestsByPath` で 1 suite / 8 tests が PASS した。ただし保存後の2秒経過後の遷移を検証していなかった。

## 現行経路

1. `src/app/discussions/[naddr]/edit/page.tsx` の `handleSave` がログイン・入力値を検証する。
2. `signEvent` と `nostrService.publishSignedEvent` が成功すると、`successMessage` に「会話が更新されました」、`successType` に `save` を設定する。
3. 同じ成功分岐で `setTimeout(..., 2000)` が `router.push(`/discussions/${naddrParam}`)` を呼ぶ。
4. 成功画面は「まもなく会話画面に戻ります...」という説明だけを表示し、利用者が選べる詳細画面リンクを持たない。

## 根因

Issueの症状は編集保存の通信やNostrイベントではなく、保存成功後のUI制御にある。成功状態を表示したままにせず、2秒固定のタイマーで `router.push` を実行していることが自動遷移の直接原因である。

## 実装境界

- `setTimeout` による保存成功後の自動遷移を削除する。
- `successType === "save"` の成功表示を、待機案内から詳細画面へのネイティブリンクへ置き換える。
- `naddrParam` から作る既存の詳細URLをリンクの `href` に使う。
- その他の成功・失敗・削除・掲載申請・認証経路は変更しない。

## 憲章ゲート

- Clear Naming / Simple Logic: 既存の `successType` 分岐を保ち、タイマーや新しい状態を追加しない。
- Structured Organization: 編集ページの既存UI境界内で完結させる。
- Type Safety: `Link` の `href` は既存の文字列パラメーターから構成する。
- Test-First Development: 保存成功後のリンク表示と非自動遷移を先にREDテストで固定する。
- Accessibility & UX: リンクの目的を可視名で示し、既存の44pxタッチターゲットを維持する。
- KISS / 後方互換性: 旧自動遷移のフォールバックや二重経路を残さない。
