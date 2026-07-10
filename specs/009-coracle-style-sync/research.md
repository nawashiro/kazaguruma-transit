# Research: Selected Partial Sync

## Decision: 既存NDK境界を保持し、read planを追加する

`NostrService.getEventsWithCompletion()`は`eose`、`idle-timeout`、`hard-timeout`、`cancelled`を区別し、イベントIDで重複排除・時刻順ソートを行っている。これを置換せず、画面目的別のfilter・relay候補・件数を作る層を前段に置く。

**Rationale**: NIPイベント解釈と接続の再実装を避けつつ、009の画面単位取得を適用できる。

**Alternatives considered**: NDKを直接UIから呼ぶ方式はfilter、timeout、観測ログの重複を増やすため不採用。

## Decision: 初回読み取りは最大3 relay、優先順位付きの候補を使う

候補は会話naddrのrelay hint、会話定義の推奨relay、最近成功したrelay、利用者設定relay、既定relayの順に安定重複排除する。最初のreadは3件までにし、候補が空なら設定済みread relayへフォールバックする。

**Rationale**: [[references/coracle-social-performance-critical-reread-2026]] が示す通り、速度は全relay同期ではなく画面ごとの選別された部分同期で得る。接続不能を避けるフォールバックも必要である。

**Alternatives considered**: 毎回全relayへ送る方式は遅いrelayによる待ち時間と不要なブロードキャストを増やすため不採用。

## Decision: 承認状態のrelay候補と結合規則を画面横断で共有する

詳細、承認、監査は、naddr hint、推奨relay、既知の成功relay、設定relay、既定relayを同じ入力として共通の moderation read に渡す。初回は最大3 relayを維持するが、承認が未観測でpartialになった結果は「未承認」と確定せず、次候補への限定再読取または再試行を可能にする。投稿はevent ID、承認はその`e` tagで結合し、各画面が独自の集合から状態を導出しない。

**Rationale**: hint優先の3件だけを見る詳細・承認と、configured relayだけを見る監査が存在すると、同じkind 4550に対して相反する表示が発生する。未観測は不承認の証拠ではない。

**Alternatives considered**: すべての画面を全relayへ常時ブロードキャストする方式は009の選別同期と性能要件に反するため不採用。画面ごとに表示を独自に補正する方式は再び差異を生むため不採用。

## Decision: auditの主イベント取得と承認解決を分離する

auditは主イベント（投稿又は申請）を最大10件取得し、そのevent IDを`#e`条件にして関連承認を別readする。表示対象のページ数制約は主イベントに適用し、承認の有無をkind混在filterの時刻順・limitに委ねない。

**Rationale**: 投稿と承認は発生時刻が異なるため、単一の`kinds: [1111, 1, 4550], limit: 10`では関連イベントが同じページに載る保証がない。

## Decision: 選別relay集合はNDKRelaySetとして購読へ渡す

`NostrService`は`NDKRelaySet.fromRelayUrls(selectedRelayUrls, ndk)`を作り、`ndk.subscribe(filter, options, relaySet)`の第3引数に渡す。これにより、NDKインスタンスを画面ごとに増やさず、readごとに問い合わせ先を限定する。候補不足のfallbackは購読開始前に候補リストへ補充し、実行済みreadを全relayへ再送しない。

**Rationale**: NDKのrelay setは短命な単一REQにも使えるAPIであり、009の初回最大3 relay制約を通信レイヤーで保証できる。

## Decision: timeout結果は部分取得として扱う

`idle-timeout`、`hard-timeout`、`cancelled`でイベントまたは既知データがある場合は、内容を残して日本語の暫定表示と再読み込みを出す。イベントがなくtimeoutの場合もNot Foundではなく取得不能・再試行可能を出す。Not FoundはEOSEを受信済みで対象イベントがない場合だけに限定する。

**Rationale**: relay沈黙は存在しないことの証拠ではない。

## Decision: 既知データはsessionStorageで最小限に保持する

会話メタデータ、イベントID、relay成功実績だけをversion付きで保存する。メタデータは描画直後の暫定表示に使う一方、投稿・承認・評価の確定状態は新規relay読取で補完する。

**Rationale**: 再訪問を速くしつつ、古いキャッシュで権限や承認状態を確定しない。

**Alternatives considered**: 永続的なIndexedDBは移行と失効管理の負荷が大きく、本仕様の最初の実装には過剰である。

## Decision: 監査の各readはlimit 10とuntil cursorを必須にする

初回・追加取得ともrelayへ`limit: 10`を送り、追加時は直前ページ最古イベントより前の`until`を使う。UI上のsliceだけで過去ページを再表示しない。

**Rationale**: 008で確立した監査ページングを009のread planで保証する。

## Decision: 取得戦略は設定モジュールに閉じ込める

relay数、idle/hard timeout、重複read抑制windowは`DiscussionReadStrategyConfig`として`discussion-config.ts`で管理する。公開環境変数は範囲検証後に使い、ユーザー設定画面には出さない。

## Decision: 同時刻イベントはIDで安定化する

イベント一覧は`created_at`降順、同時刻はevent ID昇順で並べる。監査の異なる種類を同時刻に表示する場合は、仕様で定義した監査種別優先順位を先に使い、最後にevent IDで解消する。
