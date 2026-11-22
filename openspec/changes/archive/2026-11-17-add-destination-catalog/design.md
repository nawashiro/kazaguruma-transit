# Design

## Context

現行のビルドは、`app-config.json`の`mainFacilitiesUri`からv2.1.1の`main_facilities.json`を取得し、`keyLocationsUri`と町字GeoJSONと一緒に`public/generated/location-data.json`へ書き出す。ルートページは`src/app/page.tsx`で`sources.mainFacilities`を読む。

移行先の公開JSON-LDは89件の`urn:uuid:` recordを持ち、座標と`gif-poi`コードを提供する。施設名は公開recordにない。公開DatasetはOSMタグのミラーを配布しており、recordの`rdfs:seeAlso`にあるOSM要素の`name`を表示名に使える。`src/lib/transit/transit-service.ts`の`findNearbyStops`は、直線距離を√2で補正し、500m以内の停留所を選ぶ。この処理はprivateで、目録の候補抽出から再利用できない。

`app-config.json`は`.gitignore`の対象で、CIは`app-config.json.example`をコピーする。目録の選択を`app-config.json`へ置くと、exampleと各デプロイに同じリストを二重管理することになる。

## Goals / Non-Goals

**Goals:**

- 公開JSON-LDのIDを参照する共有目録を、リポジトリ内の1ファイルで持つ。
- 経路検索と同じ徒歩距離判定で候補を目録に残し、表示名を解決できないentryはartifactへ出さない。
- ルートページへ出すentryを`includeInRouteForm`で明示的に選ぶ。
- ビルド時にIDから座標と分類を、OSMタグミラーから表示名を解決する。
- 旧`mainFacilities`の取得とartifact項目を削除する。

**Non-Goals:**

- 場所検索ページでの`destinations.json`利用。別changeで行う。
- `/locations`ページと`keyLocations`の公開JSON-LD移行。
- 病院・学校・リサイクルをルートページの一覧へ残すこと。
- ビルド時の徒歩距離の再計算。ビルドは運行DBを持たない。
- 公開JSON-LDのrelease tagへの固定。

## Decisions

### 目録はIDと掲載選択を持つ1ファイルにする

`data/destinations.json`を正本にし、`source`と`places`を持つ。各entryは`id`、`name`、`includeInRouteForm`だけを持つ。IDが同一性を示す。名前は人間用の任意コメントであり、表示にも同一性の判定にも使わない。表示グループはentryに持たせず、ビルド時に`gif-poi`コードから決める。場所検索ページが後から使っても、ルートページ固有のグループ情報が混ざらない。

候補ファイルと選択ファイルの2ファイル構成、`app-config.json`への選択記載、89件すべてに`selected`を持つ案を検討した。2ファイルは再生成と選択の分離ができるが、管理するファイルが増える。`app-config.json`はgitignoreとCIのexampleコピーで二重管理になる。1ファイルに`includeInRouteForm`を持つ案は、候補の追加と選択の変更を同じdiffで確認できる。1ファイルを採用する。

### 候補抽出は経路検索の停留所選択を共通化して行う

`src/lib/transit/stop-selection.ts`を追加し、`calculateHaversineDistanceKm`と`selectNearbyStops`を置く。`TransitService.findNearbyStops`はこの関数を呼ぶ。目録の更新CLIも同じ関数を呼び、運行DBの停留所から500m以内の候補を選ぶ。距離は直線距離に√2を掛け、`TRANSIT_PARAMS.DEFAULT_SEARCH_RADIUS`以下で判定する。上限ちょうどは含める。

候補は500m以内のrecordとする。名前は、`rdfs:seeAlso`のOSM要素をOSMタグミラーで引いた`name`を使う。OSM関連付けまたはOSM名がないrecordは、既存entryの名前があればその名前をコメントに残し、既存entryがなければ候補にしない。現在のデータでは、OSM関連付けのない「子育てひろば「あい・ぽーと」麹町」は既存entryの名前で目録に残り、OSMタグミラーに要素がない「CINEMALICE」は既存entryがないため候補にならない。

CINEMALICEは、OSMのnode/13744716801に`name`があり、データセットとの関連付けも2026-11-14に追加されている。しかしOSMタグミラーの取得は同日05:38で、関連付けのコミット06:44より前である。ミラーが更新されれば候補に戻る。あい・ぽーとは`rdfs:seeAlso`自体がないため、OSM名を解決できずビルドでスキップされる。

更新CLIは公開JSON-LDとOSMタグミラーを取得し、候補の`name`コメントにOSMの名前を書く。OSM名がない既存entryは、目録の名前をコメントとして残す。候補は`data/destinations.json`へ書き、同じIDが残るentryの`includeInRouteForm`を引き継ぐ。新しい候補は`false`で追加する。掲載entryが500mを超えた場合、または公開JSON-LDから消えた場合は、IDを標準エラーへ報告して目録から除く。OSM関連付け・OSM名を失っただけの掲載entryは目録に残し、ビルドでスキップする。候補でないrecordは目録に書かない。

ビルド時に運行DBを読む案は、ビルド環境にGTFSの取り込みがなく、外部ZIPの取得も増えるため採らない。候補抽出を目録更新時の一度の処理にし、ビルドは目録を信頼する。経路検索は実行時に同じ500m判定を行うので、目録が古くなっても到達不能な経路を返さない。

### ビルドは公開JSON-LDとOSMタグミラーをIDで結合する

`app-config.json`へ`placesJsonLdUri`と`osmMirrorUri`を追加し、ビルドは公開JSON-LDとOSMタグミラーを取得する。`includeInRouteForm: true`のIDについて、`schema:geo`の緯度・経度と、`schema:identifier`の`gif-poi`コードを解決する。表示名は、recordの`rdfs:seeAlso`にあるOSM要素をOSMタグミラーで引き、`tags.name`から取る。IDがない、座標が不正、コードが0件または複数、コードがグループ定義にない場合はビルドを失敗させる。OSM関連付けまたはOSMの名前がないentryは、そのentryだけをartifactから外し、残りのentryで出力する。旧`mainFacilities`へのフォールバックはしない。

公開JSON-LDはGitHub Pagesの`places.jsonld`、OSMタグミラーは同じPagesの`mirrors/osm.json`を使う。release tagへの固定は、現在のreleaseに`gif-poi`が含まれないため行わない。目録の`source.placesUri`と`app-config.placesJsonLdUri`、`source.osmMirrorUri`と`app-config.osmMirrorUri`が一致しない場合はビルドを失敗させ、目録の再生成を促す。

### 表示グループは8つに固定する

`gif-poi`コードから表示グループを決める。グループ定義はコードに置き、目録には持たない。

| グループ | コード |
| --- | --- |
| 行政・相談 | 1302, 1304, 1219, 1606 |
| 子育て・福祉 | 1307, 1402, 1403, 1499 |
| 学び・図書館 | 1512 |
| 博物館・美術館 | 0801, 0802, 0803 |
| 映画館 | 1011 |
| 公園・自然 | 1003, 1004 |
| 寺社・教会 | 0702, 0703 |
| くらし・余暇 | 0903, 2603 |

掲載entryのないグループはartifactへ出さない。グループの順序は上の表の順とする。

### ルートページの型からentryごとのライセンスを外す

公開JSON-LDはrecordごとのライセンスを持たない。ライセンスはDataset全体のODbLとCC0で示す。ルートページ用のartifactは`{ category, category:en, locations: [{ name, lat, lng }] }`とし、entryごとの`copyright`、`licence`、`licenceUri`を持たない。`AddressCategory`は`/locations`用に残す。

`src/lib/license/openDataLicenses.json`の「千代田区主要施設座標データ」を、新しいDataset landing pageとODbL/CC0の表示へ更新する。座標と表示名はOSMタグミラー由来のODbL、Datasetのproject dataはCC0である。recordごとのライセンスを推測して付けない。

### 旧`mainFacilities`と未使用の設定を削除する

`mainFacilitiesUri`、artifactの`sources.mainFacilities`、`main_facilities.json`の取得を削除する。`locationsDataVersion`と、`src/utils/addressLoader.ts`の未使用の`loadAddressDataResult`・`loadKeyLocationsDataResult`も削除する。`keyLocationsUri`と町字GeoJSONは`/locations`用に残す。

### 初期掲載は旧ルートページ対応の22件にする

旧ルートページの62件のうち、公開JSON-LDのrecordと同一施設と確認できる22件を`includeInRouteForm: true`にする。すべて500m以内である。OSM関連付けのない「子育てひろば「あい・ぽーと」麹町」も掲載するが、ビルドでスキップされ、表示は21件になる。万世橋区民館は、公開JSON-LDの「千代田区役所 万世橋出張所・区民館」を対応するrecordとして含める。和泉橋区民館は、同じ建物の「千代田区役所和泉橋出張所」で代表させる。

| グループ | 初期掲載 |
| --- | --- |
| 行政・相談 | 千代田区役所、千代田区富士見出張所・区民館、千代田区神保町出張所・区民館、千代田区神田公園出張所・区民館、千代田区役所和泉橋出張所、千代田区役所 万世橋出張所・区民館 |
| 子育て・福祉 | えみふる（障害者福祉センター）、障害者よろず相談Light、いきいきプラザ一番町、岩本町ほほえみプラザ、ちよだパークサイドプラザ、昌平童夢館、西神田コスモス館、四番町児童館、一番町児童館、富士見みらい館、子育てひろば「あい・ぽーと」麹町（ビルドでスキップ） |
| 学び・図書館 | 千代田区立千代田図書館、千代田区立昌平まちかど図書館、千代田区立神田まちかど図書館、千代田区立ちよだパークサイドプラザ区民図書室、千代田区立四番町図書館 |

表示名はOSMタグの`name`を使うため、データセットの検索入力にある名前とは一致しない場合がある。たとえば「昌平童夢館」はOSMでは「神田児童館」、「西神田コスモス館」は「西神田児童・家庭支援センター」、「いきいきプラザ一番町」は「千代田区立一番町高齢者在宅介護支援センター」になる。

## Risks / Trade-offs

- [OSMの名前がデータセットの名前と違う] → 表示はOSMタグミラーの`name`に従う。目録の名前は人間用のコメントとして残し、表示には使わない。
- [OSM関連付けまたはOSM名がないrecordがある] → 既存entryの名前がなければ候補にしない。掲載entryが不完全になった場合は目録に残し、ビルドでそのentryだけをスキップする。表示件数は掲載件数より少なくなる。
- [OSMタグミラーが関連付けの更新に追いつかない] → ミラーに要素がないrecordは一時的に候補から外れる。次のミラー更新後に目録を再生成し、新しい候補として`false`で追加する。CINEMALICEはこの状態である。
- [Pagesの公開JSON-LDが目録の生成後に変わる] → 掲載IDが見つからなければビルドを失敗させる。release tagへ固定する必要が出たら、その時点で`placesJsonLdUri`を版固定URLへ変える。
- [掲載entryが停留所の変更で500m超になる] → 目録の更新がIDを報告して除く。ルートページからは消えるが、名前検索では引き続き選べる。
- [病院・学校・リサイクルが一覧から消える] → 名前検索で目的地にできる。**BREAKING**として提案とリリースノートに書く。
- [目録の500m判定が古くなる] → 経路検索は実行時に同じ500m判定を行う。目録は掲載の候補であり、到達を保証しない。
- [ODbLとCC0の混在をentryごとに示せない] → Dataset landing pageへのリンクと、Dataset全体のライセンス表示で示す。recordごとのライセンスを推測しない。
- [目録の`source.placesUri`とビルド設定がずれる] → ビルドで`placesJsonLdUri`と`osmMirrorUri`の一致を検証し、ずれたら失敗させる。

## Migration Plan

1. `src/lib/transit/stop-selection.ts`へ距離計算と停留所選択を抽出し、`TransitService`を移行する。既存の500m判定のテストを通す。
2. 目録更新CLIを追加し、公開JSON-LD、OSMタグミラー、運行DBから候補を生成する。初期22件を`includeInRouteForm: true`にして`data/destinations.json`をコミットする。
3. ビルドへ公開JSON-LDとOSMタグミラーの取得、ID結合、OSM名の解決を追加し、artifactの`sources.routeDestinations`を出力する。`sources.mainFacilities`を削除する。
4. ルートページを新しいartifactへ切り替え、型とテストを更新する。
5. `app-config.json`と`app-config.json.example`から`mainFacilitiesUri`を削除し、`placesJsonLdUri`と`osmMirrorUri`を追加する。`locationsDataVersion`と未使用ローダーを削除する。
6. ライセンスページのオープンデータ表示を更新する。
7. ロールバックは、ビルドと設定を旧`mainFacilities`の取得へ戻す。`data/destinations.json`は残してよい。
