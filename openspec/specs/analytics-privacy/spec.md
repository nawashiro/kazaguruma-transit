# analytics-privacy Specification

## Purpose

検索や共有に必要な座標付きURLを維持しながら、Google Analyticsへ送るURLにはクエリとフラグメントを含めず、位置情報の外部送信を抑える。

## Requirements

### Requirement: GAへ送信するURLの制限

GAへ送信するURLは、クエリとフラグメントを含まない形式でなければならない（MUST）。`page_path` はパスのみ、`page_location` はオリジンとパスのみとし、`page_referrer` にも同じ除去を適用する。自動計測にもこの制限を適用する。

#### Scenario: 座標付きURLの初期表示と画面遷移

- **WHEN** 座標を含むクエリ付きURLを直接開く、またはアプリ内で遷移する
- **THEN** ページビューを一度送信し、GAへ送るURLの各項目にクエリとフラグメントを含めない

#### Scenario: 自動計測による別経路の送信

- **WHEN** 履歴変更や外部リンクのクリックが発生する
- **THEN** 自動計測がクエリまたはフラグメント付きURLをGAへ送信しない

### Requirement: 座標付きURLによる検索と共有の維持

検索・共有・ブックマークに使うブラウザーのURLと検索APIの座標パラメーターは、従来どおり利用できなければならない（MUST）。

#### Scenario: 共有URLからの検索

- **WHEN** 座標付きの共有URLまたはブックマークを開く
- **THEN** 出発地・目的地を復元し、その座標で検索できる
