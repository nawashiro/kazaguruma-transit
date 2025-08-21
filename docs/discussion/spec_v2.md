# コンセプト

現在の実装では、管理者に会話作成権限が一極集中している。通常ユーザーでも会話を作成・管理できるようにする。ただし、悪意のある操作を防ぐため、[NIP-72](NIP-72.md)を使用した承認つきの一覧を使用する。

## 画面一覧

1. 会話一覧画面 `discussions`: 管理者作成の Kind:34550 を使用して、承認済み投稿を集め、引用として含まれたユーザー作成の Kind:34550 へのリンクを一覧する。
   1. 監査ログも修正する必要がある。管理者・モデレーターのみプロファイルを取得し、名前を表示する。
2. 会話画面 `discussions/[naddr]`: naddr を受け取り、該当 kind:34550 を表示する。
   1. これらは新規作成するのではなく、既存の`discussions/[id]`を編集して作成する。`id`が`naddr`になっているのは、意味付けのための変更である。
   2. 監査ログも修正する必要がある。プロファイルは取得せず、「作成者」「モデレーター」の badge を表示する。
3. 会話作成者用編集画面: `discussions/[naddr]/edit`: 会話作成者にのみ表示される。該当 Kind:34550 を編集・削除できる。
   1. 既存の`discussions/manage`が参考になる。
4. 会話承認画面 `discussions/[naddr]/approve`: モデレーター及び会話作成者は発言を承認できる。
5. 会話管理画面 `discussions/manage`: 会話一覧への追加を承認・撤回できる。
6. 会話作成画面 `discussions/create/`: 会話を作成し、会話一覧への追加をリクエストできる。
7. 設定 `settings`: 自分が作成した会話の一覧が表示される。ここからも削除をすることができる。
   1. 既存の実装に追加する。

## 会話作成フロー

1. ユーザーは会話一覧から会話作成画面へアクセスし、会話を作成・会話一覧への追加をリクエストする。
   1. まず全体の流れが 3 ステップで解説される。なるべくフレンドリーな口調で。
      1. 作成すれば URL がつくられて、すぐに会話を始めることができます。
      2. 会話一覧への掲載は、少々お待ちください。担当者が確認します。
      3. 悪意のある書き込みを防ぐために、投稿を手作業で承認する必要があります。一日の終わりなどにまとめてやるのがおすすめです。仲間と一緒に作業することもできます。
   2. 入力を行う。
   3. 作成ボタンを押すと、会話一覧への掲載リクエストと作成が同時に行われる。
   4. 完了メッセージが表示される。
      1. 会話が作成されました。すぐに開始できます。URL を共有すれば、仲間を呼び込めます。
      2. まずは話題の呼び水として、10 個程度の書き込みをしてみてください。
      3. 会話一覧への掲載は、少々お待ちください。
2. 会話一覧のモデレーターが該当リクエストを承認し、会話一覧へ追加する。

## 引用形式

会話一覧における kind:1111 の内容は以下にする。

- [NIP-18](NIP-18.md)に定義されている q タグを使用する。内容は[NIP-01](NIP-01.md)に定義された置換可能イベントの`30023:f723...:abcd`にする。
- content は以下の URI スキームを使う。

## URI スキーム

URI スキームとして、置換可能オブジェクトには以下の形式が定められている。

`nostr:naddr...`

## naddr 仕様

NostrTools における naddrEncode 実装は以下の通り。

```ts
export type AddressPointer = {
  identifier: string;
  pubkey: string;
  kind: number;
  relays?: string[];
};

export function naddrEncode(addr: AddressPointer): NAddr {
  let kind = new ArrayBuffer(4);
  new DataView(kind).setUint32(0, addr.kind, false);

  let data = encodeTLV({
    0: [utf8Encoder.encode(addr.identifier)],
    1: (addr.relays || []).map((url) => utf8Encoder.encode(url)),
    2: [hexToBytes(addr.pubkey)],
    3: [new Uint8Array(kind)],
  });
  return encodeBech32("naddr", data);
}
```
