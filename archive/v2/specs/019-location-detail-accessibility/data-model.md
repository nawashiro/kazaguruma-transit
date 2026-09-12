# Data Model: 場所詳細ページのアクセシビリティと情報構造の改善

**Source**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)
**Plan**: [plan.md](./plan.md)

本featureは新しい永続データを追加しない。以下は、既存の`KeyLocation`と`LocationDetailResult`を、ページの公開状態・表示組・監査契約へ投影する論理モデルである。実装では既存loader/resolverと`convertToLocation`を再利用する。

## 1. LocationDetailState

ページが利用者へ公開する状態。データ取得の失敗と未知IDを混同しない。

| State | Meaning | Public heading/message | Required navigation |
|---|---|---|---|
| `loading` | 動的場所データを取得中 | 日本語の読み込み状態を表す主`h1`または状態メッセージ | 上部の`/locations`リンク1つ |
| `success` | IDが一意に解決された | `location.name`を唯一の主`h1` | 上部の`/locations`リンク1つ、必要な詳細リンク、目的地リンク |
| `not-found` | データ取得成功後にIDが存在しない | 場所が見つからないことを示す日本語の主`h1`とalert | 上部の`/locations`リンク1つ |
| `data-load-error` | CDN/fetch/HTTP/JSON取得に失敗 | 取得失敗を示し、not-foundと異なる日本語の主`h1`とalert | 上部の`/locations`リンク1つ |
| `error` | ID不正、重複、または形式不正 | 不正・重複・表示不能を示す日本語の主`h1`とalert | 上部の`/locations`リンク1つ |

`LocationDetailState`は新しいloaderの結果unionを作るモデルではない。`src/lib/location/location-detail-resolver.ts`の既存`LocationDetailResult`をページ表示へマッピングする境界である。

## 2. LocationDetailDocument

成功状態の表示対象。`KeyLocation`の必須属性と任意属性を、意味のある文書順へ投影する。

| Field | Source | Required | Display rule |
|---|---|---:|---|
| `name` | `KeyLocation.name` | yes | `PageHeader`の唯一の`h1`。画像のaltへ重複使用しない |
| `description` | `KeyLocation.description` | no | `p`として表示。`説明`見出しは作らない |
| `areaName` | `location.area`または`findLocationAreaName` | no | 値がある場合だけ`dl`の`dt=地域`/`dd` |
| `imageUri` | `KeyLocation.imageUri` | no | `figure`内の`img alt=""`、明示的な比率 |
| `uri` | `KeyLocation.uri` | no | 外部サイト用native `a`、既存target/relを維持 |
| `nodeCopyright` | `KeyLocation.nodeCopyright` | yes | 提供情報`dl`の`dt=座標データ提供`/`dd` |
| `imageCopyright` | `KeyLocation.imageCopyright` | no | 画像がある場合の提供情報`dt`/`dd` |
| `descriptionCopyright` | `KeyLocation.descriptionCopyright` | no | descriptionがある場合の提供情報`dt`/`dd` |
| `licence` / `licenceUri` | `KeyLocation` | yes | 提供情報`dl`の`dt=ライセンス`/`dd`内リンク |
| destination | `convertToLocation(location)` | yes | `/?destination=<encodeURIComponent(JSON.stringify(value))>`のnative `a` |

任意フィールドは、値がないときに空のterm、空のdefinition、単独のcopyrightを作らない。`area`はlive payloadで0件だったため、既存のderived fallbackを保持する。

## 3. DefinitionPair

`dl`に表示する1組の論理項目。

```text
DefinitionPair {
  term: string;          // visible dt label
  value: ReactNode;      // visible dd content, possibly an external anchor
  condition: boolean;    // false means omit both dt and dd
}
```

公開DOM規則:

- `dt`の直後の要素は対応する`dd`である。
- 提供情報は`h2`の後に1つの`dl`を持つ。
- `dt`/`dd`の値を1つの`p`へ結合しない。
- 通常の提供情報の祖先には`card`、`card-body`、`bg-base-100`、`rounded-lg`などのカード表現を持たせない。
- 共通layoutのKo-fi `section.card`はこのモデルの提供情報ではなく、変更対象外である。

## 4. DestinationLink

既存の目的地設定を表す遷移値。

| Field | Type | Rule |
|---|---|---|
| `location` | `KeyLocation` | existing location object |
| `target` | `Location` | `convertToLocation(location)`の結果 |
| `href` | string | `/?destination=${encodeURIComponent(JSON.stringify(target))}` |
| element | `HTMLAnchorElement` | button/router callbackではない |
| touch target | visual/layout contract | rendered bounding rectangle width/height each at least 44 CSS px |

このモデルは新しいpayloadを定義しない。値のshapeとhome側の消費は既存`convertToLocation`/destination query契約が正本である。

## 5. TypographyAuditContract

通常UIの静的監査モデル。

| Input | Scope | Rule | Exception |
|---|---|---|---|
| named utilities | `src/app/**/*.tsx`, `src/components/**/*.tsx` | `text-xs`、`text-sm`、16px未満相当を違反 | none for normal UI |
| arbitrary utilities | same | 16px未満、未知・解析不能値を違反 | none for normal UI |
| CSS `font-size` | `src/app/globals.css` and explicitly included CSS | 16px未満を違反 | exact `src/app/globals.css` `rt { font-size: 70%; }` only |
| dynamic class composition | same | resolvable local fragments must be inspected; unresolved size-bearing expressions fail closed | no broad ruby exemption |
| test/PDF source | excluded by contract | not part of UI runtime audit | exclusion must be explicit and tested |

実ブラウザでは、静的監査の合格とは別に、代表的な詳細ページ・状態・モバイル幅で算出`font-size`を確認する。

## 6. ColorAuditContract

通常文字の低コントラスト指定を検出するモデル。

- ordinary text must inherit or explicitly use `text-base-content`/equivalent theme token;
- `text-black/60`等の低不透明度・低コントラスト utilityは通常本文、リンク、`dt`、`dd`、状態文、操作名に使わない;
- opacity utilities on normal text are violations unless a contract records a specific non-text decoration exception;
- class absence is only a static regression guard; actual light/dark computed contrast is a browser acceptance check. WCAG 2.2 AA thresholds are normal text `>=4.5:1`, large text `>=3:1`, and applicable non-text controls/indicators `>=3:1`; large text means at least 18pt regular or 14pt bold (approximately 24px or 18.66px bold at 96 CSS px/in).

## 7. MetadataContract

| Input state | Title |
|---|---|
| valid location | `${location.name} - 場所詳細` |
| `千代田区役所` | `千代田区役所 - 場所詳細` |
| invalid/unknown/duplicate/load error | `場所詳細 | 風ぐるま乗換案内`, never raw untrusted ID |

Metadata resolution must use the same validated location identity boundary as the page. It must not introduce a second destination format or raw URL/ID interpolation.

## 8. Persistence and ownership

- No new database, Nostr event, browser storage, or API resource is added.
- Existing CDN data is the location source of truth.
- Existing `LocationDetailResult` is the state source of truth.
- `SidebarLayout` owns the main landmark and Ko-fi card.
- `PageHeader` owns the main heading element.
- The page temporarily owns the public integration boundary; after Green it owns the detail markup directly.
