# Issue #118 仕様

## 1. 目的

公開サーバーで実行され、外部リクエストから影響を受ける依存関係のhigh脆弱性を、既存機能を壊さずに修正する。開発専用・build専用のhigh警告は今回の対象外として保留する。

## 2. ユーザーストーリー

### US1: 公開サーバーを安全な依存で運用する

保守者として、Next.jsの公開サーバーが監査上の修正済みバージョンで動くことを保証したい。利用者のAPI routeへのアクセスを、脆弱なNext.jsの解決値に依存させないためである。

### US2: PDF生成APIを安全なブラウザ依存で運用する

保守者として、外部POSTで起動するPDF生成APIが、修正済みPuppeteerとブラウザ依存で動くことを保証したい。既存のPDF出力機能とリクエスト契約は維持する。

### US3: 不要な依存を残さない

保守者として、ソースから参照されない直接依存を削除したい。不要な依存サブツリーを将来の監査対象・供給網リスクとして残さないためである。

## 3. 機能要件

- **FR-001:** `package.json` の `next` は `^15.5.21` 以上の修正境界を宣言する。
- **FR-002:** `package.json` の `puppeteer` は `^25.10.0` 以上の修正境界を宣言する。
- **FR-003:** `package-lock.json` は `package.json` と整合し、Next.js、Puppeteer、`@puppeteer/browsers`、`puppeteer-core`、Next.js配下の`sharp`等を修正済みの解決グラフへ更新する。`extract-zip`のように不要になった脆弱サブツリーは除去する。
- **FR-004:** `transit-departures-widget`を依存宣言とlockfileから削除する。削除前にソース全体で参照がないことを確認する。
- **FR-005:** `@types/puppeteer`をdevDependencyとlockfileから削除する。Puppeteer本体が提供する型定義を利用する。
- **FR-006:** 既存のPDF route handler、入力契約、レート制限、HTML生成、Google Maps呼び出し、レスポンス形式、PDFオプションを変更しない。Puppeteer 25の型互換に必要なnetwork idle待機の表現変更だけを許可する。
- **FR-007:** `__tests__/dependency-security.test.ts` に、対象直接依存の宣言範囲・解決バージョンが修正境界を下回らない契約を追加する。

## 4. セキュリティ要件

- `npm audit --omit=dev --json` の結果から、対象の直接依存とその修正で解消されるサブツリーにhigh脆弱性が残らないことを確認する。
- 監査に残る開発・build専用警告は、実行経路とともに文書へ記録する。警告が残る状態を「監査ゼロ」と表現しない。
- `npm audit fix --force` は使用しない。
- Node.js 22.xを維持する。Puppeteer 25.10.0の `>=22.12.0` 要件を満たすことを確認する。

## 5. 非機能要件

- 既存のAPIレスポンス、PDFの生成手順、外部APIの利用、rate limitingを変えない。
- TypeScript strictnessを維持する。`any`や型回避を追加しない。
- 依存更新以外のリファクタリング・整形・UI変更を行わない。
- package managerが生成するlockfile以外の手編集を行わない。

## 6. 非ゴール

- `prisma` CLI、`@prisma/config`、`deepmerge-ts`の開発/build専用警告を今回解決すること。
- `lighthouse`、webpack/license plugin、GTFS importのbuild専用警告をmajor upgradeすること。
- 依存脆弱性を理由にPDF routeの入力検証やHTMLエスケープを別Issueの範囲まで改修すること。
- UI、DB schema、Dockerfile、デプロイ設定を変更すること。

## 7. 受入基準

- [x] `package.json` の対象直接依存がFR-001、FR-002を満たす。
- [x] lockfileの解決値が修正済み境界を満たし、clean install後の`npm ls`でinvalid/missing/extraneousがない。
- [x] `transit-departures-widget`と`@types/puppeteer`が宣言・lockfileから消える。
- [x] dependency security guardrailと既存PDF route契約テストがpassする。
- [x] strict TypeScript、lint、全Jest、buildが終了コード0になる。
- [x] 監査の残存警告を対象外理由付きで記録し、対象highの解消範囲を正確に報告する。
- [x] 差分に対象外のproduction source変更がない。
