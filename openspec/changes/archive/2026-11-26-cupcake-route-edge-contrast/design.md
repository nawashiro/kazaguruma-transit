# Design

## Context

動機は proposal.md - Why を参照。経路図は`src/components/features/IntegratedRouteDisplay.tsx`でdaisyUIの`timeline`を組み、区間の線を`<hr>`で描いている。乗車区間は`SecondaryEdge`（`bg-secondary`）、徒歩区間は`AccentEdge`（`bg-accent`）。各`<hr>`は`timeline`の区切り線として使うため、背景はページの`base-300`である。

路線名の文字は既に`text-secondary-content dark:text-secondary`という、テーマごとに違う色をクラスで切り替える書き方をしている（`RouteName`）。`dark`バリアントは`globals.css`の`@custom-variant dark`で`[data-theme=dark]`に対応している。

テーマの色はdaisyUI 5.0.50のトークンで、cupcakeは`secondary`が`oklch(89% 0.061 343.231)`、`secondary-content`が`oklch(45% 0.187 3.815)`、darkは`secondary`が`oklch(65% 0.241 354.308)`である。`globals.css`のブランドトークン上書きは`.transit-button`と`.my-toggle`の内側だけで、経路図の線は対象外である。

Chromiumが算出値を`lab()`で返すため、トークンの値をいったん画素へ変換してから測った。地色は`body`の`base-300`である。

| 線 | cupcake 地色とのコントラスト | dark 地色とのコントラスト |
|---|---|---|
| `secondary`（現行の乗車区間） | 1.11:1 | 4.81:1 |
| `secondary-content` | 6.29:1 | 14.61:1 |
| `accent`（徒歩区間、変更しない） | 1.06:1 | 9.28:1 |

## Goals / Non-Goals

**Goals:**

- cupcakeで乗車区間の線を、地色から区別できる濃さで描く。
- darkの描画を変えない。

**Non-Goals:**

- 徒歩区間の線（cupcakeで1.06:1）を濃くしない。依頼の範囲を乗車区間だけに決めた。
- 停留所の丸（`bg-secondary` / `bg-accent`）と路線名の文字を変えない。
- テーマのトークン自体や`globals.css`のブランド上書きを変えない。
- 印刷用PDFの地図を変えない。PDFの地図は別の描画経路である。

## Decisions

### 1. `dark:`バリアントでクラスを切り替える

`SecondaryEdge`を`bg-secondary-content dark:bg-secondary`にする。テーマ別のCSSを足さずに済み、`RouteName`と同じ書き方にそろう。追加のクラス名や`globals.css`の規則が不要で、テストも既存のクラス契約の延長で確認できる。

代替案として、`globals.css`へ`[data-theme=cupcake] .route-ride-edge { --color-secondary: ... }`のような規則を足す方法がある。トークンを差し替えるぶん他の要素へ波及しやすく、要素に新しいクラス名を付ける必要もあるため採らない。

もう1つの代替案は経路図専用のCSS変数を定義する方法だが、テーマが2つしかなく、既存のテーマ別クラスの書き方で足りるため採らない。

### 2. テストはクラス契約で保つ

`IntegratedRouteDisplay.test.tsx`のエッジ色の期待値を、`bg-secondary-content dark:bg-secondary`を含む形へ更新する。算出色そのものはdaisyUIのトークンで決まるため、コンポーネントテストはテーマごとのクラスの選択を確かめる。実際の見え方はブラウザで確認し、結果を作業記録に残す。

## Risks / Trade-offs

- [daisyUIの更新で`secondary-content`の値が変わり、線が再び見えなくなる] → テーマのトークンはdaisyUI側の管理で、このプロジェクトでは固定しない。見え方はブラウザでの確認項目として残し、更新時に測り直す。
- [darkの`secondary`は地色とのコントラストが4.81:1で、cupcakeの`secondary-content`（6.29:1）ほど濃くない] → 非文字の識別に必要な3:1は満たし、darkの見た目を変えない依頼を守るため、darkは`secondary`のまま据え置く。
- [乗車区間の線が濃い赤系になるため、淡い停留所の丸との見た目のまとまりが変わる] → 丸と路線名は変えず、線の識別性を優先する。見た目の不均衡が目立つ場合は、丸の色を別の変更で扱う。
