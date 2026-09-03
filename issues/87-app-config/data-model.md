# Issue #87 公開アプリ設定データモデル

## 1. AppConfig

`app-config.json`の公開設定を`src/lib/config/app-config.ts`が検証して返す。JSONはclient bundleに
含まれ得るため、秘密情報をこの型に追加しない。

| フィールド | 型 | 制約 | 利用先 |
|---|---|---|---|
| `appUrl` | `string` | 空文字または絶対URL | metadata、sitemap、PDF fallback、map fallback |
| `gaMeasurementId` | `string` | 空文字またはGA4 measurement ID | `useGA` |
| `locationsDataVersion` | `string` | 空でないversion文字列 | `addressLoader` |
| `discussion.enabled` | `boolean` | 必須 | discussion機能の有効化 |
| `discussion.adminPubkey` | `string` | npubまたはhex、未設定可 | Nostr管理者公開鍵 |
| `discussion.busStopDiscussionId` | `string` | naddrまたはID部分、未設定可 | バス停会話座標 |
| `discussion.discussionListNaddr` | `string` | naddr、未設定可 | 会話一覧 |
| `discussion.nostrRelays` | `string[]` | relay URL配列 | Nostr read/write設定 |
| `discussion.nostrTimeoutMs` | `number` | 有限数 | Nostr既定timeout |
| `discussion.readStrategy.idleTimeoutMs` | `number` | 整数、loaderで既存範囲へclamp | initial read idle timeout |
| `discussion.readStrategy.hardTimeoutMs` | `number` | 整数、idleより大きい値 | initial read hard timeout |
| `discussion.readStrategy.dedupWindowMs` | `number` | 整数、loaderで既存範囲へclamp | duplicate read window |
| `support.enabled` | `boolean` | 必須 | 支援欄の表示可否 |
| `support.koFiUsername` | `string` | 空文字可 | Ko-fi page/widget URL |
| `support.heading` | `string` | trim後空でない | 支援欄見出し |
| `support.message` | `string` | trim後空でない | 支援欄説明文 |

## 2. 実行時の写像

### DiscussionConfig

```text
appConfig.discussion.enabled          -> DiscussionConfig.enabled
appConfig.discussion.adminPubkey      -> getAdminPubkeyHex() -> adminPubkey
appConfig.discussion.busStopDiscussionId -> resolveDiscussionId()
appConfig.discussion.nostrRelays      -> { url, read: true, write: true }[]
appConfig.discussion.nostrTimeoutMs   -> defaultTimeout
appConfig.discussion.readStrategy      -> DiscussionReadStrategyConfig
appConfig.discussion.discussionListNaddr -> getDiscussionListConfig().naddr
```

既存のnaddr正規化、hex/nPub変換、relay set、completion、retry、provider stateはこの写像の後段で
引き続き動作する。`NEXT_PUBLIC_*`は入力にならない。

### SupportConfig

```text
appConfig.support.enabled && appConfig.support.koFiUsername != ""
  -> loadKoFiUsername(): string
else
  -> loadKoFiUsername(): null

appConfig.support.heading/message -> loadKoFiContent(): KoFiContent
```

`Sidebar`と`KoFiSupport`は既存のloader exportを通じて値を受け取り、`FUNDING.yml`や別のcontent
fileを直接読む責務を持たない。

## 3. 公開/非公開境界

### AppConfigへ含める

- 利用者へ公開されるアプリURL、GA測定ID、CDN version、Nostr公開識別子・relay、表示設定
- 運営者がアプリ配布先ごとに変更するsupport表示

### AppConfigへ含めない

- `transit-config.json`のGTFS URL、SQLite path、import設定
- `GOOGLE_MAPS_API_KEY`
- `PUPPETEER_EXECUTABLE_PATH`
- `CLOUDFLARE_TUNNEL_TOKEN`
- セッション、認証秘密鍵、relay write credential

`transit-config.json`は既存の`.dockerignore`とDocker secret mountでbuild/runtimeへ渡す。公開JSONを
importするclient moduleからserver-only設定へ到達できない構造を保つ。

## 4. 設定状態

- **valid:** 必須オブジェクトと型が揃い、`appConfig`を利用できる。
- **invalid:** 必須値の欠落、型不正、support文言の空値を`app-config.ts`の日本語Errorで拒否する。
- **disabled discussion:** `discussion.enabled=false`またはlist naddr未設定なら既存の無効/未設定UIを使う。
- **disabled support:** `support.enabled=false`またはKo-fi usernameが空ならSidebarと本文の支援欄を描画しない。

新旧設定を同時に読む状態は定義しない。旧`NEXT_PUBLIC_*`環境変数が存在しても無視する。
