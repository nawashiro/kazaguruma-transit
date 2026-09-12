# SEO実装の確認

この文書は、現在のmetadata、structured data、sitemap、robotsの確認方法だけを示します。

## metadata

共通metadataの正本は`src/app/layout.tsx`です。title、description、keywords、authors、canonicalの値を確認します。

canonicalとsitemapの基底値は`app-config.json`の`appUrl`から読みます。配布先の値を使い、文書へ未確定の公開URLを書きません。

ページ固有のmetadataは各routeの`layout.tsx`で定義します。対象ページの内容と値を照合します。

## structured data

`src/components/layouts/StructuredData.tsx`がJSON-LDを作ります。root layoutがheadへ配置し、`WebApplication`と風ぐるまのバスサービス情報を出力します。

構造を変更するときは、実装の項目と表示内容を照合します。文書だけに項目を追加しません。

## sitemap

`src/app/sitemap.ts`が動的sitemapを返します。基底値は`appConfig.appUrl`です。

現在の対象routeは次の5つです。

- `/`
- `/beginners-guide`
- `/usage`
- `/award`
- `/license`

routeを追加または削除したときは、sitemapの配列と実在するrouteを同時に確認します。

## robots

`public/robots.txt`が全crawlerへ`/`の巡回を許可し、sitemapの場所を示します。

公開前に、sitemapの場所が配布先の実際の公開値と一致することを確認します。未確定の値を追加しません。

## 確認

1. `app-config.json`を用意します。
2. `npm run build`を実行します。
3. 起動後に対象routeのhead、JSON-LD、sitemap、robotsを確認します。
4. source fileと実際の出力が一致することを確認します。

```bash
npm run lint
npx tsc --noEmit --incremental false
```
