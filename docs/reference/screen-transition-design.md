# 画面遷移設計

この文書は、現在の`src/app`と`Sidebar`が提供する画面だけを記載します。画面の実装は、各ページと共通レイアウトを正本にします。

## 共通シェル

[`SidebarLayout`](../../src/components/layouts/SidebarLayout.tsx)は全画面を囲みます。大画面ではサイドバーを開き、小画面ではメニューから開閉します。メニューは`drawer`チェックボックスを制御します。

メイン領域は`main#main-content`です。`SkipToContent`はこの領域へ移動します。画面の子要素、条件付きの支援フレーム、フッターの順に配置します。

## Sidebarの入口

[`Sidebar`](../../src/components/layouts/Sidebar.tsx)は`nav[aria-label="サイトナビゲーション"]`を提供します。

| 表示 | 遷移先 |
| --- | --- |
| ホーム | `/` |
| 場所をさがす | `/locations` |
| 意見交換 | `/discussions` |
| はじめての方へ | `/beginners-guide` |
| 使い方 | `/usage` |
| 受賞について | `/award` |
| ライセンス | `/license` |
| 更新情報 | [GitHub Releases](https://github.com/nawashiro/kazaguruma-transit/releases) |
| 設定 | `/settings` |
| 開発者を支援する | Ko-fi設定時だけ表示する外部リンク |

「使う」と「使い方やサイト情報」は展開可能なグループです。支援リンクは`support.koFiUsername`が空でない場合だけ表示します。更新情報の正規入口はGitHub Releasesです。

## 実在するルート

| ルート | 役割 |
| --- | --- |
| `/` | 目的地、出発地、日時を入力する乗換案内 |
| `/routes` | URLクエリを使った経路検索結果 |
| `/locations` | 最初の場所カテゴリへリダイレクトする入口 |
| `/locations/[category-id]` | カテゴリ別の場所一覧。町字順または近い順で表示 |
| `/locations/location-detail/[id]` | 場所の詳細。目的地としてホームへ渡す |
| `/discussions` | 承認済みの会話一覧 |
| `/discussions/create` | 会話作成 |
| `/discussions/[naddr]` | naddrで指定した会話の詳細 |
| `/discussions/[naddr]/approve` | 会話投稿の承認 |
| `/discussions/[naddr]/edit` | 会話作成者向けの基本情報編集 |
| `/discussions/[naddr]/moderators` | 会話のモデレーター申請と役割管理 |
| `/discussions/manage` | 会話一覧への掲載申請の承認 |
| `/discussions/moderator` | モデレーター申請の入口 |
| `/settings` | 自分が作成した会話とアカウント設定 |
| `/beginners-guide` | 初めて利用する人向けの案内 |
| `/usage` | 利用方法 |
| `/award` | 受賞情報 |
| `/license` | ライセンス情報 |
| `/login` | ログイン |
| `/signup` | アカウント作成 |
| `/rate-limit` | 利用制限の案内 |

会話の識別子には`[naddr]`を使います。場所詳細の`/locations/location-detail/[id]`は実在する別のルートです。

## 主な遷移

### 乗換案内

```text
/ → 条件入力 → /routes?origin=...&destination=...&time=...&isDeparture=...&prioritizeSpeed=...
```

ホームは目的地、出発地、日時を順に受け取ります。検索ボタンは`/routes`へ移動します。経路結果は`/api/transit`を読み込み、結果、カレンダー出力、PDF出力、バス停情報を表示します。利用制限に達した場合は`/rate-limit?source=routes`へ移動します。

場所詳細から「ここへ行く」を選ぶと、目的地をクエリに入れてホームへ戻ります。ホームはクエリを読み込み、目的地を選択済みにします。

### 場所検索

```text
/locations → /locations/[category-id] → /locations/location-detail/[id]
```

`/locations`はデータの先頭カテゴリへ移動します。カテゴリ間のリンクは同じカテゴリ一覧内で移動します。位置情報を許可すると、同じカテゴリルートに`origin`を付けて近い順に並べます。詳細画面からカテゴリ一覧または場所一覧へ戻れます。

### 意見交換

```text
/discussions → /discussions/[naddr]
            → /discussions/create
/discussions/[naddr] → /approve
                      → /moderators
                      → /edit（作成者だけ）
```

一覧は承認済みの掲載申請から会話を表示します。会話カードはnaddr付き詳細へ移動します。作成画面はログイン後に会話定義を公開し、完了後に作成したnaddrへ移動できます。

会話詳細のタブは「会話」「すべての投稿」「モデレーター」です。「基本情報」は作成者だけに表示します。承認画面では投稿を承認し、モデレーター画面では役割を更新します。掲載管理画面は一覧会話の承認を扱います。

### 認証と設定

投稿、評価、会話作成、編集、承認などでログインが必要な場合、元の画面を戻り先にして`/login`へ移動します。ログイン画面から認証後に元の操作へ戻ります。`/settings`では自分の会話を確認し、作成画面へ移動できます。

## 更新情報と外部リンク

Sidebarの「更新情報」は次のGitHub Releasesへ移動します。

<https://github.com/nawashiro/kazaguruma-transit/releases>

このURLを更新情報の正本とします。画面一覧に、存在しない更新画面や旧ルートを追加しません。
