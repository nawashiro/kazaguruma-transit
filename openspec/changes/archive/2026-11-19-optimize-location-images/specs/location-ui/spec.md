# Spec Delta

## ADDED Requirements

### Requirement: 場所写真のレスポンシブ表示

場所一覧と場所詳細の写真は、ビルドで生成した派生画像を `srcset` と `sizes` で選んで表示しなければならない（MUST）。一覧カードは遅延読み込み、詳細の先頭写真は即時読み込みにし（MUST）、読み込み前に表示領域を確保するため `width` と `height` を持つ（MUST）。写真は装飾として `alt=""` を持つ（MUST）。帰属の表示は従来どおりとする（MUST）。

#### Scenario: 一覧カードで幅を選ぶ

- **WHEN** 一覧カードに写真を表示する
- **THEN** `srcset` には生成済みの派生画像が幅の小さい順に入り、`loading` は `lazy` である

#### Scenario: 詳細の先頭写真を優先して読み込む

- **WHEN** 場所詳細の先頭写真を表示する
- **THEN** `srcset` は1280pxまでを含み、`loading` は `eager`、`fetchpriority` は `high` である

#### Scenario: 読み込み前に領域を確保する

- **WHEN** 写真を読み込む
- **THEN** `width` と `height` があり、読み込みでレイアウトが動かない

#### Scenario: 写真を装飾として扱う

- **WHEN** 写真を表示する
- **THEN** `alt` は空である
