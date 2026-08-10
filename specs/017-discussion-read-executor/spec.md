# Feature Specification: Discussion read executorによる掲載会話取得の信頼性向上

**Feature Branch**: `017-discussion-read-executor`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Issue #68。`/settings` には表示される掲載済み会話が `/discussions` に表示されない。画面固有のリクエスト組み立ては維持しつつ、relay候補選別から実際の通信までをDRYにする。複数参照のfilter結合とページ分割も仕様化する。"

> この仕様は `AGENTS.md` と `.specify/memory/constitution.md` に従う。Nostr relay を正本とし、`specs/009-coracle-style-sync` の選別された部分同期、completion-aware read、取得元 relay 実績の分離を引き継ぐ。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 掲載済み会話を会話一覧で見つける (Priority: P1)

利用者は、掲載一覧に参照されている会話を `/discussions` で確認できる。会話定義が設定済みrelayに存在し、掲載一覧naddrのhint relayが応答しない場合でも、取得不能を「会話がまだありません」と誤表示しない。

**Why this priority**: `/settings` と `/discussions` で同じ kind 34550 の可視性が異なる問題を解消し、公開一覧の信頼性を回復する。

**Independent Test**: 掲載投稿と参照先 kind 34550 を設定済みrelayから返し、hint relayを無応答にする。`/discussions` が会話を表示するか、少なくとも部分取得・再読み込み可能状態を表示し、空一覧を確定表示しないことを確認する。

**Acceptance Scenarios**:

1. **Given** 掲載投稿と参照先会話定義が選別済みrelayから取得できる、**When** 利用者が `/discussions` を開く、**Then** `q` tagで参照された会話定義が一覧に一度だけ表示される。
2. **Given** 初回のrelay候補がtimeoutとなり、未試行の候補に設定済みrelayが残る、**When** 一覧readが完了する、**Then** 画面は会話不存在を確定せず、部分取得状態と再読み込み導線を表示する。
3. **Given** `/settings` の作者別readで取得できる会話が掲載投稿から参照されている、**When** `/discussions` がその参照を解決する、**Then** relay候補・completion-aware通信の共通規則に従って会話定義を取得する。

---

### User Story 2 - relay応答が不完全でも状況を判断する (Priority: P2)

利用者は、会話一覧の掲載投稿readまたは参照先会話readが timeout・cancelled で終わった場合、表示内容が暫定であることと再読み込み可能であることを日本語で知る。

**Why this priority**: relay沈黙は会話が存在しない証拠ではない。空結果をNot Foundや未掲載として扱うと、情報を失わせる。

**Independent Test**: 掲載投稿readまたは参照先readを `idle-timeout`、`hard-timeout`、`cancelled` で完了させ、eventsの有無に応じた部分取得または取得不能状態を検証する。

**Acceptance Scenarios**:

1. **Given** 掲載投稿のreadが timeout で一部イベントを返す、**When** 一覧を表示する、**Then** 取得済み会話を残し、暫定状態と再読み込み導線を表示する。
2. **Given** 参照先会話定義のreadが timeout でイベントを返さない、**When** 一覧を表示する、**Then** 会話がまだないとは表示せず、取得不能または部分取得状態を通知する。
3. **Given** 全対象readが EOSE で完了し、掲載投稿も参照先会話もない、**When** 一覧を表示する、**Then** 初めて空一覧を確定表示する。

---

### User Story 3 - 多数の掲載参照を過剰な通信なく閲覧する (Priority: P3)

利用者は、多数の会話参照を含む掲載一覧でも、relayへの無制限な購読を発生させず、安定した順序で必要な会話を順次閲覧できる。

**Why this priority**: 参照ごとのfilterを無制限に並べると、relayの購読数が増え、一覧が遅く不安定になる。一方で、kind 34550 の広域取得は不要なイベントを増やす。

**Independent Test**: 上限を超える参照を含む掲載投稿を用意し、各pageで選別済みrelay setと上限内のfilterだけが使われ、続き取得時に未読参照だけが対象になることを検証する。

**Acceptance Scenarios**:

1. **Given** 掲載投稿に実行上限を超える有効な `q` 参照がある、**When** 初回一覧を開く、**Then** 上限内の参照だけをreadし、残りは続き取得可能な状態として保持する。
2. **Given** 利用者が続き取得を要求する、**When** 次のpageを読む、**Then** 前pageで完了済みの参照を再読せず、未読参照だけを安定順序で対象にする。
3. **Given** pageの一部relayがtimeoutする、**When** 続き取得可能性を決定する、**Then** 未取得参照を不存在として確定せず、partial状態を保持する。

---

### Edge Cases

- naddr hint、過去の成功実績、設定済みrelayが重複または不正なURLを含む場合、正規化・重複排除後の優先順を維持する。
- naddr hintが3件ありすべて無応答でも、初回readで設定済みrelayを追加問い合わせすることはしない。未試行候補を明示し、再読み込み時の限定再readの対象とする。
- 同じ kind 34550 が複数relayまたは複数pageから届く場合、event IDで一件に重複排除し、最新のreplaceable eventだけを表示に用いる。
- 掲載投稿のrelay実績と、参照先会話定義のrelay実績は別read targetとして保存し、候補順位の根拠を混同しない。
- 古いread世代の結果、timeoutだけの空結果、または未完了pageの結果は、既に取得済みの会話定義を削除する根拠にしない。
- 参照tagが `34550:pubkey:dTag` 形式ではない場合は読取対象から除外し、他の有効参照の処理を止めない。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムはDiscussion readごとに、画面が宣言したfilter・対象・timeout設定を `DiscussionReadPlan` または同等の明示的なread planとして保持しなければならない。
- **FR-002**: システムはrelay候補の順位付け、上限適用、`NDKRelaySet` による選別済みrelayへのcompletion-aware通信を、UIごとの重複実装ではなく共通のread executorで実行しなければならない。
- **FR-003**: 共通read executorは、eventsだけでなく、`completionReason`、実際に問い合わせたrelay、event IDごとの取得元relay、重複数、経過時間を呼出側へ返さなければならない。
- **FR-004**: 共通read executorは、naddr hint、推奨relay、対象イベントを返した成功relay、設定済みrelay、既定relayの優先順位を保ち、初回候補数を設定値の1〜3件に制限しなければならない。
- **FR-005**: システムは初回readで候補数上限を超えるrelayへ拡大問い合わせしてはならない。未試行候補は、明示的な再読み込みまたは仕様で許可された限定再readでのみ使用しなければならない。
- **FR-006**: `/discussions` は掲載投稿の取得と、`q` tagが参照する kind 34550 会話定義の取得を別のread targetとして扱い、それぞれのcompletion状態とrelay実績を保持しなければならない。
- **FR-007**: `/discussions` は掲載投稿と参照先会話定義のいずれかが `idle-timeout`、`hard-timeout`、`cancelled` で完了した場合、空一覧または会話不存在を確定表示してはならない。
- **FR-008**: `/discussions` は掲載投稿と参照先会話定義の両方がEOSEで完了し、表示対象がない場合にだけ、空一覧を確定表示してよい。
- **FR-009**: システムは複数の参照先会話filterを、一つのread planと一つの選別済みrelay setに結合して実行できなければならない。ただし、参照ごとのauthor、`#d`、limit 1の範囲は維持しなければならない。
- **FR-010**: システムは一回の参照先会話readに含めるfilter数の上限を設定可能にしなければならない。初期値は実装計画で決定し、無制限を既定にしてはならない。
- **FR-011**: システムは参照数がfilter上限を超えるとき、安定した順序でpageに分割し、続き取得では既にEOSEで確定した参照を再読してはならない。
- **FR-012**: pageがpartialまたはtimeoutで完了した場合、システムは未解決参照を未掲載・不存在・不正として確定してはならない。
- **FR-013**: システムは一覧掲載投稿と参照先会話定義について、`attemptedRelayUrls` とイベントを実際に返した `successfulEventRelayUrls` を区別して保存しなければならない。
- **FR-014**: システムは同じevent IDの重複配送を一件として扱い、表示順を `created_at` 降順、同時刻はevent ID昇順で安定させなければならない。
- **FR-015**: 画面はfilter、relay URL、`NDKRelaySet` を直接組み立ててはならない。画面固有の掲載判定、表示順、ページ操作は画面側の責務として維持しなければならない。
- **FR-016**: 部分取得・取得不能・再読み込み可能の状態は、日本語の `role="status"` と `aria-live="polite"` を用いて通知し、再読み込みまたは続き取得の操作対象は44px以上にしなければならない。
- **FR-017**: 実装前に、`/settings` では取得できる掲載済み会話が `/discussions` で欠落する回帰ケース、relay候補優先順、timeout時の空一覧抑止、filter結合、page分割、source relay分離の各テストを追加し、失敗を確認しなければならない。

### Key Entities

- **Discussion Read Plan**: 画面目的、filter群、timeout、relay候補入力、page cursorを表す宣言的なread要求。
- **Discussion Read Executor**: read planからrelay候補を選別し、選別済みrelay setでcompletion-aware readを実行して観測可能な結果を返す共通境界。
- **Discussion Read Result**: events、completion reason、attempted relay URLs、event IDごとのsource relay URLs、重複数、経過時間を持つ結果。
- **Listing Read State**: 掲載投稿readと参照先会話readの各完了状態、未解決参照、次pageの有無、表示可能な会話を保持する状態。
- **Reference Page**: 安定順序で区切られた参照先会話filter群と、その完了状態・cursorを表す単位。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 回帰fixtureで、`/settings` の作者別readで取得でき、掲載投稿から有効に参照される kind 34550 が `/discussions` に100%表示される。
- **SC-002**: hint relayが無応答で、設定済みrelayにのみ会話定義があるfixtureにおいて、初回read後のUIは100%空一覧を確定表示せず、部分取得または再読み込み可能状態を表示する。
- **SC-003**: 同じ参照先会話filterを使う各pageで、relay候補の優先順位・最大3 relay・`NDKRelaySet`使用をテストで100%確認できる。
- **SC-004**: filter上限を超える参照fixtureで、一回のreadに含まれるfilter数が上限以下であり、続き取得が既にEOSEで解決した参照を再読しないことを100%確認できる。
- **SC-005**: 掲載投稿readと参照先会話readのsource relay実績が別々に保存され、問い合わせただけのrelayが成功実績へ混入しないことを100%確認できる。
- **SC-006**: 変更対象の全テスト、TypeScript型検査、lint、buildが成功する。

## Assumptions

- 公開一覧に表示すべき会話は、既存の掲載投稿に有効な `q` tagで参照される kind 34550 に限定する。作者自身の会話を無条件に公開一覧へ追加することは本featureの対象外とする。
- pageサイズおよび一readあたりのfilter上限は、relayの実測・既存性能要件・テストの決定論を踏まえて計画段階で決定する。
- `NostrService` は汎用のNDK接続・購読境界として維持する。Discussion固有のfilterや候補順位は `src/lib/discussion` 側に置く。
- 既存の `specs/009-coracle-style-sync` の承認結合、unknown状態、キャッシュ契約を変更しない。009から意図的に外れる設計が必要な場合は、性能・互換性・信頼性への影響を `plan.md` に記録する。
- このfeatureは新規の永続データベースを導入しない。既知データは既存の `sessionStorage` 契約の範囲に限定する。
