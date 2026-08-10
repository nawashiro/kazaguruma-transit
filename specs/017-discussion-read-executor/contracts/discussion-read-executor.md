# 内部契約:Discussion read executor

## 目的

この契約はUIとNostr通信の境界を定める。公開HTTP APIは追加しない。

## Input

```ts
interface ExecuteDiscussionReadInput {
  plan: DiscussionReadPlan;
  candidates: {
    hints?: string[];
    recommended?: string[];
    successful?: string[];
    configured: string[];
    defaults: string[];
  };
  onAttemptComplete?: (attempt: RelayAttempt) => void;
}
```

- 呼出側は正規化済みfilterだけを渡す。
- executorは候補を順位付けする。
- executorは初回と必要時の一度だけのretryを実行する。
- `onAttemptComplete`は各attemptの完了時に呼ぶ。

## Output

```ts
interface DiscussionReadResult {
  events: NostrEventDTO[];
  completionReason: CompletionReason;
  attemptedRelayUrls: string[];
  successfulEventRelayUrls: string[];
  sourceRelayUrlsByEventId: Record<string, string[]>;
  attempts: RelayAttempt[];
}
```

- eventsはevent IDで重複排除する。
- source relayはeventを配送したrelayだけを含む。
- retryがEOSEなら、最終`completionReason`は`eose`になる。

## Relay試行規則

1. `rankRelayCandidates()`で全候補を作る。
2. 先頭の最大3件でfirst attemptを実行する。
3. EOSEで終わった場合は終了する。
4. 非EOSEで未試行候補がある場合、次の最大3件で一度だけretryする。
5. retry後は自動拡大しない。

## Multi-filter規則

- executorは一つのplanの`filters`配列を変更しない。
- transportは各attemptで一回の`ndk.subscribe(filters, { ...options, relaySet })`を使う。選別済みrelayごとに、filter配列を含むREQを送る。
- transportはfilterごとに`ndk.subscribe()`を呼ばない。
- transportは一つのsubscriptionのEOSEでattemptを完了する。

## UI規則

- `onAttemptComplete`で届く初回eventsを即時に表示する。
- retry中は日本語の状態を`role="status"`と`aria-live="polite"`で通知する。
- retryがEOSEなら部分取得表示を解除する。
- 最終状態が非EOSEなら再読み込み操作を表示する。
- 再読み込み操作の最低サイズは44pxである。
