# Issue #101: 会話詳細h1のタイトル反映プラン

> **For Hermes:** このプランは、実装前にTDDで一項目ずつ実行する。

**Issue:** [#101](https://github.com/nawashiro/kazaguruma-transit/issues/101)

**Goal:** 会話詳細画面で、metadata取得後のタイトルをh1へ確実に表示する。

**Architecture:** Nostr取得、parser、coordinator、providerの経路を維持する。初期状態でh1へ`会話情報`を描画せず、metadata取得後に実タイトルを含む`PageHeader`を初めて描画する。これにより、Rubyful v2が初期フォールバックを加工してReactの後続更新と競合する状態を除く。

**Tech Stack:** TypeScript 5 strict、React 19、Next.js 15 App Router、Jest、React Testing Library、Rubyful v2

---

## 1. 確認済みの事実

- `DiscussionMetaReadState`は、タイトルへ`discussion?.title ?? "会話情報"`を渡す。
- `PageHeader`は、タイトルを必ず`h1`へ描画する。
- `PageHeader`の説明は、`description`がtruthyの場合だけ`p`を描画する。
- 初期状態では、h1に`会話情報`が存在する。
- 初期状態では、説明の`p`は存在しない。
- Rubyful v2は`.ruby-text`をMutationObserverで監視する。
- Rubyful v2は処理結果を対象要素の`innerHTML`へ書き戻す。
- Rubyful有効時だけ、旧版公開画面でh1が`会話情報`に残る症状を再現した。
- Rubyfulを無効にすると、同じ画面でmetadataタイトルがh1へ表示された。
- 現行devのparser、detail coordinator、provider、layout単体テストはタイトルを保持する。

## 2. 対象範囲

### 対象

- `src/components/discussion/DiscussionMetaReadState.tsx`
- `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx`
- `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`
- Rubyful有効状態のブラウザ検証

### 対象外

- `src/lib/nostr/nostr-utils.ts`のmetadata parser
- `src/lib/discussion/discussion-detail-read-coordinator.ts`
- `src/components/discussion/DiscussionDetailProvider.tsx`
- `src/lib/nostr/nostr-read-executor.ts`
- relay候補、retry、EOSE、cache、snapshot契約
- `PageHeader`の全画面共通API
- Rubyful CDNスクリプト本体
- 新規永続化、依存関係、DB変更

## 3. 提案する実装方針

### 3.1 初期フォールバックh1を描画しない

`discussion`がない間は`PageHeader`を描画しない。読み込み中、partial、errorの状態は既存のstatusとreload操作で示す。

metadataを含むsnapshotが到着した場合だけ、次を描画する。

```tsx
{discussion && (
  <PageHeader
    title={discussion.title}
    description={discussion.description}
  />
)}
```

空文字をtitleへ渡して空のh1を残す方法は採用しない。空の見出しはアクセシビリティ上の問題になり、Rubyfulの監視対象を完全には除けないためである。

### 3.2 取得経路を変更しない

タイトル欠落は取得・解析の問題ではない。`DiscussionDetailProvider`が公開するsnapshotと、子routeのread回数を変更しない。

### 3.3 Rubyfulの処理タイミングを検証する

metadata取得前には対象header自体が存在しない状態にする。metadata取得後に実タイトルと説明を含むheaderが追加され、Rubyfulが実データを処理できることをブラウザで確認する。

## 4. 受入基準

1. metadata取得前の詳細画面に、h1 `会話情報`を表示しない。
2. metadata取得前も、既存の日本語loading statusを表示する。
3. metadata取得成功後、h1へ`discussion.title`を表示する。
4. metadata取得成功後、説明へ`discussion.description`を表示する。
5. Rubyful有効状態でも、h1が初期値へ戻らない。
6. Rubyful有効状態でも、h1と説明が同じmetadata snapshotから表示される。
7. metadata error、partial、reloadのstatusと操作を維持する。
8. `/discussions/[naddr]`、`approve`、`moderators`、`edit`のread回数を増やさない。
9. parser、coordinator、provider、Nostr transportの既存契約を変更しない。
10. 新規DB、依存関係、外部データ形式を追加しない。

## 5. 実装手順

### Task 1: h1フォールバック回帰テストを追加する

**Files:**

- Modify: `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx`

**内容:**

- `discussion={null}`かつloading時に、h1 `会話情報`が存在しないことを検証する。
- loading statusが`role="status"`と`aria-live="polite"`を維持することを検証する。
- error時、partial時にも初期フォールバックh1を描画しないことを検証する。
- known discussion時に、h1と説明を表示することを検証する。

**検証:**

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx
```

期待結果: 新規テストがREDになる。既存の`会話情報`期待値は、受入基準に合わせて置き換える。

### Task 2: metadata headerの条件描画を実装する

**Files:**

- Modify: `src/components/discussion/DiscussionMetaReadState.tsx`

**内容:**

- `discussion`が存在する場合だけ`PageHeader`を描画する。
- titleのフォールバック`会話情報`を削除する。
- loading、error、partialのstatusとreload操作を維持する。
- `PageHeader`へ渡すdescriptionは`discussion.description`を維持する。

**制約:**

- `PageHeader.tsx`を変更しない。
- `DiscussionDetailProvider`とNostr read経路を変更しない。
- 空文字のh1を描画する代替実装を追加しない。

**検証:**

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx
```

期待結果: Task 1のテストがGREENになる。

### Task 3: detail layoutのloading／ready境界を検証する

**Files:**

- Modify: `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`

**内容:**

- detail snapshotがないloading状態で、`会話情報` h1が存在しないことを検証する。
- detail snapshotがready状態になったとき、タイトルh1と説明が表示されることを検証する。
- tab、role guidance、reload、ARIA属性が既存契約を維持することを検証する。
- layoutが独自にmetadata readを開始しないことを維持する。

**検証:**

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx \
  src/components/discussion/__tests__/DiscussionTabLayout.test.tsx \
  src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx \
  src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts
```

期待結果: 全対象テストがGREENになり、read回数とtitle保持の既存契約が変わらない。

### Task 4: Rubyful有効状態をブラウザで検証する

**Files:**

- No committed source file required.

**内容:**

- 最新devの実装を起動する。
- Rubyfulを有効にして詳細画面を開く。
- metadata取得完了後のh1、説明、`header`の子要素を確認する。
- h1が初期値`会話情報`へ戻らず、実タイトルを保持することを確認する。
- Rubyfulを無効にした比較も行い、Rubyful無効時だけ成功する状態が残っていないことを確認する。

**確認項目:**

```text
h1 = 実際のdiscussion.title
description = 実際のdiscussion.description
h1のtextContentに「会話情報」を含まない
```

実環境のNostr relayは不安定性を持つため、可能なら決定的fixture relayまたは既存のテスト用データを使う。実relayのtimeoutをタイトル表示成功の根拠にしない。

### Task 5: 全体品質ゲートを実行する

**検証:**

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
npm run build
git diff --check
git status --short --branch
```

`transit-config.json`がない環境では、GTFS関連の警告とコマンドのexit codeを分けて記録する。exit 0を確認できない検証を成功扱いにしない。

## 6. リスクと判断

### リスク: loading中にh1が存在しない

loading中に`会話情報`を見出しとして示す既存挙動は変わる。しかし、これは実会話名ではなく汎用フォールバックであり、Issueの誤表示を引き起こす。loading statusが状態を示すため、空の見出しを残すより明確である。

### リスク: 別の動的`.ruby-text`にも同じ問題がある

今回はIssue #101の会話詳細metadata headerだけを対象とする。全画面のRubyful設計変更は別Issueへ分離する。

### 判断: Nostr取得の変更を避ける

既存テストは`name`タグからsnapshotの`title`までを保持する。取得経路を変更すると、Issueと無関係なrelay lifecycleの回帰を招くため、表示境界だけを変更する。

## 7. 完了条件

- Task 1〜5を実測結果で完了する。
- Rubyful有効状態のブラウザ確認を完了する。
- `dev`からの差分が`DiscussionMetaReadState`と必要なテストに限定される。
- `git diff --check`が成功する。
- 実装、commit、pushはこのプラン作成では行わない。
