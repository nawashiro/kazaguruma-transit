# Data Model: 認証・場所詳細・レート制限の専用ページ化

**Source**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)

本featureは新規永続データを追加しない。以下は専用ページが扱う公開状態と検証境界を表す論理モデルであり、既存AuthContext、CDN場所データ、既存API状態を再利用する。

## 1. Authentication Page

認証ページが表示する固定モードの状態。

| Field | Type | Required | Rules |
|---|---|---:|---|
| `mode` | `login \| signup` | yes | `/login`は`login`、`/signup`は`signup`に固定する。ページ内タブで変更しない。 |
| `passkeyName` | string | signup only | trim後に空でないこと、既存の最大長制約を維持する。 |
| `termsAccepted` | boolean | signup only | 既存の利用規約同意を維持する。 |
| `privacyAccepted` | boolean | signup only | 既存のプライバシー同意を維持する。 |
| `isSubmitting` | boolean | yes | 認証処理中は重複送信を受け付けない。 |
| `attemptError` | string or null | yes | 現在の試行に属する日本語エラー。ページ遷移で無関係な古いエラーを引き継がない。 |

### State transitions

```text
idle → submitting → success → safe return target
                 ↘ failure → same page, input/consent state retained
                 ↘ cancelled → same page, input/consent state retained
```

## 2. Safe Return Target

認証成功・キャンセル後の同一サイト内遷移先。

| Field | Type | Required | Rules |
|---|---|---:|---|
| `path` | string | yes | 単一`/`で始まる相対path。外部origin、`//`、credentials、認証ページ、API、静的資産を拒否する。 |
| `query` | string | no | 現在画面を復元するためのqueryだけを保持する。`/routes`の検索条件を含められる。 |
| `action` | absent | yes | 投稿、評価、会話作成等のaction・payload・draft・再実行フラグは持たない。 |

無指定・不正値は`/`へ遷移する。値は安全性検証後にrouterの置換遷移へ渡す。

## 3. Location Detail Page

`KeyLocation.id`から解決される場所詳細の表示状態。

### Upstream location-data load result

場所IDの不在とCDN等のtransport failureを区別するため、詳細resolverへは空配列だけを渡さない。

| Result | Meaning | Resolver behavior |
|---|---|---|
| `{ status: "success", categories }` | データ取得が完了した | IDを検索し、未知IDは`not-found`、重複・不正IDは`error`とする。 |
| `{ status: "error", error }` | CDN fetch、HTTP、JSON decode等に失敗した | `data-load-error`として原因を説明し、未知IDの文言へ置換しない。 |

この結果境界は既存`src/utils/addressLoader.ts`に追加する`loadKeyLocationsDataResult()`とし、既存の一覧loader利用者への移行は別途影響を確認する。fixtureではHTTP failure、JSON failure、空データ、重複IDを個別に作る。

| State | Meaning | Required UI |
|---|---|---|
| `loading` | 場所データを取得中 | 共通`main`内の主見出し、読み込み状態、操作不能な中間表示 |
| `success` | IDに対応する場所が一意に解決済み | name、description、area、image、source、licence、external link、destination action |
| `not-found` | データ取得は完了したがIDが存在しない | 日本語の原因説明、`/locations`への通常リンク、空の詳細は表示しない |
| `error` | 重複・不正ID、または地域名等の詳細処理に失敗 | `not-found`と異なる日本語の原因説明、取得できた主要情報の保持、`/locations`への通常リンク |
| `data-load-error` | CDN fetch、HTTP、JSON decode等の場所データ取得に失敗 | `not-found`と異なるデータ取得失敗の日本語説明、空の詳細を表示せず、`/locations`への通常リンク |

### Location identity rules

- `id`は空でない文字列として扱う。
- データセット全体で一意でなければならない。
- 重複IDは先頭要素へ黙って解決せず、`error`として扱う。
- transport failureは空配列による`not-found`へ変換せず、`data-load-error`として扱う。
- URLへ出す値とロード後のIDを同じ正規識別子として比較する。
- 説明、画像、地域名の欠落・失敗は、場所名と戻り導線を失わせない。

## 4. Rate Limit Page

レート制限状態を説明する通信なしのページ。

| Field | Type | Required | Rules |
|---|---|---:|---|
| `source` | `home \| locations \| routes` | no | allowlist外は無効。raw return URLを受け付けない。 |
| `message` | fixed/derived string | yes | 現行の制限理由・1時間60回・再試行目安の意味を維持する。 |
| `returnPath` | derived | yes | `home → /`、`locations → /locations`、`routes → /`、無効/未指定 → `/locations`。 |

### Rate-limit rules

- ページ表示、直接アクセス、再読み込みでは検索・fetch・外部API要求を実行しない。
- 429判定は各既存API・データ境界に残し、明示的なrate-limited状態から一度だけページへ遷移する。
- `/routes`は有効queryがあるとmount時にAPI要求するため、rate-limitページから直接戻す導線にはしない。
- 閾値、時間窓、外部APIポリシーは変更しない。

## 5. Persistence and ownership

- 新規DB、Nostrイベント、sessionStorage、localStorageの永続フィールドは追加しない。
- AuthProviderが保持する既存の認証状態をページ間で共有する。
- 場所の正本は既存CDNデータ、レート制限の正本は既存API境界とする。
- `Safe Return Target`と`Rate Limit Page.source`は表示遷移の入力であり、投稿・評価等の副作用状態を保存しない。
