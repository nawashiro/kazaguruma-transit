# 徒歩ネットワークの更新

経路検索の徒歩距離は、`data/walk-network.json` に置いた歩行ネットワークを使います。直線距離に係数を掛ける近似は使いません。

ネットワークはリポジトリで管理しています。ビルドや起動のたびに外部から取り直しません。

## 出典

| データ | 提供元 | ライセンス | 用途 |
| --- | --- | --- | --- |
| OpenStreetMap 東京都抽出 | OpenStreetMap contributors | ODbL-1.0 | 歩行可能な道のネットワーク |

- OSM抽出: `https://osm.download.movisda.io/admin/JP-13-latest.osm.pbf`
- 地点索引と同じ抽出を使います。詳細は[地点索引の更新](update-geocode-index.md)を参照してください。
- ライセンス表示は `/license` に掲載しています。

## 更新手順

1. 地点索引が最新であることを確認します。徒歩ネットワークは索引の町字ポリゴンを読むため、先に索引を更新します。

   ```bash
   npm run update-geocode-index
   ```

2. ネットワークを生成します。

   ```bash
   npm run update-walk-network
   ```

3. 生成結果を確認します。

   ```bash
   node -e "const n=require('./data/walk-network.json');console.log('ノード',n.nodes.length,'エッジ',n.edges.length)"
   ```

   内容が前回と同じ場合、コマンドは `徒歩ネットワークに変更はありません` と報告し、ファイルを書き換えません。

4. 経路検索を確認します。開発サーバーを起動し、徒歩時間と使用停留所が表示されることを確かめます。

## OSM抽出のキャッシュ

OSM抽出は133MBあるため、`data/.cache/JP-13-latest.osm.pbf` を地点索引と共用します。24時間以内の取得物を再利用します。`data/.cache/` はGit管理外です。

手元のPBFを使うときは `GEOCODE_OSM_PBF` にパスを指定します。

```bash
GEOCODE_OSM_PBF=/path/to/JP-13-latest.osm.pbf npm run update-walk-network
```

## ネットワークの中身

- `nodes`: `[OSMノードID, 緯度×10^6, 経度×10^6]` の配列。
- `edges`: 両端のOSMノードIDの組 `[a, b]` の配列。長さは座標から計算します。
- 対象範囲: 千代田区の町字ポリゴンの内側、またはいずれかの停留所から300メートル以内
- 残す範囲: 最大の連結成分だけ

エッジの長さを保存しないのは、座標と長さが食い違う余地を残さないためです。ノードを通し番号ではなくOSMノードIDで書くのは、ノードが1つ増えただけで全行が差分になるのを避けるためです。

配列の要素は1行ずつ書き出します。1行のJSONでは差分が全体の置換になり、どの道が変わったかをレビューできないためです。

## 使うhighway

`footway`、`pedestrian`、`path`、`steps`、`living_street`、`residential`、`service`、`unclassified`、`tertiary`、`secondary`、`primary`、`track`、`corridor`、`crossing` を使います。`foot=no`、`access=no`、`access=private`、`construction`、`area=yes` は除外します。

## ネットワークが読めない場合

`data/walk-network.json` がない、または形式が不正な場合、`/api/transit` の経路検索はエラーを返します。直線距離による判定へは切り替えません。切り替えると、artifactの更新漏れが精度の低い答えとして静かに現れ、気づけなくなるためです。
