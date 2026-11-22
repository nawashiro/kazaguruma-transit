# wheelchair-accessibility Specification

## Purpose

OSMの`wheelchair`タグを、場所のバリアフリー状態として3段階で示し、利用者がWheelMapまたはOpenStreetMapで情報を確認・更新できる導線を提供する。

## Requirements

### Requirement: wheelchairタグの3状態への写像

ビルドはOSMタグミラーの`wheelchair`を、`yes`は「全面」、`limited`は「一部」、`no`は「非対応」へ写像しなければならない（MUST）。未設定または未知の値は「情報なし」として区別する（MUST）。

#### Scenario: 全面へ写像する

- **WHEN** OSM要素の`wheelchair`が`yes`である
- **THEN** その場所の状態は「全面」になる

#### Scenario: 一部へ写像する

- **WHEN** OSM要素の`wheelchair`が`limited`である
- **THEN** その場所の状態は「一部」になる

#### Scenario: 非対応へ写像する

- **WHEN** OSM要素の`wheelchair`が`no`である
- **THEN** その場所の状態は「非対応」になる

#### Scenario: 未設定を情報なしにする

- **WHEN** OSM要素に`wheelchair`がない
- **THEN** その場所の状態は「情報なし」になる

#### Scenario: 未知の値を情報なしにする

- **WHEN** OSM要素の`wheelchair`が`yes`・`limited`・`no`以外である
- **THEN** その場所の状態は「情報なし」になる

### Requirement: 状態ごとの説明文

ビルドで解決する状態には、OSMの定義に沿った説明文を対応させなければならない（MUST）。「全面」は入口と全部の部屋に段差がないこと、「一部」は入口の段差が7センチ以下でほとんどの部屋に段差がないこと、「非対応」は入口に段差があり部屋は車いすで入れないことを伝える（MUST）。

#### Scenario: 全面の説明を表示する

- **WHEN** 状態が「全面」である
- **THEN** 入口と全部の部屋に段差がないことを表示する

#### Scenario: 一部の説明を表示する

- **WHEN** 状態が「一部」である
- **THEN** 入口に7センチ以下の段差があり、ほとんどの部屋に段差がないことを表示する

#### Scenario: 非対応の説明を表示する

- **WHEN** 状態が「非対応」である
- **THEN** 入口に段差があり、部屋は車いすで入れないことを表示する

### Requirement: 場所詳細のバリアフリー表示

場所詳細の車いす情報は、状態、説明文、WheelMapまたはOpenStreetMapへの更新導線を表示しなければならない（MUST）。状態が「情報なし」のときも、情報を追加できる導線を表示する（MUST）。

#### Scenario: 状態がある場所を表示する

- **WHEN** 場所の状態が「全面」「一部」「非対応」のいずれかである
- **THEN** 車いす情報は状態と説明文と更新リンクを表示する

#### Scenario: 情報がない場所を表示する

- **WHEN** 場所の状態が「情報なし」である
- **THEN** 車いす情報は情報がないことを示すバッジと、追加を促す説明文と更新リンクを表示する

### Requirement: 一覧の状態バッジ

場所一覧は、状態が分かる場所も情報なしの場所も、状態バッジを表示しなければならない（MUST）。バッジは色だけで状態を伝えてはならず、状態を示すテキストを含む（MUST NOT）。情報なしは無彩色のバッジに「情報なし」と表示する（MUST）。

#### Scenario: 状態が分かる場所にバッジを付ける

- **WHEN** 場所の状態が「全面」「一部」「非対応」のいずれかである
- **THEN** 一覧のカードは状態色と状態を示すテキストを持つバッジを表示する

#### Scenario: 情報がない場所にもバッジを付ける

- **WHEN** 場所の状態が「情報なし」である
- **THEN** 一覧のカードは無彩色のバッジに「情報なし」と表示する

#### Scenario: 未設定と未知の値を情報なしとして示す

- **WHEN** OSM要素に`wheelchair`がない、または未知の値である
- **THEN** 一覧のカードは「情報なし」のバッジを表示する

### Requirement: 情報なしの案内文

状態が「情報なし」のときの説明文は「追加してください。」としなければならない（MUST）。「バリアフリー情報がありません。」のような、バッジの「情報なし」と重複する説明を表示してはならない（MUST NOT）。

#### Scenario: 情報なしの説明を表示する

- **WHEN** 場所の状態が「情報なし」である
- **THEN** 説明文は「追加してください。」になり、「バリアフリー情報がありません。」を表示しない

#### Scenario: 更新導線を残す

- **WHEN** 場所の状態が「情報なし」である
- **THEN** 説明文の近くに更新リンクを表示する

### Requirement: 参照リンクの構成

参照リンクはOSM要素の種類で決める（MUST）。nodeは`https://wheelmap.org/nodes/{id}`、wayは`https://wheelmap.org/nodes/-{id}`、relationは`https://www.openstreetmap.org/relation/{id}`とする（MUST）。外部リンクは新しいタブで開き、`rel="noopener noreferrer"`を付ける（MUST）。

#### Scenario: nodeの参照リンク

- **WHEN** OSM要素が`node/1420770185`である
- **THEN** リンクは`https://wheelmap.org/nodes/1420770185`になる

#### Scenario: wayの参照リンク

- **WHEN** OSM要素が`way/145408909`である
- **THEN** リンクは`https://wheelmap.org/nodes/-145408909`になる

#### Scenario: relationの参照リンク

- **WHEN** OSM要素が`relation/5415394`である
- **THEN** リンクは`https://www.openstreetmap.org/relation/5415394`になる

#### Scenario: 外部リンクの属性

- **WHEN** 参照リンクを表示する
- **THEN** リンクは新しいタブで開き、`rel="noopener noreferrer"`を持つ

### Requirement: 参照リンクの文言

参照リンクの可視文言は、状態が分かるとき「編集する（WheelMapを開きます）」、状態が「情報なし」のとき「追加する（WheelMapを開きます）」、relationのとき「編集する（OpenStreetMapを開きます）」とする（MUST）。「詳細を見る」を含めてはならない（MUST NOT）。新しいタブで開くことを、可視文言を変えずに支援技術へ伝える（MUST）。`aria-label`で可視文言を上書きしてはならない（MUST NOT）。

#### Scenario: 状態が分かる場所のリンク文言

- **WHEN** 状態が「全面」「一部」「非対応」のいずれかである
- **THEN** リンクの可視文言は「編集する（WheelMapを開きます）」になる

#### Scenario: 情報がない場所のリンク文言

- **WHEN** 場所の状態が「情報なし」である
- **THEN** リンクの可視文言は「追加する（WheelMapを開きます）」になる

#### Scenario: relationのリンク文言

- **WHEN** OSM要素がrelationである
- **THEN** リンクの可視文言は「編集する（OpenStreetMapを開きます）」になる

#### Scenario: 詳細を見るを含めない

- **WHEN** 参照リンクを表示する
- **THEN** 可視文言に「詳細を見る」を含めない

#### Scenario: 新しいタブを伝える

- **WHEN** 参照リンクを読み上げる
- **THEN** 可視文言に加えて「新しいタブで開きます」と伝わる

### Requirement: 実行時にWheelMapやOSMを取得しない

バリアフリー情報はビルドartifactから読み、実行時にWheelMapまたはOSMへ取得要求をしてはならない（MUST NOT）。参照リンクへの遷移だけを許可する（MUST）。

#### Scenario: artifactだけで表示する

- **WHEN** 場所ページを表示する
- **THEN** バリアフリー情報はartifactの値だけを使う

#### Scenario: 参照先はリンクとしてのみ使う

- **WHEN** 利用者が参照リンクを選ぶ
- **THEN** ブラウザは参照先へ遷移し、ページ側は取得要求をしない

### Requirement: バリアフリー情報の出典表示

車いす情報の参照リンクの後に、OpenStreetMapの出典と、WheelMapまたはOpenStreetMapで最新情報を確認・更新できることを表示しなければならない（MUST）。独立した提供元セクションに依存してはならない（MUST NOT）。

#### Scenario: 出典を表示する

- **WHEN** 車いす情報を表示する
- **THEN** WheelMapまたはOpenStreetMapの参照リンクの後に、OpenStreetMapの出典行が表示される

#### Scenario: 提供元セクションに依存しない

- **WHEN** 場所詳細を表示する
- **THEN** 「提供」の見出しを持つセクションがなくても、車いす情報の直後に出典が表示される
