# 地点索引の更新

住所・名前の検索とGPSの逆引きは、`data/geocode-index.json` に置いた索引だけを使います。実行時に外部のジオコーディングサービスへ問い合わせません。

## 出典

| データ | 提供元 | ライセンス | 用途 |
| --- | --- | --- | --- |
| 位置参照情報（街区レベル、千代田区） | 国土交通省 | 公共データ利用規約（第1.0版） | 番地の解決と住所の逆引き |
| OpenStreetMap 東京都抽出 | OpenStreetMap contributors | ODbL-1.0 | 名前索引（施設・駅・公園など） |
| 場所artifact | 公開データセット | CC0 1.0 | 名前索引（区の施設） |
| GTFS 停留所 | 日立自動車交通 | CC BY 4.0 | 名前索引（バス停） |

- 位置参照情報: `https://nlftp.mlit.go.jp/isj/`
- OSM抽出: `https://osm.download.movisda.io/admin/JP-13-latest.osm.pbf`
- ライセンス表示は `/license` に掲載しています。

## 更新手順

1. 場所artifactが最新であることを確認します。索引はartifactを読むため、施設を追加したら先に場所データを更新します。

   ```bash
   npm run build
   ```

2. 索引を生成します。

   ```bash
   npm run update-geocode-index
   ```

3. 生成結果を確認します。

   ```bash
   node -e "const i=require('./data/geocode-index.json');console.log('街区',i.blocks.length,'名前',i.names.length,'生成',i.generatedAt)"
   ```

4. 検索を確認します。開発サーバーを起動し、`えみふる`、`神田駅`、`霞が関1-1` を入力して候補が出ることを確かめます。

## OSM抽出のキャッシュ

OSM抽出は133MBあるため、`data/.cache/JP-13-latest.osm.pbf` に取得物を置き、24時間以内なら再利用します。`data/.cache/` はGit管理外です。

取得をやり直すときは、キャッシュを消してから実行します。

```bash
rm -rf data/.cache
npm run update-geocode-index
```

手元のPBFを使うときは `GEOCODE_OSM_PBF` にパスを指定します。

```bash
GEOCODE_OSM_PBF=/path/to/JP-13-latest.osm.pbf npm run update-geocode-index
```

## 索引の中身

- `blocks`: 位置参照情報の街区代表点。町名・丁目・街区符号・座標を持ちます。
- `names`: 名前索引。`name` と別名（`official_name`、`alt_name`、`short_name`、`name:ja`）、座標、種別を持ちます。
- `boundary`: 町字ポリゴン。千代田区の内外を判定し、逆引きの対象を区外へ広げません。
- `source` / `generatedAt`: 出典と生成日時。

道路・鉄道線・水路・行政境界などの線形要素は、駅を除いて名前索引に含めません。

## 出典の表記

索引を加工して作ったことを、ライセンスページの説明文に記載しています。索引の内容を変えた場合は、`src/lib/license/openDataLicenses.json` の説明も合わせて確認してください。

## 索引が古い場合

索引は生成時点のスナップショットです。次のような場合は再生成してください。

- 公開データセットに施設が追加された
- OSMで施設名や住所が修正された
- 位置参照情報の新しい版が出た（`scripts/update-geocode-index.ts` の `ISJ_URI` を更新）

索引が壊れている、または存在しない場合、`/api/geocode` は500を返します。外部サービスへは問い合わせません。
