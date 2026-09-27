# Issue #98 実装プラン

## 目的

会話編集の保存成功後、成功結果を利用者が確認できる状態を維持し、会話詳細画面へは利用者が明示的なリンクを選択した場合だけ移動する。

## 実装方針

1. 編集ページの保存成功分岐から `setTimeout` と `router.push` を削除する。
2. `successType === "save"` の案内文を、`href={`/discussions/${naddrParam}`}` の `Link` に置き換える。
3. リンクには「会話画面に戻る」という目的が分かる可視テキストを付け、既存のボタン相当のスタイルと44px以上の高さを適用する。
4. 既存の掲載申請成功表示、エラー、削除、ログイン導線は維持する。

## 変更ファイル

### テスト

- `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`

### 本番

- `src/app/discussions/[naddr]/edit/page.tsx`

### 文書

- `issues/98-discussion-edit-no-auto-navigation/spec.md`
- `issues/98-discussion-edit-no-auto-navigation/research.md`
- `issues/98-discussion-edit-no-auto-navigation/plan.md`
- `issues/98-discussion-edit-no-auto-navigation/tasks.md`

## 憲章チェック

- **Clear Naming:** 既存の `successMessage` / `successType` を利用し、曖昧な状態名を増やさない。
- **Simple Logic:** 固定時間の副作用を除去し、成功表示とリンクの単純な条件分岐にする。
- **Structured Organization:** ページの公開UIを既存のApp Routerページ境界で変更する。
- **Type Safety:** `next/link` の `Link` と文字列 `href` を用い、型のないデータ経路を追加しない。
- **Test-First Development:** テスト実装 → focused RED → 独立テストレビュー → 本番実装 → GREEN の順で進める。
- **Accessibility & UX:** リンク名で目的を明示し、`text-base`、`min-h-[44px]`、`rounded-full dark:rounded-sm` を適用する。WCAG 2.2 2.4.4 / 2.5.8 を確認する。
- **Documentation & Comments:** 調査事実と非対象を本Issueディレクトリに記録する。
- **KISS / 後方互換性:** 自動遷移の旧経路や追加フォールバックを残さない。

## 検証計画

1. 編集ページテストで保存成功までを実行し、成功メッセージと詳細リンクの `href` を確認する。
2. fake timers で2秒以上経過させても `router.push` が呼ばれず、成功表示とリンクが残ることを確認する。
3. 編集ページのfocused Jest、関連suite、strict TypeScript、Lint、`git diff --check` を実行する。
4. AGENTS.md指定の `npm test`、`npm run lint`、`npm run build` を実行し、既存環境要因と今回の差分由来を分離して記録する。
