# 調査記録: 施設ページと検索フォームのURL整理

**Date**: 2026-09-05
**Feature**: [spec.md](spec.md)

## 決定1: 単一のビルド用スナップショットを生成する

- **Decision**: 公開準備の前に、設定済み施設版の`main_facilities.json`、`key_locations.json`、町字GeoJSONを一度だけ取得・検証し、`src/generated/location-data.json`へ保存する。ページはこのJSONだけを読む。
- **Rationale**: 一覧、カテゴリ、詳細、トップ候補が同じ入力版を共有する。閲覧時にCDNを取得しない。取得失敗・形式不正・識別子重複で公開準備を失敗させられる。
- **Alternatives considered**:
  - `fetch(..., { cache: "force-cache" })`を各ページで使う。キャッシュ欠損時に実行時のCDN取得があり、要件を満たさない。
  - ブラウザで既存loaderを使う。施設ごとの閲覧時取得と空配列フォールバックを残すため不採用。
  - 新しい施設APIやDBを作る。今回の表示データには不要で、KISSに反するため不採用。

## 決定2: カテゴリ識別子をデータの値として厳格に扱う

- **Decision**: `category:en`をそのまま識別子として検証する。リンクでは`encodeURIComponent`を使う。空、前後空白、制御文字、`/`、`?`、`#`、`.`、`..`、予約名`location-detail`、集合内重複を拒否する。文字小文字化や空白置換は行わない。
- **Rationale**: 現在の詳細データには`natural environment park`がある。ASCII slugへの制限や正規化は正常データを壊す。
- **Evidence**: 設定版`2.1.1`を取得し、詳細施設は16カテゴリ169件、`category:en`の空値・重複・予約名衝突は0件だった。
- **Alternatives considered**: 表示名からslugを作る。将来の衝突と不可逆なURL変更を作るため不採用。

## 決定3: 既知の施設パスをSSGし、未知URLを共通404へ送る

- **Decision**: カテゴリと詳細のルートは`generateStaticParams`で既知の全カテゴリ・詳細パスをSSGし、`dynamicParams = false`を明示する。未知URLは`src/app/not-found.tsx`の共通HTTP 404へ送る。共通ページは見出し「ページが見つかりません」と本文「お探しのページは見つかりませんでした。」を表示し、`/locations`への戻るリンクを設けない。カテゴリと詳細の固有not-foundは作らない。`/locations`はカテゴリへの通常リンクを表示する。旧`/location-detail/[id]`は削除する。
- **Rationale**: 既知ページをSSGし、未知URLの応答と表示を一つへ統一する。閲覧時の施設取得と履歴依存を排除し、実行時CDN取得を行わない。旧経路のフォールバックを残さないという憲章にも適合する。
- **Evidence**: 初回T057の隔離Next runtimeでは未知URLがsegment not-found/default 404になり、ページ状態へ到達せずFAILだった。T060の`dynamicParams = true`と安全なカテゴリID decode（二重decode）は当時の修正であり、T058 focused test 12/12 PASSを親が確認した。T065で`dynamicParams = false`、防御的な`notFound()`、共通`not-found.tsx`を反映し、T067/T068の関連17テストは親確認で17/17 PASSだった。ユーザー修正後のfresh runtime PASSはまだ確認していない。
- **Risk and mitigation**: 既知カテゴリ・詳細のSSG、未知URLのHTTP 404・共通本文・戻るリンクなし、実行時CDN取得0件を、隔離本番生成物で再確認する。

## 決定4: 町字は公開準備時に確定する

- **Decision**: GeoJSONを厳格に検証し、Polygonの外周に含まれ、穴には含まれない判定を行う。町字不明は`地域不明`とする。カードと詳細は事前計算済みの町字を受け取る。
- **Rationale**: 現行`clientGeoUtils.ts`は閲覧時取得を行い、Polygonの穴を除外しない。`area`は現データで未提供だった。
- **Alternatives considered**: 現行GeoJSON loaderを再利用する。HTTP・形状の検証がなく、失敗時に安全に止まれないため不採用。

## 決定5: 距離順はカテゴリページの明示操作だけで提供する

- **Decision**: カテゴリページは町字別の静的HTMLを初期表示する。現在地または住所を利用者が明示した後だけ、同じ初期データを距離順に並べ替える。再読み込み・カテゴリ移動で町字別に戻す。
- **Rationale**: ユーザー判断を満たし、位置情報の自動要求、距離順状態の保存、施設データ再取得を避ける。
- **Rate limit decision**: 既存の429時の`/rate-limit?source=...`遷移は、利用制限を維持する憲章の要件として残す。この場合は遷移するため、入力保持要件の例外として計画・テストへ明記する。

## 決定6: 入力URLは既存の検索条件表現を部分的に解釈する

- **Decision**: `origin`、`destination`、`time`、`isDeparture`、`prioritizeSpeed`を既存の結果URLと同じ形式で解釈する。新しい部分入力parserは、未指定と指定済み不正を区別し、項目別エラーを返す。既存の全項目必須parserと結果URL生成は維持する。
- **Rationale**: `destination=緯度,経度`だけの施設CTAを許可し、全条件の結果URL契約を変えない。
- **Details**: 同じキーは先頭の有効値を採用する。`false`を未指定扱いにしない。不正日時や不正真偽値を現在時刻・保存値で黙って置換しない。日時未指定だけは閲覧時刻を初期値にする。

## 決定7: トップを単一のネイティブフォームにする

- **Decision**: `RouteSearchForm`が地点、日時、時刻種別、優先条件を持つ。外側は`form`を1個だけとする。名前検索、GPS、「なおす」は`type="button"`、最後の経路検索だけを`type="submit"`とする。
- **Rationale**: 入れ子フォームをなくし、全4セクションを常時表示し、IMEの確定と最終検索を混同しない。
- **Details**: トップ候補62件はビルドデータをpropsで受け、`select`と`optgroup`で表示する。候補にはカテゴリ横断の同名・同座標があるため、名称を一意キーにしない。確定した地点だけを要約と「なおす」に切り替え、編集時にその入力へフォーカスする。

## 決定8: 静的トップと閲覧時の初期値を両立する

- **Decision**: トップページはサーバーで検索パラメータを読まない。静的に候補を渡し、クライアントのフォームがブラウザURL、閲覧時刻、保存済み優先条件を初期適用する。URL検索パラメータを読む境界には必要なSuspenseを置く。
- **Rationale**: サーバー`searchParams`は動的レンダリングになる。URL初期値と日時は閲覧時の値でなければならない。

## 検証前提

- `npm run build`と`npm start`はPrisma DB更新とGTFS取込を行う。最終本番生成の検証は隔離コピーで、生成CLIと`next build`を直接実行する。
- 現環境はNode`v26.5.1`で、`package.json`はNode`22.x`を要求する。最終結果ではこの不一致を明示する。
- Puppeteer用には`/usr/bin/chromium`がある。ブラウザ確認では明示的に使う。
