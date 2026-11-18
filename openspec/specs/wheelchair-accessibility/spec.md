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

場所詳細は、状態、説明文、WheelMapまたはOpenStreetMapへの更新導線を表示しなければならない（MUST）。状態が「情報なし」のときも、情報を追加できる導線を表示する（MUST）。

#### Scenario: 状態がある場所を表示する

- **WHEN** 場所の状態が「全面」「一部」「非対応」のいずれかである
- **THEN** 詳細は状態と説明文と更新リンクを表示する

#### Scenario: 情報がない場所を表示する

- **WHEN** 場所の状態が「情報なし」である
- **THEN** 詳細は情報がないことを表示し、更新リンクを表示する

### Requirement: 一覧のバリアフリーバッジ

場所一覧は、状態が分かっている場所だけバッジを表示する（MUST）。バッジは色だけで状態を伝えてはならず、状態を示すテキストを含む（MUST NOT）。状態が「情報なし」の場所にはバッジを表示しない（MUST NOT）。

#### Scenario: 状態が分かる場所にバッジを付ける

- **WHEN** 場所の状態が「全面」「一部」「非対応」のいずれかである
- **THEN** 一覧のカードは状態を示すテキスト付きのバッジを表示する

#### Scenario: 情報がない場所にバッジを付けない

- **WHEN** 場所の状態が「情報なし」である
- **THEN** 一覧のカードはバッジを表示しない

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

参照リンクの可視文言は、状態が分かるとき「詳細を見る・編集する（WheelMapを開きます）」、状態が「情報なし」のとき「詳細を見る・追加する（WheelMapを開きます）」、relationのとき「詳細を見る・編集する（OpenStreetMapを開きます）」とする（MUST）。新しいタブで開くことを、可視文言を変えずに支援技術へ伝える（MUST）。`aria-label`で可視文言を上書きしてはならない（MUST NOT）。

#### Scenario: 状態が分かる場所のリンク文言

- **WHEN** 状態が「全面」「一部」「非対応」のいずれかである
- **THEN** リンクの可視文言は「詳細を見る・編集する（WheelMapを開きます）」になる

#### Scenario: 情報がない場所のリンク文言

- **WHEN** 場所の状態が「情報なし」である
- **THEN** リンクの可視文言は「詳細を見る・追加する（WheelMapを開きます）」になる

#### Scenario: relationのリンク文言

- **WHEN** OSM要素がrelationである
- **THEN** リンクの可視文言は「詳細を見る・編集する（OpenStreetMapを開きます）」になる

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

場所詳細またはデータ提供元に、バリアフリー情報がOSMの`wheelchair`タグに基づくことと、WheelMapまたはOpenStreetMapで最新情報を確認・更新できることを表示しなければならない（MUST）。

#### Scenario: 出典を表示する

- **WHEN** 場所詳細またはデータ提供元を表示する
- **THEN** OSMが情報源であり、WheelMapまたはOpenStreetMapで更新できることが分かる
