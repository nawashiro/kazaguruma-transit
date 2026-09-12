# Issue #121 受賞データ抽象化削減 仕様

- Issue: [#121](https://github.com/nawashiro/kazaguruma-transit/issues/121)
- 基準ブランチ: `dev`
- 基準SHA: `74d26f189f5db683a2cefae5d5fdc576c3a9638f`
- 実装ブランチ: `fix/issue-121-award-data-kiss`
- 調査: [`investigation.md`](./investigation.md)
- 作業言語: 日本語

## 1. ユーザーストーリー

静的な受賞紹介ページの保守者として、ページ1枚だけで使う受賞データ専用moduleをなくし、文書の内容をページ自身で読めるようにしたい。これにより、再利用されないロジック風の抽象化を減らし、表示内容の変更箇所を一つにする。

## 2. 機能要件

- **FR-01**: `/award`は現在と同じ受賞名、賞名、選出区分、授与日、発行者、説明、バッジ画像、作品紹介リンク、バッジ確認リンクを表示する。
- **FR-02**: `src/app/award/page.tsx`は`@/lib/award/award-data`をimportしない。
- **FR-03**: `src/lib/award/award-data.ts`は削除する。
- **FR-04**: FR-01の静的な値は`src/app/award/page.tsx`の文書markupへ直接記述し、別の共有データobject・utility・fallbackを追加しない。
- **FR-05**: 共通`PageHeader`は維持し、`PageHeader`が出力するh1・説明・レイアウトを変更しない。
- **FR-06**: `src/app/award/layout.tsx`のmetadata、外部リンクの`target`/`rel`、画像の`alt`、既存の見出し・class構造を維持する。
- **FR-07**: 新規永続化、API、fetch、Nostr、GTFS、Prisma/SQLite、設定変更を行わない。

## 3. 非機能要件

- TypeScript strictを維持する。
- 既存のsemantic HTML、画像代替テキスト、外部リンクの安全属性、レスポンシブclass、Ruby表示境界を維持する。
- 既存の共有`PageHeader`へ回帰しない。
- テストは実際の表示契約とmodule削除契約を検証し、存在しない旧テストパスに依存しない。

## 4. 非対象

- `PageHeader`共通componentの削除・API変更・全ページ再設計
- 受賞ページの文章・受賞内容の編集
- ホームの運営告知（Issue #122で対応済み）の変更
- `award/layout.tsx`、Sidebar、sitemap、app-config、package/lockfileの変更
- 受賞データを別の共有schema・JSON・CMS・DBへ移行すること
- 画像、URL、metadata、CSSの改善を同時に行うこと

## 5. 受入条件

- **AC-01**: `src/app/award/page.tsx`のmodule sourceに`@/lib/award/award-data`のimportがない。
- **AC-02**: `src/lib/award/award-data.ts`が存在しない。
- **AC-03**: 受賞ページの既存テストが通り、受賞内容・リンク・画像alt・見出し・スタイルが維持される。
- **AC-04**: `/award`は共通`PageHeader`を引き続き使用し、h1「受賞について」と説明文を表示する。
- **AC-05**: 変更pathが許可manifest内に限定され、共通`PageHeader`、metadata、ホーム告知、設定、依存関係に差分がない。
- **AC-06**: 新しい構造回帰テストが旧実装で意味のあるREDとなり、実装後にGREENになる。
- **AC-07**: strict TypeScript、lint、全Jest、production build、`git diff --check`が終了コード0になる。

## 6. 受入テストの対応

| 条件 | テスト・確認 |
|---|---|
| AC-01〜02 | `page.test.tsx`のsource contract、ファイル存在確認、source search |
| AC-03 | 既存`AwardPage`のRTLテスト、focused/full Jest |
| AC-04 | 既存h1 assertionとPageHeaderを変更しないdiff確認 |
| AC-05 | `git diff --name-status`、禁止pathのdiff確認 |
| AC-06 | production変更前のRED、production変更後のGREEN、旧実装への感度確認 |
| AC-07 | strict TypeScript、lint、全Jest、build、diff check |

## 7. 変更後も保持する表示値

次の値は既存表示から変更しない。

- 受賞名: `都知事杯オープンデータ・ハッカソン2025`
- 賞名: `行政課題解決賞`
- 選出区分: `サービス開発部門 ファイナリスト`
- 授与日: `2025年10月25日`
- 発行者: `東京都デジタルサービス局（都知事杯オープンデータ・ハッカソン運営事務局）`
- 作品紹介URL: `https://odhackathon.metro.tokyo.lg.jp/collection/54/?year=2025`
- バッジ確認URL: `https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/RWRseGxrR0NmM0Q5QnAwdTdjeHFHdz09`
- バッジ画像URL: `https://nlp.netlearning.co.jp/api/v1.0/openbadge/v2/Assertion/RWRseGxrR0NmM0Q5QnAwdTdjeHFHdz09/image`
