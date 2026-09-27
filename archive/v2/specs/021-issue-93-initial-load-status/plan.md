# Issue #93 初回取得状態の非割り込み化 計画

> **For Hermes:** `AGENTS.md`、`.specify/memory/constitution.md`、本tasksに従い、test RED→fresh test review→production→GREEN→fresh production reviewを実行する。

**Goal:** 初回取得の失敗・未検出・部分取得を`status`へ分類し、ユーザー操作後の`alert`を維持する。

**Architecture:** 既存の表示経路を維持する。初回取得に由来する5つの表示箇所だけへ`role="status"`と`aria-live="polite"`を設定する。共通通知抽象化と取得処理の変更を避ける。

**Tech Stack:** TypeScript 5 strict、React 19、Next.js 15 App Router、Jest、React Testing Library、Tailwind CSS 4、DaisyUI 5。

---

## Constitution check

- TDD: 各スライスで回帰テストを先に変更し、REDを確認する。
- Accessibility: 初回取得結果は非割り込み状態として`status`と`aria-live="polite"`を使う。
- Type safety: props、取得処理、データ形式、型定義を変更しない。
- Simple logic: 役割属性と`aria-live`の最小変更に限定する。
- Structured organization: 共通状態と各画面の所有境界を保つ。
- Review gates: test writer、test reviewer、production writer、production reviewerを直列化する。

## Work units

### Unit 1: 共通メタデータ状態

- Test: `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx`
- Production: `src/components/discussion/DiscussionMetaReadState.tsx`
- Error本文、`alert-error`、再試行ボタンを維持する。
- `role="alert"`を`role="status"`へ変更し、`aria-live="polite"`を付ける。

### Unit 2: 管理画面の重複メタデータ状態

- Tests: `src/app/discussions/manage/__tests__/page.test.tsx`、`src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`
- Production: `src/app/discussions/manage/page.tsx`、`src/app/discussions/[naddr]/moderators/page.tsx`
- `/moderators`のpartial statusと`/manage`の操作領域を維持する。
- メタデータnot-found／取得失敗の重複表示だけをstatusへ変更する。

### Unit 3: 会話一覧の初回read状態

- Test: `src/app/discussions/__tests__/page.streaming.test.tsx`
- Production: `src/app/discussions/page.tsx`
- moderation read失敗の本文と`alert-error`クラスを維持する。
- partial取得の既存statusを変更しない。

### Unit 4: 会話詳細の初回投稿・評価read状態

- Test: `src/app/discussions/[naddr]/__tests__/page.test.tsx`
- Production: `src/app/discussions/[naddr]/page.tsx`
- 投稿・評価read失敗の2箇所をstatusへ変更する。
- 投稿フォームの入力検証・送信失敗のassertive alertは維持する。

## Verification

Focused aggregate:

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx \
  src/app/discussions/__tests__/page.streaming.test.tsx \
  src/app/discussions/manage/__tests__/page.test.tsx \
  'src/app/discussions/[naddr]/__tests__/page.test.tsx' \
  'src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx' \
  'src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx' \
  'src/app/discussions/[naddr]/approve/__tests__/page.streaming.test.tsx'
```

Final gates:

```bash
npm test -- --runInBand
npx tsc --noEmit --incremental false
npm run lint
npm run build
git diff --check
uvx --from specify-cli specify check
```

## Risks and rollback

- `role="status"`はassertive通知を失うが、初回取得状態の分類に適合する。
- `alert-error`クラスを維持して視覚的なエラー表現を保つ。
- `git revert`で4つのproduction pathと関連testだけを戻せる。
- GitHubへのcommit・push・CI確認は、ローカル検証後に実行する。
