# Design

## Context

候補一覧は `LocationCandidates` が目的地と出発地の両方で描画する。一覧は `input` の `aria-controls` から辿る形で入力欄の直下に置かれ、`aria-labelledby` の行と `role="status"` の件数行を伴う。項目は `button` で、`min-h-[44px]` と可視フォーカスを持つ。

入力グループは `LocationFieldset`（目的地・出発地）と `DateTimeSelector`、`HomeRouteForm` のインラインfieldsetで、いずれも `bg-base-200` の地色に `fieldset-legend` の見出しを載せる。`fieldset-legend` はdaisyUIが`font-size: .75rem`（12px）を持ち、現状は各所の `text-base` が上書きしている。

候補項目のhoverは `hover:bg-base-200` で、親の地色と同じため変化が見えない。

Tailwind 4のpreflightは`button`の背景を`transparent`にし、カーソルは指定しない。daisyUIの`.btn`は`cursor: pointer`を持つが、候補項目は`btn`を使わない生のボタンである。

## Goals / Non-Goals

**Goals:**

- 候補一覧を、入力欄の直下に並ぶ選択肢として読める見た目にする。
- 見出しに本文との視覚的な階層を持たせる。
- 既存のキーボード操作、フォーカス表示、スキップリンク、文字サイズ16px以上の制約を保つ。

**Non-Goals:**

- 候補一覧の位置やDOM順の変更、候補選択の挙動の変更。
- ページ全体の見出し階層（`h1`〜`h3`）の付け替え。
- 入力グループの枠・地色・余白の再設計。

## Decisions

### 一覧の見出しと件数は、非表示の名前と読み上げだけに残す

一覧のアクセシブルな名前は `目的地の候補` とし、画面には出さない。`aria-labelledby` で見出し行を参照する代わりに、一覧自身へ `aria-label` を付ける。件数は `role="status"` の `sr-only` 段落で通知だけ続ける。

画面の行を消すだけだと、`role="status"` の更新が起きなくなり、候補が出たことが支援技術へ伝わらない。かといって件数行を可視のまま残すと、今回の冗長さは解消しない。名前を編集可能な状態依存の文字列にするより、`label` propをそのまま使って `{label}の候補` を組み立てる方が、描画のたびに文字列が変わらない。

代案として見出し行を `sr-only` にして `aria-labelledby` を維持する形も取れるが、非表示の見出し要素をDOMに残すより、一覧の `aria-label` の方が読み上げ名の出どころが1か所で済む。

### 候補項目のhoverは、入力グループの地色から一段明るい `base-100` にする

入力グループの地色は `base-200` である。候補項目の背景は無指定（transparent）なので、hoverで `base-100` に変えると、ライトテーマでは明るく、ダークテーマでは暗い方向へ一段ずれる。`base-100` と `base-200` の差はdaisyUIのテーマ定義が持つ段差で、両テーマで成立する。`base-300` はページの地色でもあるため、hoverでは使わない。

`hover:bg-base-200` のままでは親と同じ色になり、変化が見えない。半透明の `base-content/5` のような指定は、色監査の低コントラスト規則に触れるため避ける。

ポインターは `cursor-pointer` を明示する。

### 見出しは20px、小見出しは18pxにし、`fieldset-legend`の12pxを上書きしたまま使う

`fieldset-legend`の12pxはdaisyUIの既定で、見出しとしては小さすぎる。各fieldsetの `legend` に `text-xl`（20px）を付け、既存の `text-base` を置き換える。`font-bold` は `fieldset-legend` の `font-weight: 600` と競合しない範囲で揃え、4つのグループで同じ見た目にする。

内側の `h3`（`名前で検索`、`よく利用される施設から選択`）は `text-lg`（18px）にする。`h2` の `運営からのお知らせ` はカード見出しとして現状のまま残し、今回の階層に含めない。

文字サイズの契約は「16px以上」であり、20px・18pxはこれに反しない。見出しの太さは `font-bold` で統一する。

### 補足文は入力欄の説明として残す

`InputField` の `description` は `aria-describedby` に載る。文言だけを差し替え、関連付けの仕組みは変えない。エラーがあるときは `description` と `error` の両方が `aria-describedby` に入るため、併読は既存の挙動で成立する。

## Risks / Trade-offs

- [hover色の変化が小さいテーマがある] → daisyUI標準テーマの `base-100` と `base-200` の段差で決め、独自テーマを足すときは同じ段差を保つ前提とする。
- [件数が画面から消えて、目で見る利用者が候補の総数を知れなくなる] → 候補は常に5件以下で、一覧そのものが件数を示す。入力欄直下の一覧で十分に読み取れる。
- [`aria-label` による一覧の名前は、ルビ表示の有効化で書き換わらないか] → ルビは `ruby-text` クラスの要素を対象にする。`aria-label` は属性であり、置換の対象にならない。
