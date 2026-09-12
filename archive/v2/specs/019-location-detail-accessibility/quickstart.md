# Quickstart: 場所詳細ページのアクセシビリティと情報構造の改善

**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Contract**: [contracts/location-detail-accessibility.md](./contracts/location-detail-accessibility.md)

## Prerequisites

- Node.js 22.x
- `npm ci`済みの`/opt/data/kazaguruma-transit`
- 既存の`.env.local`、`transit-config.json`、必要なPrisma/GTFS設定
- 実ブラウザ確認時のローカルNext.js serverとPuppeteer等
- 既存dirty pathsを保持した作業tree。reset、clean、commit、pushをしない
- `v2.1.1`の実データで成功状態を確認するときは、`NEXT_PUBLIC_LOCATIONS_DATA_VERSION=v2.1.1 npm run dev`のように実行環境へ明示的にversionを渡す。単体テストは外部CDNへ接続せず、同versionのwire shapeを再現したfixtureを使用する。

## Baseline and worktree checks

```bash
git rev-parse HEAD
git branch --show-current
git status --short --untracked-files=all
git diff --check
```

既存の文字サイズ監査は、計画開始時点で74件の`text-sm`違反を検出している。これは失敗基線であり、実装前にテスト契約をfresh reviewする。

## Focused test commands

### Location detail behavior

```bash
npm test -- --runInBand --runTestsByPath \
  'src/app/location-detail/[id]/__tests__/page.test.tsx' \
  src/components/features/__tests__/LocationDetailContent.test.tsx \
  --silent
```

### Typography/color/button contracts

```bash
npm test -- --runInBand --runTestsByPath \
  src/app/__tests__/font-size-compliance.test.ts \
  src/app/__tests__/color-compliance.test.ts \
  src/app/__tests__/button-font-size-compliance.test.ts \
  --silent
```

`color-compliance.test.ts`と`button-font-size-compliance.test.ts`は計画後のREDテスト章で作成する。テストが存在しない間は、コマンドを成功扱いにせず、tasks.mdで作成後の正本コマンドとして使用する。

### Static checks

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
git diff --check
uvx --from specify-cli specify check
```

`npm run lint`のexit codeとwarningを分離して記録する。`next lint` deprecation notice、既存`any` warning、既存Hook warning、外部画像warningは、今回の新規errorと混同しない。

## Browser acceptance walkthrough

起動:

```bash
npm run dev
```

別terminalから、次を実ブラウザで確認する。現在のCDN version `v2.1.1`はIDが一意であるため、successの目視は実データで行う。duplicate/invalid/load-errorの表示は、CDP/Puppeteerのrequest interception等によるcontrolled fixtureで確認し、resolverを弱めない。

### Desktop and mobile success data

1. 有効な実データIDで`/location-detail/[id]`を直接開く。
2. `document.title`が`${location.name} - 場所詳細`であることを確認する。実データの`千代田区役所`（ID: `5e3b1528-8af6-436a-83af-24ca45b58e12`）は厳密に`千代田区役所 - 場所詳細`であることを確認する。
3. accessibility treeとDOMで、場所名`h1`が1つ、「提供情報」`h2`が1つ、重複場所名見出しと「説明」見出しが0件であることを確認する。
4. 「場所一覧に戻る」がページ上部に1つだけあり、`/locations`へ向くことを確認する。
5. 地域と提供情報の`dt`/`dd`隣接、任意項目欠落時のpair omission、license/external linkのname/href/target/relを確認する。
6. 画像が`img[alt=""]`で、明示`role`を持たず、figureの比率が4:3であることを確認する。
7. 「ここへ行く」が`a`で、既存のencoded `destination` queryを持ち、提供情報より前にあることを確認する。
8. light/dark theme、desktop/narrow mobile widthで通常文字のcomputed `font-size`が16px以上、通常色がtheme-safe token、WCAG 2.2 AAのコントラスト（通常文字4.5:1以上、大きな文字3:1以上、適用対象の非テキスト要素3:1以上）、focusが可視、主要操作の表示領域の幅・高さが各44 CSS px以上であることを確認する。
9. ページ本文後のKo-fi support frameが既存位置・title・card構造のままであることを確認する。

### Error and loading states

1. unknown IDでnot-foundの日本語`h1`/alert、詳細なし、上部戻りリンク1つを確認する。
2. invalid IDとduplicate IDでnot-foundへ黙って収束せず、別のerror説明になることを確認する。
3. CDN/HTTP/JSON failureでdata-load-errorの説明を表示し、「見つかりません」と混同しないことを確認する。
4. loading boundaryで日本語loading message、主見出し、戻りリンクの位置を確認する。
5. unknown、invalid、duplicate、data-load-errorのmetadata titleが厳密に`場所詳細 | 風ぐるま乗換案内`で、raw IDを含まないことを確認する。
6. browser Back、reload、direct URLで、URLから同一state/場所を復元することを確認する。

## Live-data evidence

Read-only probe for the current loader source:

```bash
python3 -c 'import json, urllib.request, collections; url="https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@v2.1.1/kazaguruma_json_min/key_locations.json"; data=json.load(urllib.request.urlopen(url, timeout=30)); locs=[loc for c in data for loc in c.get("locations",[])]; ids=[loc.get("id") for loc in locs]; counts=collections.Counter(ids); print({"version":"v2.1.1","categories":len(data),"locations":len(locs),"unique_ids":len(set(ids)),"duplicates":{k:v for k,v in counts.items() if v>1}})'
```

Record version, URL, category count, location count, unique ID count, duplicate IDs, invalid IDs, and optional-field presence. A duplicate is evidence for the existing error boundary, not a reason to select the first record.

## Final verification order

1. Exact focused RED/GREEN command for the current slice.
2. Fresh test-code review with `SUBAGENT_STATUS: COMPLETE` and `VERDICT: PASS`.
3. Production implementation within the hard path boundary.
4. Focused GREEN, strict TypeScript, scoped lint, `git diff --check`, and file/hash/status reconciliation.
5. Fresh production-code review with explicit `VERDICT: PASS`.
6. Full Jest, TypeScript, full Lint, browser walkthrough, then `npm run build` as a separate side-effectful gate.
7. Before any commit/push decision, verify changed paths. This feature does not authorize commit or push.
