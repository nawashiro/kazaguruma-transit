# Feature Specification: Discussion read lifecycleの単純化

**Feature Branch**: `refactor/nostr-discussion-read-coordinator`

**Created**: 2026-08-23

**Status**: Implemented

**Input**: User description: `/discussions`と`/discussions/[naddr]`の取得経路を、既存の共通read executorを維持したまま、route単位のsnapshotと明確なread lifecycleへ再設計する。executorの実態に合わせてNostr基盤として命名・配置を整理し、重複取得とEOSE境界の曖昧さをなくす。

## User Scenarios & Testing

### User Story 1 - 詳細画面を一つの取得結果として利用する (Priority: P1)

利用者は、`/discussions/[naddr]`とその子routeを閲覧するとき、会話情報、投稿、承認、モデレーター申請、評価が同じ詳細read lifecycleから提供されることを期待する。タブや子routeの表示コンポーネントが個別にNostr取得を開始してはならない。

**Why this priority**: 詳細画面の複数readと中間callbackが、承認read中の評価readや同じmoderator requestの再取得を引き起こし、表示状態と取得完了状態を分離しているため。

**Independent Test**: Nostr transportを固定fixtureに置き、詳細routeを表示してからsnapshotが確定するまでのread呼出を記録する。必要なphaseだけが順序どおりに実行され、子routeの表示切替で追加readが始まらないことを確認する。

**Acceptance Scenarios**:

1. **Given** 有効な詳細URLとrelay応答がある、**When** 詳細routeを開く、**Then** 会話情報・投稿・承認・申請・評価が一つの詳細snapshotに反映される。
2. **Given** `/discussions/[naddr]`から`approve`、`moderators`、`edit`へ遷移する、**When** 同じ詳細routeのlayoutが維持される、**Then** 子ページは既存snapshotを読み、同じデータを再取得しない。
3. **Given** 評価を取得できる、**When** ログイン中ユーザーの評価状態を表示する、**Then** 追加の「ユーザー評価全件」readを行わず、詳細snapshotの評価から導出する。
4. **Given** moderator requestが投稿readに含まれる、**When** moderatorsまたはeditを表示する、**Then** 専用の重複readを行わず、同じsnapshotの申請一覧を表示する。

---

### User Story 2 - 一覧画面を一つの掲載snapshotとして利用する (Priority: P1)

利用者は、`/discussions`、`/discussions/manage`、`/discussions/moderator`で、掲載用会話の投稿・承認・参照先会話定義が同じ一覧read lifecycleから提供されることを期待する。

**Why this priority**: 一覧系routeが同じ掲載対象を扱う一方、画面ごとに取得責務を分けると、空一覧判定・参照解決・relay実績が分散するため。

**Independent Test**: 掲載投稿、承認、参照先会話定義をfixtureとして用意し、トップレベル各routeを表示する。掲載snapshotが一度だけ生成され、各画面が必要なselectorだけを使うことを確認する。

**Acceptance Scenarios**:

1. **Given** 掲載投稿に有効な会話参照がある、**When** `/discussions`を開く、**Then**参照先会話が重複なく一覧に表示される。
2. **Given** 同じ参照先が複数の掲載投稿から参照される、**When** 一覧readを実行する、**Then** 参照先定義は一件の論理会話として扱われる。
3. **Given** `/discussions/manage`または`/discussions/moderator`を開く、**When** 同じ掲載snapshotが利用可能である、**Then** 管理画面は独自の掲載投稿readを開始しない。

---

### User Story 3 - 不完全なreadを安全に扱う (Priority: P1)

利用者は、relay応答が不完全な場合に「会話が存在しない」「未承認である」「掲載がない」と誤って断定されないことを期待する。取得済みデータを表示できる場合は暫定状態として表示し、全体を再読み込みできることを期待する。

**Why this priority**: EOSE、timeout、retry、approvalのphaseが個別にUIへ流れると、未完了データが確定データとして扱われる危険があるため。

**Independent Test**: metadata、content、approval、evaluationの各fixtureを成功・partial・errorで組み合わせ、最終snapshot状態とボタン有効状態を確認する。

**Acceptance Scenarios**:

1. **Given** 一部のreadがtimeoutまたはerrorで終わる、**When** 取得済みデータがある、**Then** データを保持し、暫定状態と再読み込み操作を表示する。
2. **Given** readが不完全で承認イベントを確認できない、**When** 投稿を表示する、**Then** 未承認とは断定せず、承認操作を無効化する。
3. **Given** 詳細readが完全に成功する、**When** snapshotを表示する、**Then** 不要な部分read警告を表示しない。
4. **Given** 利用者が再読み込みする、**When** 新しいread sessionを開始する、**Then** 古いsessionの結果が現在のsnapshotを上書きしない。

---

## Edge Cases

- 無効なnaddrではNostr readを開始せず、詳細snapshotを作成しない。
- 同一eventが複数relayまたはretryから届いても、既存のNostr identity deduplication規則で一件に統合する。
- metadataは成功したがcontentがpartialの場合、metadataだけを根拠に投稿や承認の確定状態を推測しない。
- approval readが空でも、primary readがpartialなら未承認と確定しない。
- retryが空結果を返しても、先行readで取得済みのeventを削除しない。
- 子route遷移中に古いreadが完了しても、別のnaddrのsnapshotを汚染しない。
- relay実績はread phaseごとに保持し、metadata成功relayをcontent成功relayと誤認しない。
- sessionStorageが使えない場合でも、readと画面表示は継続する。

## Requirements

### Functional Requirements

- **FR-001**: システムは詳細route familyごとに一つの詳細snapshotを提供し、metadata、content、approval、moderator request、evaluationの表示コンポーネントが個別にNostr readを開始してはならない。
- **FR-002**: システムは一覧route familyごとに一つの掲載snapshotを提供し、`/discussions`、`/discussions/manage`、`/discussions/moderator`の表示コンポーネントが同じ掲載データを個別に取得してはならない。
- **FR-003**: システムは既存の共通Nostr read executorのrelay候補、attempt、retry、completion、dedupe、provenanceの契約を維持し、routeごとに同等の通信処理を再実装してはならない。
- **FR-004**: 共通read executorの命名と配置は、Discussion固有の業務処理ではなくNostr基盤である実態を表さなければならない。Discussion固有のread planとsnapshot生成はNostr基盤から分離する。
- **FR-005**: 詳細snapshotは、通常投稿とmoderator requestを同じprimary content readから分離して保持し、moderators/edit画面の専用重複readを不要にしなければならない。
- **FR-006**: 詳細snapshotの`userEvaluationIds`は、取得済み評価イベントから導出し、ユーザー評価全件を取得する追加readを開始してはならない。
- **FR-007**: 初期詳細readは、phaseの一部完了を子ページへ独立したloading完了として通知してはならない。snapshotの確定状態は詳細coordinatorが管理しなければならない。
- **FR-008**: read状態は、完全成功、partial、error、loadingを一つのroute-scoped stateとして表現し、phaseごとの状態をUI契約へ不用意に公開してはならない。
- **FR-009**: partial状態では取得済みデータを保持して表示できるが、未確認のapprovalやmetadataを確定事実として扱ってはならない。
- **FR-010**: 再読み込みまたはnaddr変更時、古いread sessionの結果を現在のsnapshotへ適用してはならない。
- **FR-011**: successful relay実績は、Nostr read結果、現在のread sessionのprovenance、sessionStorage cacheの三層で保持しなければならない。
- **FR-012**: successful relay cacheはmetadata、content、evaluation、referenceなどread phaseを区別し、異なるphaseのrelay実績を無条件に混在させてはならない。
- **FR-013**: Nostr read executorは、Providerまたはcoordinatorが組み立てたrelay候補を受け取り、既存の順序・初回attempt・限定retry・結果mergeを実行しなければならない。relay候補の意味づけをexecutorへ移してはならない。
- **FR-014**: 既存のNostrServiceを実通信・EOSE・timeoutの境界として維持し、詳細coordinatorがNDK購読やEOSEカウンタを直接扱ってはならない。
- **FR-015**: `/discussions`は、掲載投稿・承認・q参照解決・参照先会話定義を一つの掲載snapshot lifecycleで扱い、partialな空結果を確定した空一覧として表示してはならない。
- **FR-016**: 子routeはsnapshot selectorと業務actionだけを扱い、`executeNostrRead`、gateway query、NostrServiceのread APIを直接呼び出してはならない。
- **FR-017**: UIのloading、partial、error、reload通知は日本語で表示し、既存の`role="status"`、`aria-live="polite"`、44px以上の操作領域を維持しなければならない。
- **FR-018**: 本featureは新規DB永続化を追加せず、既存のNostr relay正本とブラウザ暫定cacheを利用しなければならない。

### Key Entities

- **Nostr Read Executor**: relay候補を受け取り、completion-aware read、retry、event統合、relay実績を共通処理するNostr基盤。
- **Discussion Read Plan**: Discussion固有の目的とfilterを表すread要求。Nostr executorが利用する汎用read planへ変換可能である。
- **Discussion Detail Snapshot**: 一つの詳細route familyで共有する会話、投稿、承認、申請、評価とその導出状態。
- **Discussion Management Snapshot**: 一覧route familyで共有する掲載用会話、掲載投稿、承認、参照先定義とその取得状態。
- **Read Session**: naddrまたは一覧targetに紐づく一回のread lifecycle。generation、state、snapshot、relay provenanceを持つ。
- **Relay Provenance**: read phaseごとのsuccessful relayと、現在のread結果における取得元情報。
- **Read Cache**: sessionStorageに保存する暫定event、metadata、phase別relay実績。Nostr relayの正本ではない。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 詳細routeのmain、approve、moderators、editを同一sessionで表示したfixtureにおいて、必要な論理readが一度ずつ実行され、子route表示による重複readが0件になる。
- **SC-002**: moderator requestを含む詳細fixtureにおいて、moderators/edit専用の追加moderator request readが0件になる。
- **SC-003**: 評価fixtureにおいて、全評価から現在ユーザーの評価状態を導出し、ユーザー評価全件の追加readが0件になる。
- **SC-004**: partial/error fixtureで、空一覧・未承認・Not Foundの誤確定が0件になる。
- **SC-005**: naddr変更またはreload中のstale session fixtureで、旧sessionイベントの現在snapshotへの混入が0件になる。
- **SC-006**: phase別relay provenance fixtureで、metadata成功relayがcontent成功relayへ誤って保存されないことを100%検証できる。
- **SC-007**: 既存executorとNostrServiceのrelay attempt、retry、completion、dedupe契約に対する既存テストが全件成功する。
- **SC-008**: 変更後にstrict TypeScript、lint、全Jest、build、`git diff --check`が成功する。

## Assumptions

- Nostr relayがイベントデータの正本であり、SQLiteや新規DBは使用しない。
- relay候補の意味づけと優先順位はProviderまたはdomain coordinatorが決め、既存executorは通信オーケストレーションを担う。
- 既存の限定retryとpartial表示契約は維持する。ただし、phaseごとのloading callbackをUIの完了契約として公開しない。
- 初期snapshot確定を優先し、詳細子routeでの個別lazy readは削減する。評価件数が将来問題になった場合のpaginationは別featureとする。
- `sessionStorage`の旧cacheフィールドは、契約を単純化するためversion更新とともにphase別provenanceへ移行する。
- テストはJestとReact Testing Libraryで実装し、実relayの不安定性に依存しない決定的fixtureを使用する。
