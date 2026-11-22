# 目的地目録の更新

`data/destinations.json` は、ルートページに表示する施設の候補と掲載選択、および場所一覧の母集団を持つ目録です。公開グラフの`urn:uuid:`をIDとして参照します。目録を更新するときは、次の手順を実行してください。

## 前提

- `app-config.json`（開発中は`app-config.local.json`）に`datasetJsonLdUri`と`osmMirrorUri`を設定します。`npm run update-destinations`は`NODE_ENV`が`production`でない限り開発用の設定を読みます。
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

コマンドは公開グラフとOSMタグミラーを取得します。経路検索と同じ補正徒歩距離が500m以下のrecordを候補にします。候補の`name`はOSMタグミラーの`name`を使います。OSM名を解決できないrecordは、目録に同じIDのentryがあり、その名前がある場合だけ候補として残します。

コマンドは候補だけを目録へ書き、候補でないrecordを書きません。同じIDが残るentryの`includeInRouteForm`を引き継ぎます。新しい候補は`includeInRouteForm: false`で追加し、`name`はOSMの名前に更新します。OSM名がないentryは既存の名前を保ちます。

## 報告の読み方

標準エラーへ次の接頭辞を付けてIDを出力します。

- `追加:` 新しい候補を`false`で追加した。
- `削除:` 掲載していないentryを目録から除いた。
- `掲載解除:` 掲載していたentryを目録から除いた。ルートページからも消える。

`掲載解除:`が出た場合は、停留所の変更か公開グラフからのrecordの消失を確認してください。OSM関連付けやOSM名を失っただけの掲載entryは目録に残り、ビルドでスキップされます。名前検索では引き続き施設を選べます。

## 掲載するentryの選択

ルートページへ表示するentryは、`data/destinations.json`の`includeInRouteForm`を`true`にします。表示カテゴリは、ビルドが公開グラフの`schema:DefinedTerm`から`gif-poi`コードで引くため、目録へグループやカテゴリ名を書きません。

掲載entryを選んだら、変更をコミットする前に`npm run build`を実行してください。ビルドは次の場合に失敗します。

- 掲載IDが公開グラフにない。
- 座標が不正である。
- `schema:keywords`の参照先termがない。
- termの`gif-poi`コードが4桁でない、またはコードが重複する。
- 公開グラフの形状がアプリの読むpathを宣言していない。
- 目録の`source`が選択された設定ファイルの取得先と一致しない。

OSM関連付けまたはOSMの名前がない掲載entryは、ビルドを失敗させず、そのentryだけをartifactから外します。カテゴリtermを1つも参照しない掲載entryも、警告を出してartifactから外します。目録にないrecordは場所一覧にも入りません。掲載件数と表示件数がずれるため、ビルド後の`public/generated/location-data.json`で表示件数を確認してください。
