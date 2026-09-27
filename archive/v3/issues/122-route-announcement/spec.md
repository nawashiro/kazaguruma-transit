# Issue #122 ルートページのお知らせ仕様

- Issue: [#122 add: ルートページの受賞のお知らせを消して、お知らせにする](https://github.com/nawashiro/kazaguruma-transit/issues/122)
- Repository: `nawashiro/kazaguruma-transit`
- 基準ブランチ: `dev`
- 基準SHA: `380ef8ad956b289d5033e286b19fdfd110ff68fd`
- 関連調査: `investigation.md`
- 作業言語: 日本語

## 背景

ルートページは、`src/components/features/AwardRecognition.tsx`を直接表示し、受賞名・賞名・バッジ画像・受賞ページへのリンクを固定している。現在の`app-config.json`には、この表示を運営が変更する設定項目がない。

Issue #87で確立された`app-config.json`の公開設定境界へ、お知らせの文言とリンク先を追加し、ルートページには汎用の運営告知カードを表示する。

## ユーザーストーリー

### US1: 運営者がビルド前にお知らせを変更する

運営者として、配布先ごとの`app-config.json`でお知らせ文言とURLを変更したい。そうすれば、ソースコードを編集せずに、ビルド時に静的な告知を差し替えられる。

### US2: 利用者がルートページで告知を読む

利用者として、ルートページで「運営からのお知らせ」という見出しと告知文言を確認したい。告知文言自体がリンクになっていれば、詳細情報へ移動できる。

### US3: 受賞詳細ページを引き続き利用する

利用者として、サイドバーまたは既存導線から受賞についての詳細ページを開きたい。ルートページのカードを汎用化しても、`/award`ページと受賞データは壊してはならない。

## 機能要件

- **FR-001:** `app-config.json.example`に`announcement`オブジェクトを追加する。
- **FR-002:** `announcement`は`information`と`url`だけを持つ公開設定として文書化し、両方を非空文字列として検証する。
- **FR-003:** `src/lib/config/app-config.ts`は`announcement`を`AppConfig`の型と実行時検証へ含める。必須項目が欠けた場合は既存の日本語設定エラーを返す。
- **FR-004:** ルートページは受賞専用の`AwardRecognition`ではなく、お知らせ用componentを既存カード位置へ表示する。
- **FR-005:** お知らせ用componentは、既存カードと同じDaisyUIカード構造の中に、Lucideの`Info`アイコン付き`h2`「運営からのお知らせ」を1つ表示する。
- **FR-006:** `announcement.information`は追加の説明段落ではなく、`a`要素の表示テキストとして描画し、`announcement.url`をその`href`に設定する。
- **FR-007:** アイコンは装飾扱いとして`aria-hidden="true"`を持ち、見出しテキストの読み上げを妨げない。ユーザー向けテキストには既存の`ruby-text`処理を適用する。
- **FR-008:** お知らせ表示は静的な設定読み取りだけで成立し、fetch、Nostr、Prisma、SQLite、sessionStorageなどの動的取得・新規永続化を追加しない。
- **FR-009:** `AwardRecognition.tsx`と、ルートページ専用で不要になったそのテストは削除する。受賞ページ、`award-data`、受賞ページ用画像設定は維持する。
- **FR-010:** `infomation`という誤綴りの別キーや旧表示へのfallbackは追加しない。正式な実装キーは`information`とする。

## 公開設定契約

`app-config.json.example`の該当部分は次の形とする。初期値は既存ルートカードが伝えていた受賞告知と`/award`への導線を静的なお知らせとして移す。

```json
"announcement": {
  "information": "都知事杯オープンデータ・ハッカソン2025で行政課題解決賞を受賞しました",
  "url": "/award"
}
```

`announcement`内に運用状態、公開日時、画像、HTML、表示条件、複数件配列は追加しない。URLは同一サイトの相対URLと外部URLのどちらも設定できる単純な文字列として扱い、今回のparserではURL形式を過剰に制限しない。

## 非機能・アクセシビリティ要件

- TypeScript strictを維持し、`unknown`からの実行時検証を行う。
- component、service/config、pageの責務を混在させない。
- `Info`は`lucide-react`からimportし、手書きSVG、Heroicons、`react-icons`は使用しない。
- sectionと`h2`を`aria-labelledby`で関連付ける。
- 見出しレベル、リンク名、既存カードの視覚クラス、レスポンシブ幅を維持する。
- UI変更に該当するため、計画・タスク・実装後記録にアクセシビリティ確認を含める。
- 新規永続化、API、DB migration、外部サービスへの送信は行わない。

## 受入条件

| ID | 受入条件 | 検証 |
|---|---|---|
| AC-01 | exampleに`announcement.information`と`announcement.url`があり、設定parserが有効な形を返す | `app-config.test.ts`、JSON確認 |
| AC-02 | `announcement`または2つの必須文字列を欠く設定を日本語エラーで拒否する | `app-config.test.ts` |
| AC-03 | お知らせカードが`h2`「運営からのお知らせ」と装飾用Lucide Infoを表示する | `Announcement.test.tsx` |
| AC-04 | お知らせ文言が`a`要素として表示され、設定URLが`href`になる | `Announcement.test.tsx` |
| AC-05 | ルートページでお知らせカードが表示され、旧受賞バッジ・旧詳細リンクは表示されない | `page.test.tsx` |
| AC-06 | `/award`ページ、受賞詳細データ、既存の検索入力・注意書きは維持される | 既存award/pageテスト、focused Homeテスト、差分確認 |
| AC-07 | production sourceに`AwardRecognition`参照が残らず、誤綴り`infomation`のfallbackもない | source検索、diff確認 |
| AC-08 | TypeScript、lint、focused Jest、全Jest、build、`git diff --check`が成功する | 最終品質ゲート |

## 非対象

- `/award`の受賞詳細ページ、受賞データ、サイドバーの受賞リンクの削除・再設計
- お知らせの管理画面、複数件表示、公開期間、既読状態、動的API
- `app-config.json`以外の設定移行、環境変数、Docker、GTFS、Nostr、認証、Prisma、SQLite
- `Card`共通componentのAPI変更。アイコン付き見出しに必要なカード構造はお知らせcomponent内で表現する。
- DaisyUI共通CSS、Rubyful外部script、全画面のルビ境界変更
- Issue #122と無関係な文言・レイアウト・コード整理

## 仕様決定

Issue本文の`infomation`は既存コードにない自然言語上の誤綴りであり、設定キーとしての正式指定ではない。憲章のClear Namingに従い、標準綴りの`information`を採用する。実装で誤綴りを受け付ける互換層を作らないことで、設定契約を2種類に増やさず、Issue本文の「文言とURLだけ」という範囲も保つ。
