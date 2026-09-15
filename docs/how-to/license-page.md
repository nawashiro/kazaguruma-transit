# ライセンス情報の更新

## 入力と生成物

ライセンス情報は次のファイルから読みます。

- `package.json`: 本ソフトウェアの名前、version、license、author、repository、funding
- `src/lib/license/openDataLicenses.json`: 使用オープンデータの名前、source、license
- `public/licenses/dependencies.json`: buildが生成する依存パッケージのlicense情報

`public/licenses/dependencies.json`は生成artifactです。直接編集しません。

## 生成経路

依存license情報を更新するときは、入力を修正して`npm run build`を実行します。

```bash
npm run build
```

## 表示確認

`src/lib/license/licensePayload.ts`が3つの入力をまとめます。`src/app/license/page.tsx`は`/license`へ本ソフトウェア、オープンデータ、導入パッケージを表示します。`src/app/api/licenses/route.ts`は同じ情報を`/api/licenses`で返します。

build後に本番serverを起動し、次を確認します。

- `/license`に本ソフトウェア情報が表示される。
- `/license`にオープンデータのlicenseが表示される。
- `/license`に依存パッケージのlicenseが表示される。
- `/api/licenses`が同じpayloadを返す。
