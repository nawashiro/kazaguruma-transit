# Quickstart: Discussion read lifecycleの単純化

## 前提

```bash
cd /opt/data/kazaguruma-transit
git switch refactor/nostr-discussion-read-coordinator
npm install
```

実relayではなく、既存のNDK mockとJest fixtureを使う。Nostr relayの認証情報や実データは不要とする。

## 1. Nostr executor renameと既存契約

```bash
npm test -- --runInBand --runTestsByPath \
  src/lib/nostr/__tests__/nostr-read-executor.test.ts \
  src/lib/nostr/__tests__/nostr-service.test.ts
```

期待結果:

- Nostr executorの初回relay最大3件が維持される。
- non-EOSE時のretryが一度だけ実行される。
- EOSE時に余計なretryを開始しない。
- event dedupe、source relay、completionが維持される。

## 2. Detail snapshot

```bash
npm test -- --runInBand --runTestsByPath \
  src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts \
  src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx \
  'src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx' \
  'src/app/discussions/[naddr]/approve/__tests__/page.streaming.test.tsx' \
  'src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx' \
  'src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx'
```

期待結果:

- detail snapshotのphaseが順序どおりに一度ずつ実行される。
- moderators/editが独自moderator request readを開始しない。
- user evaluation全件の追加readを開始しない。
- child route遷移でread回数が増えない。
- partial時にunknown approvalを確定しない。

## 3. Management snapshot

```bash
npm test -- --runInBand --runTestsByPath \
  src/lib/discussion/__tests__/discussion-management-read-coordinator.test.ts \
  src/components/discussion/__tests__/DiscussionManagementProvider.test.tsx \
  src/app/discussions/__tests__/page.streaming.test.tsx \
  src/app/discussions/manage/__tests__/page.test.tsx
```

期待結果:

- 掲載投稿、approval、q参照、参照先metadataが一つのsnapshotへ集約される。
- 重複参照が一件に統合される。
- partial空結果が空一覧として確定されない。
- manage/moderatorが追加の掲載readを開始しない。

## 4. Cache provenance

```bash
npm test -- --runInBand --runTestsByPath \
  src/lib/discussion/__tests__/discussion-known-data-cache.test.ts
```

期待結果:

- v2 cacheのphase別relay provenanceが保存・復元される。
- metadata relayがcontent relayへ混入しない。
- v1/不正/期限切れcacheは無視される。

## 5. Repository gates

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
npm run build
git diff --check
```

`npm run build`のGTFS設定警告や既存lint warningは、exit codeと分けて記録する。成功扱いにするのはexit 0が確認できた検証だけとする。
