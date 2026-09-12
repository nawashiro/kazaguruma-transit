# UI Page Contract: 認証・場所詳細・レート制限

**Source**: [spec.md](../spec.md)
**Research**: [research.md](../research.md)

この契約は、実装方式ではなく、利用者から観測できるURL、文書構造、状態、主要操作を固定する。

## 1. Route contract

| Page | URL | Purpose | Direct access |
|---|---|---|---|
| Login | `/login` | 既存Passkeyでログインする | yes |
| Signup | `/signup` | 既存Passkeyでアカウントを作成する | yes |
| Location detail | `/location-detail/[id]` | IDで場所の詳細を表示する | yes |
| Rate limit | `/rate-limit` | レート制限を説明し、許可済みの戻り先を示す | yes |

認証ページの戻り先は安全な同一サイト内の相対path/queryだけを受け付ける。レート制限ページの戻り先は`source=home|locations|routes`のallowlistから決め、raw URLを受け付けない。

## 2. Common document contract

各ページは次を満たす。

- ページタイトルを持つ。
- 共通レイアウト内の一つの主`main`ランドマークを使う。
- 主目的を表す主見出しを一つ持つ。
- 通常の移動はnative link、状態変更・送信はbutton/formで表す。
- フォーム操作には表示上およびプログラム上のlabelがある。
- エラー・失敗・loadingなどの状態は日本語で表示し、必要に応じて`role="alert"`または`aria-live="polite"`を使う。
- 主要操作と戻り導線へキーボードだけで到達できる。
- ダイアログ固有のfocus trap、backdrop、Escape、opener focus復帰を要求しない。

## 3. Login / Signup contract

### Login

- URL: `/login`
- 主見出し: ログインを表す日本語
- 既存`login()`を一回だけ呼び出す送信操作
- Passkeyキャンセル・未対応・認証失敗を同じページの日本語エラーとして表示
- `/signup`への通常リンク
- 成功時は検証済みreturn targetへ置換遷移
- action、payload、draftをreturn targetへ渡さない

### Signup

- URL: `/signup`
- 主見出し: アカウント作成を表す日本語
- Passkey name、利用規約同意、プライバシー同意を明示的にlabel付け
- 既存`createAccount(passkeyName)`を一回だけ呼び出す送信操作
- 必須条件未達、Passkeyキャンセル、未対応、作成失敗を同じページの日本語エラーとして表示
- `/login`への通常リンク
- 成功時は検証済みreturn targetへ置換遷移

## 4. Location detail contract

- URL pathの`id`は空でない既存`KeyLocation.id`と対応する。
- loading、success、not-found、error、data-load-errorを区別する。
- successでは場所名を主見出しとし、既存モーダルと同じ意味の説明、地域、画像、提供情報、ライセンス、外部リンク、目的地設定を提供する。
- 目的地設定は既存ホームの目的地query契約へ遷移する。
- not-found/errorでは空の詳細を表示せず、日本語の説明と`/locations`への通常リンクを提供する。
- data-load-errorでは未知IDとは異なる取得失敗の日本語説明と`/locations`への通常リンクを提供し、CDN取得失敗をnot-foundとして表示しない。
- `/locations`の一覧カードは同じ見た目のnative navigation linkとしてこのURLを参照する。

## 5. Rate limit contract

- URL: `/rate-limit`
- 表示は通信なしで完了する。
- 主見出しは「リクエスト制限に達しました」を表す。
- 本文は現行の1時間60回、1時間待つ、ブラウザを閉じても継続する意味を維持する。
- `source=home`は`/`、`source=locations`は`/locations`、`source=routes`は`/`への通常リンクを提供する。
- source未指定・不正値は`/locations`へ戻す。
- ページ表示だけで検索や外部APIを再実行しない。

## 6. Preserved operations

- 既存AuthContextとPasskey処理。
- 認証失敗時の入力値・同意状態の保持。
- 場所詳細の説明、提供情報、ライセンス、外部リンク。
- 「ここへ行く」に相当する既存ホーム目的地設定。
- レート制限の閾値・時間窓・外部APIポリシー。
- Issue #67作業単位1〜3のラベル、`nav`、native radio。
