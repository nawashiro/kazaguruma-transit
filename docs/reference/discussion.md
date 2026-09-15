# 意見交換機能リファレンス

この文書は、現在の意見交換機能を説明します。現行の実装、設定、テストと照合します。このアプリの権限・表示ルールを説明します。

Nostrの仕様は説明しません。NIP文書をご覧ください。

## 仕様と実装

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

## Nostrイベント

### 会話への投稿

`t=moderator-request`を持つ`kind:1111`は通常投稿から除外します。これはモデレーター申請として別に扱います。

### 評価

評価はNIP-25の`kind:7`です。評価値はタグではなく本文で読み取ります。

- 本文が`+`: 賛成
- 本文が`-`: 反対
- 空の本文: 無効
- `-`以外の空でない本文: 現行パーサーは賛成として解釈

現在の表示と合意分析は、承認済み投稿だけを対象にします。

### 会話一覧への掲載申請

会話作成画面は、会話定義を公開してnaddrを表示します。現行画面は作成処理で掲載申請を同時送信しません。作成者が基本情報画面の「会話一覧へ掲載申請」を押すと、次の`kind:1111`を作ります。

- `q`: 掲載する会話の正規形
- `content`: `nostr:<discussion-naddr>`

掲載管理画面は`q`タグの会話を解決します。掲載申請に承認があり、参照先を取得できた会話だけを公開一覧に表示します。

### モデレーター申請

会話固有のモデレーター申請は`kind:1111`で作ります。

`t`: `moderator-request`

申請画面は`/discussions/[naddr]/moderators`です。作成者だけが申請を承認・削除し、次の`kind:34550`更新イベントを発行します。申請者は任意の理由を本文に書きます。

## 権限

権限は会話作成者 + 会話のモデレーターで判定します。

ここでは掲載申請管理も、通常の会話と同様の会話として説明しています。

| 役割           | 概要                     | 現行画面でできる操作                                                |
| -------------- | ------------------------ | ------------------------------------------------------------------- |
| 未ログイン     | 閲覧。                   | 公開データの読み取り。                                              |
| ログイン利用者 | ユーザーとして活動。     | 未ログイン権限 + 会話作成、会話への投稿、投稿評価、モデレーター申請 |
| モデレーター   | 担当会話の管理メンバー。 | ログイン利用者権限 + 担当会話の投稿承認。                           |
| 会話作成者     | 自分の会話の管理者。     | モデレーター権限 + 会話情報の編集、モデレーターを任命               |

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

`app-config.json`の不備は設定検証エラーになります。必須設定が欠ける場合、意見交換を有効化しません。
