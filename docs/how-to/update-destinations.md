# 目的地目録の更新

`data/destinations.json` は、ルートページに表示する施設の候補と掲載選択を持つ目録です。公開JSON-LDの`urn:uuid:`をIDとして参照します。目録を更新するときは、次の手順を実行してください。

## 前提

- `app-config.json`に`placesJsonLdUri`と`osmMirrorUri`を設定します。
- 経路検索用の交通DBに停留所を取り込みます。目録の徒歩圏判定はこの停留所を使います。
- Node.js 22で実行します。

## 目録の再生成

1. 作業ディレクトリをリポジトリのルートにします。
2. 次のコマンドを実行します。

   ```bash
   npm run update-destinations
   ```

   `npm run`を使わない場合は、同じ処理を`npx tsx scripts/update-destinations.ts`で実行できます。

3. 標準エラーに出力されたIDを確認します。
4. `data/destinations.json`の差分を確認します。
5. `npm run build`を実行し、目録のIDと公開データが一致することを確認します。

コマンドは公開JSON-LDとOSMタグミラーを取得します。その後、次の条件をすべて満たすrecordを候補にします。

- 経路検索と同じ補正徒歩距離が500m以下である。
- `rdfs:seeAlso`にOSM要素を持つ。
- OSMタグミラーに要素があり、空でない`name`を持つ。

コマンドは候補だけを目録へ書き、候補でないrecordを書きません。同じIDが残るentryの`includeInRouteForm`を引き継ぎます。新しい候補は`includeInRouteForm: false`で追加し、`name`はOSMの名前に更新します。

## 報告の読み方

標準エラーへ次の接頭辞を付けてIDを出力します。

- `追加:` 新しい候補を`false`で追加した。
- `削除:` 掲載していないentryを目録から除いた。
- `掲載解除:` 掲載していたentryを目録から除いた。ルートページからも消える。

`掲載解除:`が出た場合は、停留所の変更、OSM関連付けの消失、OSMの名前の消失、公開JSON-LDからのrecordの消失のどれが原因かを確認してください。名前検索では引き続き施設を選べます。

## 掲載するentryの選択

ルートページへ表示するentryは、`data/destinations.json`の`includeInRouteForm`を`true`にします。表示グループは`gif-poi`コードからビルド時に決まるため、目録へグループを書きません。

掲載entryを選んだら、変更をコミットする前に`npm run build`を実行してください。ビルドは次の場合に失敗します。

- 掲載IDが公開JSON-LDにない。
- 座標または`gif-poi`コードが不正である。
- `gif-poi`コードが表示グループにない。
- OSM関連付けまたはOSMの名前がない。
- 目録の`source`が`app-config.json`の取得先と一致しない。
