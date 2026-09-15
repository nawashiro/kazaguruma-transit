# SEO実装の確認

## 文書の範囲

- metadata
- structured data
- sitemap

## metadata

共通metadataの正本は`src/app/layout.tsx`です。title、description、keywords、authors、canonicalの値を確認します。

canonicalとsitemapの基底値は`app-config.json`の`appUrl`から読みます。配布先の値を使い、文書へ未確定の公開URLを書きません。

ページ固有のmetadataは各routeの`layout.tsx`で定義します。

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
