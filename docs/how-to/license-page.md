# ライセンス情報の更新

## 入力と生成物

ライセンス情報は次のファイルから読みます。

- `package.json`: 本ソフトウェアの情報
- `src/lib/license/openDataLicenses.json`: 使用オープンデータの名前、source、license
- `public/licenses/dependencies.json`: buildが生成する依存パッケージのlicense情報

`public/licenses/dependencies.json`は生成artifactです。直接編集しません。

## 生成経路

依存license情報を更新するときは、入力を修正して`npm run build`を実行します。

```bash
npm run build
```
