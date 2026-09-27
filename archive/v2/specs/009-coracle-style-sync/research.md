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

## Decision: 承認状態は共通moderation readで一度だけ解決する

詳細、承認、監査は、投稿イベントをprimaryとして取得し、そのID群を`#e`に指定したkind 4550 readを別に実行する。承認済み判定は承認イベントの`e`タグとprimary event IDの一致だけで導出する。承認イベント本文を投稿の正本として復元せず、到着順や画面固有のイベント集合に依存しない。

**Rationale**: 現行`/approve`の独立streamは、承認イベントを含まないEOSE/timeout結果で楽観更新を上書きし得る。現行`/naddr`は承認本文から投稿を復元するため、画面間でevent IDの正本が分裂する。共通snapshotによりFR-026/030を満たす。

## Decision: 未観測承認は候補枯渇までunknownとする

初回は最大3 relayに限定する。承認が見つからずpartial、timeout、または未試行候補が残る場合は`unknown`とし、未試行relayを最大3件ずつ限定再読取する。全候補でEOSEを受信して初めて`unapproved`を確定する。stream APIが完了理由を返さない場合は、completion-aware readへ移行する。

**Rationale**: `/approve`は現在streamの`onEose`を常に`completionReason: "eose"`としてsnapshotへ渡しており、timeoutでも未承認を確定してしまう。これはFR-031に反する。

## Decision: relay試行とイベント発見実績を分離する

cacheには問い合わせたrelay (`attemptedRelayUrls`) と、対象イベントを実際に返したrelay (`successfulRelayUrls`、またはイベントID別source relay) を別々に保存する。問い合わせただけのrelayを次回優先しない。cacheは承認状態の確定には使わず、表示・候補順位の暫定材料に限定する。

**Rationale**: 現行各画面は候補全件を`successfulRelays`として保存しており、発見できなかったrelayも成功扱いになる。

## Decision: 共通moderation readを全Discussion表示面へ拡張する

共通snapshotの利用範囲を詳細・承認・監査に限定せず、一覧、管理、BusStopDiscussion、BusStopMemo、評価対象抽出、編集画面の承認表示にも拡張する。各画面はprimary投稿イベントをcanonical sourceとして扱い、承認イベントの`e`タグでID結合する。承認本文のJSON復元や、独立streamの空結果による状態確定は行わない。

**Rationale**: 一覧の承認本文復元、manage/BusStop系の独立stream、評価コンポーネントの`approved`単独filterは、詳細・承認・監査で修正した問題を別画面で再発させる。

## Decision: unknownを表示・集計の中間状態として保持する

承認readがpartial/timeout/候補再照会待ちの投稿は`unknown`として保留する。承認済み投稿だけを評価・統計へ入力する一方、unknown投稿を未承認として破棄せず、snapshot完了後に同じprimary event IDで再評価する。

**Rationale**: `BusStopMemo`や`BusStopDiscussion`は承認到着前に`approved`だけを抽出し、評価画面も`posts.filter(p => p.approved)`でunknownを不可逆に除外している。

## Decision: audit mapperの承認照合をevent IDに限定する

監査timelineの承認解決は承認イベントの`e`タグと対象イベントIDの一致だけを採用する。会話座標`a`タグはrelay filterの範囲指定にのみ使い、投稿承認のfallbackキーには登録しない。

**Rationale**: 同じ会話内の別投稿に対する承認を、会話`a`タグ一致だけで承認済みとする偽陽性が残っている。
