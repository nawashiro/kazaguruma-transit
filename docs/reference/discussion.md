# 意見交換機能リファレンス

この文書は、現在の意見交換機能を説明します。現行の実装、設定、テストと照合します。Nostrの仕様説明と、このアプリの権限・表示ルールを分けます。

## 仕様と正本

- 実装の入口は[`src/app/discussions`](../../src/app/discussions/)です。
- Nostrの読み書きは[`nostr-service.ts`](../../src/lib/nostr/nostr-service.ts)、イベントの解釈は[`nostr-utils.ts`](../../src/lib/nostr/nostr-utils.ts)が担います。
- naddrの変換は[`naddr-utils.ts`](../../src/lib/nostr/naddr-utils.ts)が担います。
- 読み取り順序と部分取得の扱いは[`discussion-detail-read-coordinator.ts`](../../src/lib/discussion/discussion-detail-read-coordinator.ts)と[`discussion-management-read-coordinator.ts`](../../src/lib/discussion/discussion-management-read-coordinator.ts)が担います。
- 設定の入力名は[`app-config.json.example`](../../app-config.json.example)と[`app-config.ts`](../../src/lib/config/app-config.ts)で確認します。
- 権限判定は[`permission-system.ts`](../../src/lib/discussion/permission-system.ts)と各画面の権限ガードで確認します。

NIP-72の公式文書には、現在「unrecommended: try NIP-29 instead」という注記があります。本アプリは既存のNIP-72連携を運用します。この文書は、新しいコミュニティ方式を推奨する文書ではありません。

- [NIP-72: Moderated Communities](https://github.com/nostr-protocol/nips/blob/master/72.md)
- [NIP-25: Reactions](https://github.com/nostr-protocol/nips/blob/master/25.md)
- [NIP-18: Reposts and quote tags](https://github.com/nostr-protocol/nips/blob/master/18.md)
- [NIP-14: Subject tag](https://github.com/nostr-protocol/nips/blob/master/14.md)

## 識別子とURL

会話はNIP-72の`kind:34550`アドレスイベントで識別します。内部の正規形は次です。

```text
34550:<author-pubkey>:<d-tag>
```

画面URLはnaddrを使います。会話詳細の実在するルートは次です。

```text
/discussions/[naddr]
```

`naddr`は`kind:34550`、64文字の16進数公開鍵、`d`タグの識別子から生成します。`extractDiscussionFromNaddr`は別のkindを受け付けません。イベント参照、読み取りフィルター、投稿タグは、必要に応じて正規形へ変換します。

`d`タグは会話の作成時に入力します。3文字以上100文字以内で、小文字英数字とハイフンだけを使います。編集時に`d`タグは変更しません。

## Nostrイベント

### 会話定義

会話定義は`kind:34550`です。現行実装は次のタグを読み書きします。

- `d`: 会話ID
- `name`: 表示名
- `description`: 説明
- `p:<pubkey>::moderator`: モデレーター

同じ`d`タグの置換可能イベントは、読み取り時に新しい`created_at`を優先します。モデレーターの公開鍵は16進数で保存します。

### 会話への投稿

新しい投稿は`kind:1111`で作ります。投稿には会話の`a`タグを付けます。任意でバス停名を`t`タグに付けます。投稿本文は前後の空白を除いて保存します。

NIP-72の説明はコミュニティ参照に`A`タグを示します。現行writerは小文字の`a`を使い、読み取り側は`a`と`A`の両方を解釈します。この差は現在の互換処理です。

読み取りは`kind:1111`を優先し、NIP-72の後方互換性として`kind:1`も受け付けます。読み取り側は`a`と`A`の参照を解釈します。新規投稿で`kind:1`を作りません。

`t=moderator-request`を持つ`kind:1111`は通常投稿から除外します。これはモデレーター申請として別に扱います。

### 承認

投稿承認の発行イベントは`kind:4550`です。現行の`createApprovalEvent`は次のタグを付けます。

- `a`: 会話の正規形
- `e`: 承認対象の投稿ID
- `p`: 投稿者の公開鍵
- `k`: 元投稿のkind

読み取り側の`parseApprovalEvent`は`a`、`e`、`p`がないイベントを除外します。`k`は発行時に元投稿のkindを保持します。

承認が1件以上あれば投稿を承認済みとします。承認の読み取りが完了していない場合、投稿の状態を`unknown`にします。完全な`eose`を受け、承認がない場合だけ未承認と確定します。

承認の取り消しと会話の削除は`kind:5`で送信します。承認を取り消せる利用者は、自分が発行した承認だけを対象にします。

### 評価

評価はNIP-25の`kind:7`です。対象投稿を`e`タグで示し、会話を含める場合は`a`タグを付けます。評価値はタグではなく本文で読み取ります。

- 本文が`+`: 賛成
- 本文が`-`: 反対
- 空の本文: 無効
- `-`以外の空でない本文: 現行パーサーは賛成として解釈

現在の表示と合意分析は、承認済み投稿だけを対象にします。

### 会話一覧への掲載申請

会話作成画面は、会話定義を公開してnaddrを表示します。現行画面は作成処理で掲載申請を同時送信しません。作成者が基本情報画面の「会話一覧へ掲載申請」を押すと、次の`kind:1111`を作ります。

- `a`: 掲載一覧会話の正規形
- `p`: 掲載一覧を管理する公開鍵
- `k`: `34550`
- `q`: 掲載する会話の正規形
- `content`: `nostr:<discussion-naddr>`

掲載管理画面は`q`タグの会話を解決します。掲載申請に承認があり、参照先を取得できた会話だけを公開一覧に表示します。

### モデレーター申請

会話固有のモデレーター申請は`kind:1111`で作ります。タグは次です。

- `a`: 会話の正規形
- `p`: 会話作成者の公開鍵
- `t`: `moderator-request`

申請画面は`/discussions/[naddr]/moderators`です。作成者だけが申請を承認・削除し、次の`kind:34550`更新イベントを発行します。申請者は任意の理由を本文に書けます。

## 権限

権限はログイン状態、会話作成者、会話のモデレーター、設定済み管理者で判定します。管理者はモデレーターとしても扱います。

| 役割 | 現行画面でできる操作 |
| --- | --- |
| 未ログイン | 公開データの読み取り。投稿、評価、作成、承認はログイン画面へ移動 |
| ログイン利用者 | 会話作成、会話への投稿、投稿評価、モデレーター申請 |
| 会話作成者 | 自分の会話で投稿承認、会話情報の編集・削除、モデレーター更新の確定 |
| モデレーター | 担当会話の投稿承認。掲載管理会話のモデレーターなら掲載申請を承認・撤回 |
| 管理者 | モデレーターとして承認操作。監査用の名前表示。掲載管理会話の管理 |

`canEditDiscussion`と`canDeleteDiscussion`の共通判定は管理者または作成者を許可します。一方、`/discussions/[naddr]/edit`の現行画面は`isAuthor`を使い、作成者だけに編集UIを表示します。この差を文書で隠しません。権限を統一する変更は実装課題です。

監査用の名前は管理者またはモデレーターにだけ表示します。一般利用者には作成者・モデレーターの役割バッジを表示します。

## 画面と承認フロー

### 公開一覧

`/discussions`は掲載管理会話を読み込みます。掲載申請の`q`タグを解決し、承認済みの参照だけを作成日時の降順で表示します。「新しい会話を作成」から作成画面へ移動できます。読み取り状態は読み込み中、準備完了、部分取得、エラーを持ちます。

### 会話詳細

`/discussions/[naddr]`は会話定義、投稿、承認、評価を段階的に読み込みます。承認済み投稿を評価対象とし、投稿本文と任意のバス停タグを表示します。ログイン利用者はプレビュー後に投稿し、承認後に公開対象へ進めます。

会話詳細のタブは次です。

- 会話: 投稿と評価
- すべての投稿: 承認待ちと承認済みの投稿
- モデレーター: 申請と役割管理
- 基本情報: 作成者だけに表示する編集画面

部分取得では承認状態を`unknown`に保ち、未承認と断定しません。再読み込みで完全取得を試します。

### 投稿承認

`/discussions/[naddr]/approve`は承認待ちと承認済みをタブで表示します。作成者、モデレーター、管理者が承認できます。承認操作は署名してリレーへ公開します。公開に成功した後だけ表示状態を更新します。

### 掲載管理

`/discussions/manage`は掲載一覧会話の投稿を管理します。掲載一覧会話の作成者またはモデレーターだけが承認できます。承認済み会話は参照naddrから詳細画面へ移動します。承認済み表示は最大10件です。

### 作成と編集

`/discussions/create`はログイン利用者が会話を作成します。タイトルは100文字以内、説明は1000文字以内です。モデレーターは`npub`で指定します。成功時に作成したnaddrを表示します。

`/discussions/[naddr]/edit`は作成者がタイトル、説明、モデレーターを更新します。`d`タグは読み取り専用です。ここから掲載申請を送信し、会話を削除できます。

### モデレーター管理と設定

`/discussions/[naddr]/moderators`は申請を表示します。作成者は申請の承認・削除と直接指定をまとめ、署名した会話定義を公開します。

`/discussions/moderator`はモデレーター申請の入口です。`/settings`はログイン利用者が作成した会話を表示します。

## 設定

アプリはルートのデプロイ用`app-config.json`を読み込みます。入力例は[`app-config.json.example`](../../app-config.json.example)です。意見交換に関係する設定名は次です。

- `discussion.enabled`
- `discussion.adminPubkey`
- `discussion.busStopDiscussionId`
- `discussion.discussionListNaddr`
- `discussion.nostrRelays`
- `discussion.nostrTimeoutMs`
- `discussion.readStrategy.idleTimeoutMs`
- `discussion.readStrategy.hardTimeoutMs`
- `discussion.readStrategy.dedupWindowMs`

`isDiscussionsEnabled()`は`discussion.enabled`と掲載一覧naddrの両方を確認します。リレー設定は読み書き両方に使います。読み取り戦略は範囲を制限します。idle timeoutは250msから30秒、hard timeoutはidle timeoutより長く90秒以下、重複除去時間は0から10秒です。

環境変数を意見交換の設定入口として扱いません。`app-config.json`の不備は設定検証エラーになります。必須設定が欠ける場合、意見交換を有効化しません。
