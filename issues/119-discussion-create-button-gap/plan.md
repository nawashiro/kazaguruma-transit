# Issue #119 会話作成完了ボタンのgap-0計画

> **対象**: `/discussions/create` の作成完了状態
>
> **ベース**: `dev` / `b1e722ee339d0eb77942dc23a5fa07c74a08e58c`

## 目的

作成完了画面に表示する「会話を開始する」「会話一覧に戻る」が、Ruby表示とDaisyUI `btn` の暗黙gapに依存せず `gap-0` を持つことを、実行可能な回帰テストで保証する。

## 現状判断

現行 `dev` の `src/components/ui/Button.tsx` は、primary/secondaryの共通クラスとして `ruby-text gap-0` を既定付与している。`src/app/discussions/create/page.tsx` の作成完了CTAは両方ともこの `Button` を使用しているため、現行ソースの表示契約はすでに満たされている。

公開URLでは古いDOM（`gap-0`なし）が観測されたため、公開ビルドと `dev` の同期遅れが主原因と判断する。作成完了状態を確認するために本番で会話を作成することはしない。

## 受入条件

1. 成功状態の「会話を開始する」が `button` かつ `gap-0` を持つ。
2. 成功状態の「会話一覧に戻る」が `button` かつ `gap-0` を持つ。
3. 「会話を開始する」は既存どおり `/discussions/naddr1created` へ遷移する。
4. 「会話一覧に戻る」の既存遷移、ボタン種別、accessible nameを維持する。
5. 実際のNostr発行・公開データ作成・production画面の会話作成を行わない。
6. Button抽象化全体の撤去や置換を今回のIssueへ混入しない。

## 方針

### 1. 回帰テストを先に追加する

`src/app/discussions/create/__tests__/page.test.tsx` の成功状態テストで、完了見出しを表示した後に次を確認する。

- `screen.getByRole("button", { name: "会話を開始する" })` が `gap-0` を持つ
- `screen.getByRole("button", { name: "会話一覧に戻る" })` が `gap-0` を持つ
- 既存のクリックとrouter遷移assertionを維持する

このテストは、現行devではproduction実装がすでに条件を満たすため、REDではなく即時GREENになる可能性がある。その場合は「既存実装がIssueの主要求を満たしている」ことを記録し、production sourceを変更しない。テスト追加は新しい回帰保証であり、既存挙動の修正ではない。

### 2. Button抽象化は現状維持する

共有 `Button` は多数の画面で利用され、既にgap、Ruby、タッチターゲット、loading、ARIA、roundedの契約を持つ。Issue本文の抽象化への懸念だけを根拠に全利用箇所をnative DaisyUI buttonへ置換すると、Issueの受入条件を超えた大規模変更になる。

したがって、今回のproduction実装は次の優先順位とする。

1. まず現行Buttonの実行時契約をテストで固定する。
2. テストが失敗した場合だけ、完了画面の最小境界を修正する。
3. 全体抽象化の撤去は別Issue/別仕様に分離する。

## 実行タスク

1. `issues/119-discussion-create-button-gap/` に調査結果・計画・憲章適合タスクリストを保存する。
2. 作成完了CTAのgap回帰テストを追加し、親がテスト結果を確認する。
3. 追加テストをfresh read-only subagentへレビュー委任する。`SUBAGENT_STATUS: COMPLETE` と `VERDICT: PASS` が必要。
4. レビュー後、現行production sourceを再確認する。既存契約がGREENならsource変更なしと確定する。
5. Node 22でfocused Jest、strict TypeScript、Lint、全Jest、Buildを実行する。BuildのPrisma/GTFS副作用と環境警告を分離記録する。
6. 文書へ実測結果を反映し、差分・status・テストpathを親が再確認する。
7. feature branchへ日本語conventional commitを作成しpushする。必要ならbase=`dev`のPRを作成するが、mergeは行わない。

## 変更予定ファイル

- 追加または更新: `issues/119-discussion-create-button-gap/investigation.md`
- 追加または更新: `issues/119-discussion-create-button-gap/plan.md`
- 追加または更新: `issues/119-discussion-create-button-gap/tasks.md`
- 回帰テスト: `src/app/discussions/create/__tests__/page.test.tsx`
- production source: 現状変更予定なし。回帰テストが失敗した場合のみ、親の再計画後に変更する。

## 憲章適合

| 憲章/AGENTS.mdの原則 | 適用 |
|---|---|
| 日本語 | Issue文書、commit、PRを日本語で作成する |
| Test-First Development | production変更が必要になった場合は回帰テストを先にRED確認する。現状は既存実装の契約固定なので即時GREENを許容する |
| Clear Naming / Simple Logic | 既存Buttonを活用し、不要な新抽象化・条件分岐を追加しない |
| Structured Organization | 作成ルートの既存テストに成功状態の表示契約を追加し、UI層とNostr処理を混ぜない |
| Type Safety | TypeScript strictを維持し、型・API・Nostr payloadを変更しない |
| Accessibility & UX | role/name、`gap-0`、44pxタッチターゲット、既存router遷移を保持する |
| 後方互換性の扱い | 旧Button実装を新たなfallbackとして温存しない。現行devの単一契約だけを検証する |
| Nostr方針 | 実際の発行を行わず、既存のcreation-flow mockで表示境界だけを検証する |

## 検証コマンド

作業中:

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/discussions/create/__tests__/page.test.tsx src/components/ui/__tests__/Button.test.tsx --silent
```

最終:

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build
```

## 実施結果

- T004の回帰テストを追加し、作成完了状態の2つのCTAで`gap-0`を実DOMから確認した。
- 現行`dev`の共有`Button`契約がすでに要件を満たしていたため、production sourceは変更しなかった。
- fresh read-only reviewは`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS`だった。
- focused 2 suites / 18 tests、全Jest 139 suites PASS / 2 skipped、856 tests PASS / 13 skipped、strict TypeScript、Lint、Buildが成功した。
- 公開URLはChromiumで送信なしに観測し、古い公開DOMに`gap-0`がないことを確認した。実際の会話作成・公開データ発行は行っていない。

## リスクと除外

- 公開中ビルドが `dev` より古い場合、ローカルテスト追加だけでは公開画面は変わらない。デプロイは別の運用判断である。
- 実際の作成操作をしないため、公開環境の作成完了後レイアウトを直接撮影する検証は対象外とする。その代わり、成功状態をモックしたRTLテストでDOMクラスと遷移を検証する。
- Button全体の撤去・再設計、公開ブランチへのmerge、productionデータの作成、Issueのcloseは今回の範囲外とする。
