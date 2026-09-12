# PDF Route Input Contract

## Purpose

ブラウザの経路表示とサーバー側PDF生成が、同じ経路の意味を扱うための入力契約を定義する。レイアウトは共有しない。

## Canonical meaning

- 出発停留所、目的停留所、路線、区間、乗換、出発時刻、到着時刻、徒歩区間、停留所メモを同じ意味で扱う。
- `type=none` は経路なしとして扱い、通常経路の空配列に変換しない。
- 時刻不明は不明状態として表示し、任意の固定時刻を成功値として扱わない。
- 画面とPDFのレイアウト・印刷CSS・画像fallbackはそれぞれの実行環境で管理する。

## Request fields

| Field group | Status | Rule |
|---|---|---|
| originStop / destinationStop / routes / type / transfers | used | 必須の経路意味データ。共有モデルから生成する |
| originLat / originLng / destLat / destLng | used | 徒歩区間・地図表示に利用。欠落時は徒歩表示を省略する |
| selectedDateTime | used | PDFの日付表示に利用 |
| memoData | used | 停留所メモ表示に利用 |
| departures | compatibility/unused | 現在のHTML生成では未使用。互換性確認までは保持し、廃止予定と削除条件を記録する |
| message | compatibility/unused | 現在のHTML生成では未使用。互換性確認までは保持し、廃止予定と削除条件を記録する |

## Failure contract

- 空の経路は利用者向けの経路なしまたは入力不足として扱う。
- APIエラー、ネットワーク失敗、PDF生成失敗は、詳細な内部エラーを露出せず、日本語の再試行可能なエラーを返す。
- クライアントの生成中状態は成功・失敗・例外のいずれでも解除する。
- APIの未使用互換項目は、利用開始または削除の変更を行うまで意味データへ追加しない。
