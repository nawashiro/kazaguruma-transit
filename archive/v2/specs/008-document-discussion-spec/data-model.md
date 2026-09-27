# Data Model - Discussion NDK Migration

## Overview

本機能はDB中心ではなくNostrイベント中心モデルを採用する。  
アプリ内部ではNDKイベントからDTOへ変換し、UIはDTOのみを扱う。

## Entities

## 1. Discussion

- Purpose: 会話本体（NIP-72 kind:34550）
- Fields:
  - `uuid` (string, internal, required, immutable)
  - `naddr` (string, required)
  - `title` (string, required, 1..100)
  - `description` (string, required, 1..500)
  - `creatorPubkey` (string, required)
  - `creatorMnemonic` (string, required, derived from pubkey)
  - `moderatorPubkeys` (string[], required)
  - `moderatorMnemonics` (string[], derived)
  - `createdAt` (unix seconds, required)
  - `listingStatus` (enum: `draft` | `pending` | `approved` | `revoked`)
- Validation:
  - UUIDは内部生成のみ、UI入力禁止
  - `naddr`と`creatorPubkey + dTag/identifier`整合
  - 表示名は持たない

State transitions:

- `draft` -> `pending` (掲載申請)
- `pending` -> `approved` (一覧管理で承認)
- `approved` -> `revoked` (一覧管理で撤回)

## 2. DiscussionPost

- Purpose: 会話への投稿（kind:1111、後方互換kind:1読み取り）
- Fields:
  - `id` (string, required)
  - `discussionRef` (string, required; kind:pubkey:identifier)
  - `authorPubkey` (string, required)
  - `authorMnemonic` (string, required)
  - `content` (string, required, 1..280)
  - `tags` (object: `t[]`, `q[]`, optional)
  - `createdAt` (unix seconds, required)
  - `approvalStatus` (enum: `pending` | `approved` | `revoked`)
- Validation:
  - `discussionRef`は対象会話に一致
  - `content`必須

State transitions:

- `pending` -> `approved` (承認イベント付与)
- `approved` -> `revoked` (NIP-09 kind:5 deletion request による承認撤回)

## 3. PostApproval

- Purpose: 投稿承認イベント（kind:4550）
- Fields:
  - `id` (string, required)
  - `discussionRef` (string, required)
  - `postId` (string, required)
  - `postAuthorPubkey` (string, required)
  - `approverPubkey` (string, required)
  - `approverMnemonic` (string, required)
  - `createdAt` (unix seconds, required)
- Validation:
  - `approverPubkey`は会話作成者またはモデレーター
  - 同一投稿に対する同一承認者の二重承認は無効化

## 4. PostEvaluation

- Purpose: 賛否評価（NIP-25 kind:7）
- Fields:
  - `id` (string, required)
  - `postId` (string, required)
  - `discussionRef` (string, optional)
  - `evaluatorPubkey` (string, required)
  - `evaluatorMnemonic` (string, required)
  - `rating` (enum: `+` | `-`, required)
  - `createdAt` (unix seconds, required)
- Validation:
  - `content`は`-`か`+`のみ受理する。
  - ユーザーごとの同一投稿再評価はUI候補から除外

## 5. ListingRequest

- Purpose: 会話一覧掲載申請（会話編集画面から発行、NIP-72 community post kind:1111）
- Fields:
  - `id` (string, required)
  - `eventKind` (integer, required, fixed: 1111)
  - `discussionRef` (string, required)
  - `discussionListRef` (string, required; `a` tag)
  - `requesterPubkey` (string, required; 会話作成者)
  - `requesterMnemonic` (string, required)
  - `content` (string, required; `nostr:naddr...`)
  - `qRef` (string, required; `q` tag with `34550:pubkey:identifier`)
  - `status` (enum: `pending` | `approved` | `revoked`)
  - `createdAt` (unix seconds, required)

State transitions:

- `pending` -> `approved`
- `approved` -> `revoked` (NIP-09 kind:5 deletion request による掲載申請撤回)

## 6. ModeratorPromotionRequest

- Purpose: モデレーター昇格申請（権限なしユーザー -> 会話作成者）
- Fields:
  - `id` (string, required)
  - `eventKind` (integer, required, fixed: 1111)
  - `discussionRef` (string, required)
  - `discussionTag` (string, required; `a` tag)
  - `recipientPubkey` (string, required; `p` tag, 会話作成者)
  - `requestTypeTag` (string, required, fixed: `moderator-request`; `t` tag)
  - `applicantPubkey` (string, required)
  - `applicantMnemonic` (string, required)
  - `requestState` (enum: `requested-unapproved` | `requested-approved`)
  - `isActive` (boolean, required; NIP-09削除前はtrue)
  - `createdAt` (unix seconds, required)
- Validation:
  - 申請・承認・確認は会話編集画面で実施する
  - 会話編集画面は全ユーザー閲覧可能とする
  - 審査操作は会話作成者のみ
  - `eventKind=1111` かつ `t=moderator-request` で通常投稿と区別する
  - `discussionTag` と `discussionRef` は同一会話を指す必要がある
  - `requestState` は `kind:34550` の最新モデレーター集合に申請者公開鍵が含まれるかで導出する
  - 昇格専用の承認/却下イベントは生成しない（NIP-72のcommunity definition更新で表現）

State transitions:

- `requested-unapproved` -> `requested-approved` (kind:34550更新でモデレーター集合に追加)
- `requested-*` -> inactive (NIP-09 kind:5 deletion request)

## 7. ListAuditTimelineItem

- Purpose: 会話一覧監査画面専用の監査項目（会話一覧管理に関わる申請履歴）
- Fields:
  - `id` (string, required)
  - `scope` (fixed: `list`)
  - `type` (enum:
    `listing-requested`,
    `promotion-requested`)
  - `actorPubkey` (string, required)
  - `actorMnemonic` (string, required)
  - `targetRef` (string, optional; 会話または申請対象参照)
  - `timestamp` (unix seconds, required)
  - `rawEventRef` (string, required)
  - `revokeEventRef` (string, optional; NIP-09 kind:5)
  - `approvalState` (enum: `unapproved` | `approved`, derived)
  - `approvedByPubkey` (string, optional, derived)
  - `approvedByMnemonic` (string, optional, derived)
- Pagination:
  - 初回: 最新10件
  - 追加: 10件ずつ
  - 重複表示禁止

## 8. DiscussionAuditTimelineItem

- Purpose: 会話詳細監査画面専用の監査項目（個別会話に関わる履歴のみ）
- Fields:
  - `id` (string, required)
  - `scope` (fixed: `discussion`)
  - `discussionRef` (string, required)
  - `type` (enum:
    `post-submitted`,
    `promotion-requested`)
  - `actorPubkey` (string, required)
  - `actorMnemonic` (string, required)
  - `targetRef` (string, optional; 投稿/申請参照)
  - `timestamp` (unix seconds, required)
  - `rawEventRef` (string, required)
  - `revokeEventRef` (string, optional; NIP-09 kind:5)
  - `approvalState` (enum: `unapproved` | `approved`, derived)
  - `approvedByPubkey` (string, optional, derived)
  - `approvedByMnemonic` (string, optional, derived)
- Pagination:
  - 初回: 最新10件
  - 追加: 10件ずつ
  - 重複表示禁止

## 9. ConsensusAnalysisView

- Purpose: FR-008の合意形成分析表示用の派生読み取りモデル（既存 `EvaluationService` 再利用）
- Fields:
  - `groupAwareConsensus` (array, required)
    - item:
      - `postId` (string, required)
      - `consensusScore` (number, required)
      - `overallAgreePercentage` (integer, required, 0..100)
  - `groupRepresentativeComments` (array, required)
    - item:
      - `groupId` (integer, required)
      - `comments` (array, required)
      - comment item:
        - `postId` (string, required)
        - `representativenessScore` (number, required)
        - `zScore` (number, required)
        - `pValue` (number, required)
        - `voteType` (enum: `agree` | `disagree`, required)
        - `agreeRatio` (number, required)
        - `disagreeRatio` (number, required)
- Validation:
  - 新規分析アルゴリズムは追加せず、`src/lib/evaluation/evaluation-service.ts` の `analyzeConsensus` 結果をそのまま利用する
  - 分析対象は承認済み投稿のみ
  - データ不足時は空配列を返す

## Relationships

- Discussion 1 - N DiscussionPost
- Discussion 1 - N ListingRequest
- Discussion 1 - N ModeratorPromotionRequest
- DiscussionPost 1 - N PostApproval
- DiscussionPost 1 - N PostEvaluation
- Discussion / ListingRequest entities -> N ListAuditTimelineItem
- Discussion / DiscussionPost / Request entities -> N DiscussionAuditTimelineItem
- Discussion + PostEvaluation entities -> 1 ConsensusAnalysisView

## Derived View Rules

- すべてのユーザー表示IDは`pubkey -> BIP39 mnemonic`で導出。
- 表示用MnemonicはBIP39日本語語彙を使用し、先頭3フレーズのみ表示する。
- 表示名（kind:0のname）はUIに表示しない。
- 権限なしユーザー向け操作は、表示したまま`disabled` + 理由文。
- モデレーター集合は常にDiscussion（kind:34550）最新イベントを正とする。
- `revoked` 判定は対象イベントに紐づく NIP-09 kind:5 deletion request の存在で行う。
- `listing-requested` の承認済み/未承認表示は掲載承認状態を参照して修飾する。
- `promotion-requested` の承認済み/未承認表示は `kind:34550` 最新状態を参照して修飾する。
- 承認済み表示時は、承認者公開鍵とMnemonic codeを修飾情報として表示する。
- 設定画面の自作会話一覧は completion-aware read を正とし、`completionReason` が `idle-timeout` / `hard-timeout` / `cancelled` の場合は再試行導線を表示する。
- FR-008は既存合意形成ロジック（`evaluation-service` / `polis-consensus`）を再利用し、契約変更時も分析アルゴリズムそのものは変更対象外とする。
