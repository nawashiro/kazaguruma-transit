# Research: Discussion read lifecycleの単純化

## Decision 1: 既存executorとNostrServiceは維持する

**Decision**: relay候補のattempt分割、限定retry、completion-aware通信、NDK通信は既存実装を維持する。executorの名前と配置だけをNostr基盤として整理する。

**Evidence**:

- `src/lib/discussion/discussion-read-executor.ts`はProviderが渡したrelay URLを重複除去し、初回最大3件とretry最大3件へ分割している。
- `src/lib/nostr/nostr-service.ts`はNDK接続、subscription、EOSE、timeout、event dedupe、relay provenanceを所有している。
- `/discussions`、detail metadata、detail evaluation、moderators、edit、settingsの主要readは既存executorを通っている。

**Rationale**: 問題は通信層のDRY不足ではなく、複数のdomain readをページ・Provider・snapshot callbackが独立して所有していることにある。relay単位transportへ再設計する必要はない。

**Alternatives considered**:

- relay単位の新しいaggregate transport: EOSE境界を明確にできるが、既存executor/NostrServiceの責務と重複するため採用しない。
- 各ページがNostrServiceを直接呼ぶ: 重複取得とcompletion状態の分散を再発させるため採用しない。

## Decision 2: executorをNostr基盤としてrenameする

**Decision**: `DiscussionReadExecutor`を`NostrReadExecutor`へ改名し、Discussion固有のtarget/filter生成をdomain側へ残す。

**Rationale**: executorの入力は正規化済みfilterとrelay候補であり、Discussionの業務判定を行わない。settingsや複数のDiscussion画面から再利用されるため、現行名は責務より狭い。

**Boundary**:

- Nostr基盤: `executeNostrRead`, attempt/retry/merge/provenance
- Discussion domain: `createDiscussionReadPlan`, `readDiscussionDetail`, `readDiscussionManagement`

## Decision 3: route familyごとにsnapshotを一つだけ持つ

**Decision**: 詳細routeには`DiscussionDetailProvider`、一覧routeには`DiscussionManagementProvider`を置く。

**Rationale**: metadata/content/managementを一つのscope付き汎用Providerに詰め込むと、ページごとの条件分岐と複数の公開stateが増える。対象とsnapshotをroute familyで分ける方が、UIの依存を単純化できる。

**Rejected**: 既存`DiscussionDataProvider`へ機能を追加し続ける案。現在の`meta`、`content`、`management`の分離が名前だけの分離となり、phase callbackの誤用を残すため。

## Decision 4: 初期readはcoordinator内で順序づけ、UIには最終stateを公開する

**Decision**: metadata、content、approval、evaluationの順序をcoordinatorが管理する。primary完了時callbackをUIの`isLoading=false`根拠にしない。

**Rationale**: 現行はapproval readの継続中に評価readが始まり得る。phase callbackをUI契約から外すことで、read sessionの完了条件を一つにする。

**Trade-off**: 初期表示が遅くなる可能性がある。今回の契約では、部分データの早期表示より誤確定と重複readの排除を優先する。

## Decision 5: moderator requestとuser evaluationを既存取得結果から導出する

**Decision**:

- moderator requestはprimary contentイベントから分離してsnapshotへ保存する。
- user evaluationは全evaluation結果からpubkeyで導出する。

**Rationale**: 同じmoderator requestを専用readで取り直す経路と、評価イベントを別filterで取り直す経路を削除できる。

**Boundary**: evaluation件数が将来大きくなった場合のpaginationは別featureとする。今回の実装では詳細snapshotを単純化するため、初期readに含める。

## Decision 6: successful relayはphase別にcacheする

**Decision**: 現在readの結果にはexecutorのprovenanceを保持し、sessionStorageにはphase別successful relay候補を保存する。

**Rationale**: metadata成功relayとcontent成功relayは意味が異なり、現在の`successfulEventRelayUrls`/`successfulRelays`のunionは候補の意味を曖昧にする。

**Cache policy**:

- Nostr relayが正本
- sessionStorageは24時間の暫定ヒント
- cacheなしでもreadは実行する
- 旧cache versionは読み飛ばす
- eventごとのsource provenanceは現在のread resultにのみ保持する

## Decision 7: Nostr EOSEのtransport仕様は変更しない

**Decision**: 今回はNDKのrelay単位readやEOSE実装を変更しない。EOSEをdomain UIへphase callbackとして流さず、coordinatorの最終stateへ集約する。

**Rationale**: 既存executor/NostrServiceの通信境界は十分に隠蔽されている。今回の問題はEOSEの共有カウンタではなく、複数readのUI lifecycleが別々に進むことにある。

## Open but deferred

- 評価件数が大規模になった場合のpagination
- relay候補の優先順位をmetadata/content/evaluationでさらに最適化すること
- live subscriptionを再導入する必要性

これらは今回のKISS設計を崩すため、実測データが得られるまで追加しない。
