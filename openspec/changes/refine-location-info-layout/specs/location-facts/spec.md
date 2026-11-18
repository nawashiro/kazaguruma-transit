# Spec Delta

## REMOVED Requirements

### Requirement: OSM編集リンク

**Reason**: 編集リンクを画面上部から基本情報の最後へ移し、情報を確認した流れで編集できるようにするため。

**Migration**: 「基本情報末尾のOSM編集リンク」を使う。

### Requirement: 基本情報の欠落項目

**Reason**: 編集リンクと営業時間も基本情報の中に置くため、表示条件を電話・ウェブサイト・Wikipediaだけに限定しない。

**Migration**: 「基本情報の表示条件」を使う。

## ADDED Requirements

### Requirement: 基本情報末尾のOSM編集リンク

場所詳細の基本情報の情報行の後、出典の前に、`https://www.openstreetmap.org/edit?{type}={id}`へのリンクを表示する（MUST）。`type`は`node`・`way`・`relation`のいずれかとする（MUST）。可視文言は「編集する（OpenStreetMapを開きます）」とし、新しいタブで開くことを支援技術へ伝える（MUST）。`aria-label`で可視文言を上書きしてはならない（MUST NOT）。

#### Scenario: nodeの編集リンク

- **WHEN** OSM要素が`node/1420770185`である
- **THEN** リンクは`https://www.openstreetmap.org/edit?node=1420770185`になる

#### Scenario: wayの編集リンク

- **WHEN** OSM要素が`way/145408909`である
- **THEN** リンクは`https://www.openstreetmap.org/edit?way=145408909`になる

#### Scenario: 基本情報の最後に表示する

- **WHEN** 場所詳細を表示する
- **THEN** 編集リンクは情報行の後、出典の前に表示され、左寄せになる

#### Scenario: 新しいタブを伝える

- **WHEN** 編集リンクを読み上げる
- **THEN** 可視文言に加えて「新しいタブで開きます」と伝わる

### Requirement: 基本情報の表示条件

場所詳細の基本情報は、電話、ウェブサイト、Wikipedia、営業状態、営業時間、編集リンクのうち、値があるものを表示しなければならない（MUST）。編集リンクだけでも基本情報を表示する（MUST）。どれもない場合は基本情報セクションを表示しない（MUST NOT）。

#### Scenario: 一部の項目だけを表示する

- **WHEN** 電話とウェブサイトがあり、Wikipediaがない
- **THEN** 基本情報は電話とウェブサイトを表示し、Wikipediaを表示しない

#### Scenario: 編集リンクだけでも表示する

- **WHEN** 電話、ウェブサイト、Wikipedia、営業時間がなく、編集リンクがある
- **THEN** 基本情報は編集リンクと出典を表示する

#### Scenario: 営業時間だけでも表示する

- **WHEN** 電話、ウェブサイト、Wikipediaがなく、営業時間がある
- **THEN** 基本情報は営業状態と営業時間の行を表示する

#### Scenario: どれもない

- **WHEN** 電話、ウェブサイト、Wikipedia、営業時間、編集リンクのどれもない
- **THEN** 基本情報セクションを表示しない
