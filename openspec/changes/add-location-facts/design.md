# Design

## Context

`add-location-accessibility`の後、場所詳細は`public/generated/location-data.json`の`sources.locations`を読み、見出し、地域、画像と帰属、バリアフリー情報と関連リンク、提供、経路へのリンクを表示する。各場所は`osmElement`（`node`・`way`・`relation`と数値ID）を持つ。

OSMタグミラーには`phone` 26件、`contact:phone` 2件、`website` 46件、`contact:website` 6件、`wikipedia` 45件、`wikidata` 56件がある。電話番号は`+81-3-32642111`、`+81 3 3264 8537`、`0335811651`、`81358253407`のように表記が揺れている。

公開Wikidataミラーは`https://nawashiro.github.io/chiyoda_city_main_facilities/mirrors/wikidata.json`にあり、`{entities, retrievedAt, sourceId}`を持つ。`entities`は56实体で、うち48件が`jawiki`、19件が`enwiki`のsitelinkを持つ。`app-config.json`にはWikidataミラーの取得先がない。

## Goals / Non-Goals

**Goals:**

- 電話、ウェブサイト、Wikipedia、OSM編集先をビルド時に解決し、場所詳細に表示する。
- 実行時に外部取得をしない。
- 一覧ページの情報量を増やさない。

**Non-Goals:**

- 営業時間（別change）。
- 一覧カードへの電話・ウェブサイト表示。
- 電話番号の国際対応や、03以外の市外局番。
- Wikidataのクレーム（住所、座標、営業時間など）の表示。
- 電話・ウェブサイトの到達性確認。

## Decisions

### artifactへ事実項目を追加する

`sources.locations`の各場所へ次を足す。

```ts
type LocationFacts = {
  phone?: { display: string; tel: string };
  websiteUri?: string;
  wikipediaUri?: string;
  osmEditUrl: string;
};
```

`osmEditUrl`は全場所が持つ。電話、ウェブサイト、Wikipediaは値がある場合だけ持つ。一覧ページはこれらを読まない。

### 電話番号は03に限定して正規化する

数字以外を外し、先頭の`81`を落とし、`3`で始まる9桁には`0`を足す。`03`で始まる10桁または9桁だけを受け付け、`03-NNNN-NNNN`（10桁）または`03-XXX-XXXX`（9桁）に整形する。実データ28件すべてがこの規則で正規化できた。正規化できない値は項目を出さず、ビルド時に警告する。電話は付加情報であり、1件の不正でビルド全体を止めない。

`libphonenumber-js`を入れる案は、千代田区の固定電話しか扱わない現状に対して重すぎる。国際化が必要になった時点で置き換える。表示は`tel:`リンクにし、番号は可視テキストでも読めるようにする。

電話番号は施設の代表番号とは限らず、運営者や広報の番号である場合がある。値はOSMの提供どおりに出し、推測や整形以上の補正をしない。

### ウェブサイトはOSMのタグだけを使う

`website`を`contact:website`より優先し、絶対http(s) URIだけを採用する。どちらもない、または不正な場合は項目を出さない。リンク文言は「ウェブサイトを開く」とし、`ExternalLink`アイコンと`sr-only`の「（新しいタブで開きます）」を添える。

### Wikipediaは日本語を優先して4段階で解決する

1. OSMの`wikipedia`タグの`ja:`
2. Wikidataミラーの`jawiki`
3. OSMの`wikipedia`タグの他言語
4. Wikidataミラーの`enwiki`

`wikipedia`タグは`lang:Title`形式だけを受け付け、言語接頭辞がない値は無視する。タイトルの空白は`_`へ置換し、`encodeURIComponent`でURLを作る。どの段階でも見つからなければリンクを出さない。

OSMタグだけを使う案は45件、Wikidataミラーだけを使う案は48件で、両方使うと取りこぼしが減る。Wikidataは`jawiki`を優先し、なければ`enwiki`にする。他言語は表示しない。

`app-config.json`へ`wikidataMirrorUri`を追加し、ビルドは他の取得元と同じ`Promise.all`で取得する。`entities`がオブジェクトでない、entityの`id`が文字列でない、`sitelinks`の値が`title`を持たない場合はビルドを失敗させる。取得失敗を「Wikipediaなし」として黙って通さない。

### OSM編集リンクは詳細ページの上部に置く

`https://www.openstreetmap.org/edit?{type}={id}`を、`osmElement`から作る。`type`は`node`・`way`・`relation`のいずれか。iDエディタが開き、編集にはOSMアカウントが必要になる。

置き場所は`PageHeader`の直後、画像より上とする。デスクトップでは右寄せ、モバイルでは幅いっぱいの`btn btn-outline min-h-[44px]`にし、`Pencil`アイコンと「編集する（OpenStreetMapを開きます）」を出す。Wikipediaの記事上部の編集リンクと同じく、探さずに見つかる位置にする。下部の「提供」に混ぜると、誤りを直したい人が気付けない。

### 基本情報は欠けている項目だけ隠す

詳細ページに「基本情報」セクションを置き、`dl`で電話、ウェブサイト、Wikipediaを並べる。値がある項目だけを出し、すべてなければセクションごと出さない。文字は`text-base`、`ruby-text`を付け、リンクは44px以上にする。

営業時間は別changeで、このセクションの上（バリアフリー情報の下）に入る。したがって基本情報はバリアフリー情報と関連リンクの後ろ、提供の前に置く。

一覧カードには出さない。102件のカードに電話とウェブサイトを足すと、名前とバリアフリー状態の走査が鈍る。

### ライセンスと出典

WikidataはCC0、Wikipediaはリンクのみで本文を複製しない。OSMの電話・ウェブサイトはODbL 1.0の対象で、既存のOpenStreetMap表示で足りる。データ提供元カードに、連絡先がOSMのタグ由来であることと、修正はOSMで行うことを足す。

## Risks / Trade-offs

- [電話番号が施設の代表番号でない] → OSMの値をそのまま出し、推測で補正しない。誤りはOSMの編集リンクから直せる。
- [電話番号の形式が03以外、または桁数が違う] → 項目を出さず、ビルド時に警告する。国際対応は別change。
- [Wikidataミラーが1.96MBでビルドを遅くする] → ビルド時だけ取得し、artifactにはURLだけを残す。取得失敗はビルド失敗とし、古いリンクを残さない。
- [Wikipediaのタイトルに括弧や空白がある] → `_`置換とURLエンコードで扱う。リダイレクトはWikipedia側に任せる。
- [OSM編集にはアカウントが必要] → リンク文言とデータ提供元でOSMの編集であることを示す。ログインを代行しない。
- [上部の編集リンクがモバイルで見出しを圧迫する] → 見出しの下に回り込み、幅いっぱいにする。
- [事実項目が月次ミラーで古い] → 編集リンクを同じ画面に置き、最新化の導線にする。

## Migration Plan

1. `app-config.json`と`.example`へ`wikidataMirrorUri`を追加する。
2. ビルドへWikidataミラーの取得・検証と、電話・ウェブサイト・Wikipedia・編集URLの解決を追加する。
3. artifactの型と検証へ事実項目を追加する。
4. 詳細ページへ上部の編集リンクと基本情報を追加する。
5. テスト、文書、ライセンス表示を更新する。
6. `npm run build`でartifactを生成し、電話28件、ウェブサイト52件、Wikipediaリンク、編集URL102件を確認する。
7. ロールバックは、artifactの事実項目と詳細ページの表示を削除し、`wikidataMirrorUri`を戻す。

## Open Questions

なし。
