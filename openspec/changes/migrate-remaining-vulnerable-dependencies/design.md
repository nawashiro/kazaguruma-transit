# Design

## Context

調査日は2026-10-25 UTC、基準コミットは `dev` の `b13cc1bd661646181fcc425f58f27c6eee2084b9` とする。変更の目的は proposal.md に記す。

| 監査範囲 | critical | high | moderate | 合計 |
|---|---:|---:|---:|---:|
| 全依存 | 0 | 11 | 6 | 17 |
| 開発依存を除外 | 0 | 8 | 5 | 13 |

件数は警告対象のパッケージ数であり、固有の脆弱性数ではない。親依存への波及を含む。公開リクエストからの到達性とは区別する。

ローカルのNode.jsは22.23.4である。Next.jsは15.5.28、Prismaとクライアントは6.19.3、GTFSは4.17.5、Google Maps SDKは3.4.2を解決している。

Prisma schemaはSQLiteを指定する。アプリと取込スクリプトは `datasourceUrl` で接続先を渡す。交通設定はJSONから読み込む。Prisma設定ファイルと `package.json` のPrisma設定は存在しない。問題の循環オブジェクトを設定マージへ渡す経路は確認できていない。

## Goals / Non-Goals

**Goals:**

- 依存の解決値と動作の検証結果に基づいて、各段階の採否を決める。
- 空のDBからGTFSを取り込み、Prismaで読み出して検索する構成へ移行する。
- 各段階の失敗を切り分け、採用済みの変更を保つ。

**Non-Goals:**

- 監査件数だけを理由に、関係のない依存を一括更新すること。
- キャッシュの旧データを保存する移行処理や、旧Prismaとの二重実装。
- Node.jsのメジャー移行、DB基盤の変更、本番作業、自動監査の新設。

## Decisions

### 1. 互換範囲の10パッケージを先に更新する

次の候補は現在の親依存の指定範囲に含まれる。候補版の公開とNode要件はレジストリで確認した。採用前に監査情報を再確認する。

| 対象 | 現在の解決値 | 更新候補 | 用途 |
|---|---|---|---|
| @humanfs/node | 0.16.6 | 0.16.8 | ESLintのファイル処理 |
| brace-expansion | 1.1.16 / 2.1.2 | 1.1.21 / 2.1.7 | glob・検査・文書生成 |
| js-yaml | 3.15.0 / 4.3.0 | 3.15.2 / 4.3.2 | Jest・ESLintの設定 |
| joi | 18.2.3 | 18.3.0 | テスト用サーバーの起動待ち |
| tar | 7.5.20 | 7.5.22 | Tailwind関連 |
| source-map-js | 1.2.1 | 1.2.2 | CSSビルド |
| fast-uri | 3.1.3 | 3.1.9 | ビルド設定のスキーマ検証 |
| markdown-it | 14.3.0 | 14.3.3 | GTFS配下のJSDoc |
| browserslist | 4.28.1 | 4.29.4 | webpack・Babel |
| baseline-browser-mapping | 2.9.19 | 2.11.32 | browserslist |

ロックファイルの対象解決を更新する。複数版がある依存は全経路を確認する。不要な直接依存やoverrideを追加せず、親依存のメジャー更新も行わない。

最新版への一括更新は採用しない。たとえば @humanfs/node 0.17.0はNode.js 24以上を要求する。今回の修正候補0.16.8はNode.js 22で利用できる。

この段階で失敗した場合は、原因を解消するか段階の差分を戻す。成功した基準を作るまで、追加3経路の変更を混ぜない。

### 2. GTFSはCSV修正版を含む4系で移行を試す

GTFS 4.20.1を最初の候補とする。csv-parse 7.0.2を含み、4.21.0で導入されるKysely関連の変更を避けられる。4.20.0はcsv-parse 7.0.1であり、対象警告を解消しない。

移行はbetter-sqlite3 12系から13系、GTFS-Realtime関連依存の変更も伴う。Node.js 22上でネイティブ依存の導入、GTFS取込、Prisma読出しを検証する。取込件数だけでなく、深夜便・運行日・入力形式の差異を既存テストで確認する。

csv-parse単体の強制overrideは最初の手段にしない。GTFSが対応した組合せで試す。GTFS移行が失敗した場合は、この経路だけを戻す。

### 3. Google Mapsは既存SDKを保ち、デコーダーの互換性を確認する

SDK 3.4.2はquery-stringの8未満を要求する。解決済みquery-string 7.1.3はdecode-uri-component 0.2.2を要求し、通常の範囲内では修正版へ届かない。

最初に、この経路に限定したdecode-uri-component 0.5.1へのoverrideを試す。0.5系はES Modules形式で、0.2系のCommonJS形式と異なる。query-stringが期待する関数の取得、Next.jsのサーバービルド、実際のSDK呼出しを検証する。Node.js単体の読込成功だけで採用しない。

SDKの現物ではURL生成にquery-stringのstringifyを使う。問題のデコード処理へ利用者入力が届く経路は確認できていない。ただし、未確認を影響なしとは扱わない。

検証は通常の住所、座標、日本語、空白、プラス記号、不正なパーセント表記を含める。Googleへの固定URL、クエリー、署名を使う箇所、Directionsの返却値、地図画像URLを照合する。SDK全体の置換や独自デコーダーの実装へ拡大せず、互換性を保てなければ経路の変更を戻す。

### 4. Prismaは安定版7系へ正式移行する

prismaと @prisma/client を同じ安定版7系へ揃える。調査時の候補は7.10.1である。prismaのlatestタグには8系RCが返るため、latest指定で導入しない。SQLiteには対応する @prisma/adapter-better-sqlite3 を使用する。

Prisma 6のdeepmerge-ts 7.1.5固定を8系へ強制置換する案は採用しない。7系への正式移行で設定読込の依存も更新し、deepmerge-ts警告の解消を再監査で確認する。

Prisma 7の公式移行手順に従い、schemaの接続設定、Prisma設定ファイル、クライアント生成先、import、アダプターを使う初期化を変更する。型設定とJestの読込も必要な範囲で対応させる。Prismaを使う型参照、DB管理、取込スクリプト、モックを検索して旧初期化を残さない。

CLIのDB構築、GTFS取込、アプリの読出しには、交通設定で指定された同じSQLiteパスを使う。相対パスは既存の解決規則を保つ。構築用の固定パスと実行時パスの食い違いを、隔離した保存先で検証する。

DBはキャッシュであり、空の状態から構築する。旧DBのデータ移行・バックアップ・互換層を追加しない。取込元GTFSと公開設定は保持する。キャッシュの破棄は検証用の隔離先に限定し、稼働環境の削除は行わない。

Prisma移行に必要な上記の改修は範囲内とする。DB基盤や利用者向けAPIの変更が必要になった場合は、Prisma経路を戻して理由を記録する。

### 5. 各段階に同じ採用条件を適用する

| 確認 | 採用条件 |
|---|---|
| 再現可能な導入 | ロックファイルからのクリーン導入が成功する |
| 監査 | 全依存と開発依存を除く監査を実行し、対象警告の解消と新規警告を確認する |
| 静的検査 | lint、strict TypeScript、git diff --checkが成功する |
| ビルド | 通常のビルドと本番モードのローカル起動が成功する |
| 回帰 | 既存Jestを実行し、基準で成功したテストが失敗しない |
| 実機能 | 変更経路の実依存を使う確認が成功する。モックだけで互換性を判断しない |

動作を変更する互換対応では、先に意味のあるテストを追加して失敗を確認する。版番号の検査だけを機能検証の代用にしない。既存のNext.js・sharp等の修正下限も維持する。

GTFSとPrismaでは合成GTFSを隔離DBへ取り込み、同じDBをアプリから読み出して検索する。Google Mapsでは実SDKを使い、通信応答の代替と実通信の結果を区別する。地図・画像・PDFは共通の回帰確認に含める。

APIキーやChromeがない場合は、実通信やPDF出力を未確認と記録する。実依存を使う代替検証でも対象変更の互換性を判断できなければ、経路の採用を保留して試行差分を戻す。基準状態でも失敗する検証は、更新による回帰と区別して記録する。

## Risks / Trade-offs

- GTFSのネイティブ依存や生成テーブルが変わるリスク → 隔離DBで取込・Prisma読出し・経路検索を確認する。
- デコーダーのモジュール形式や復号結果が変わるリスク → 実SDKとNext.jsの実行経路で確認し、不適合なら経路を戻す。
- PrismaのCLIとアプリが別のDBを参照するリスク → 設定で変えた保存先から、空DB構築・取込・検索を通して検証する。
- 経路の取消しで脆弱性が残るリスク → 残存警告、到達性、取消し理由を報告する。
- 新しい依存に別の警告が増えるリスク → 件数だけで判断せず、依存経路と攻撃条件を確認する。
- ローカル検証と本番の状態が異なるリスク → 本番未反映と実行版未確認を最終報告に残す。

## Migration Plan

1. 作業ツリーと基準コミットを確認し、既存の監査・機能検証を記録する。
2. 10パッケージを更新し、共通の採用条件を確認してコミットする。
3. GTFS、Google Maps、Prismaの順で、直前の採用状態から移行を試す。
4. 成功した経路は検証結果とともに個別にコミットする。
5. 失敗した経路は未コミットなら対象差分だけを戻す。コミット済みならgit revertで取り消す。
6. 取消し後はロックファイルから依存を復元し、該当検証と再監査を実行する。Prisma経路の試行DBは必要に応じて隔離先で再生成する。
7. 次の経路に進む前に、失敗した試行の変更が残っていないことを確認する。
8. 最終状態の全体検証、残存警告、採用コミット、取消しと未実施事項を報告する。

取消しには他者の差分を巻き込むgit reset --hardや一括削除を使わない。後続経路の失敗を理由に、採用済みの前段階を戻さない。

各段階の結果はこの文書のVerification Resultsとtasks.mdに記録する。未採用の経路は理由と取消し確認を記録した時点で試行完了とし、移行成功とは区別する。将来の本番反映では元GTFSからキャッシュを再生成する。旧DBを戻す手順は用意しない。

## References

- [Prisma 7公式移行ガイド](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Prisma 7.10.1](https://github.com/prisma/prisma/releases/tag/7.10.1)
- [GTFS変更履歴](https://github.com/BlinkTagInc/node-gtfs/blob/main/CHANGELOG.md)
- [csv-parseの修正条件](https://github.com/advisories/GHSA-8cw4-87c7-c6xx)
- [decode-uri-componentの警告](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
- [decode-uri-componentの形式・挙動の変更](https://github.com/SamVerschueren/decode-uri-component/releases)
- [deepmerge-tsの警告](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)

## Verification Results

計画作成時点では依存更新、移行、機能検証、コミットを実施していない。実装時に各段階の結果を追記する。

### Baseline — 2026-10-25

実装開始時のHEADはb13cc1b、作業ツリーには今回の計画文書だけがあった。再監査は全依存17件（high 11、moderate 6）、開発依存を除く13件（high 8、moderate 5）、criticalは両方0件だった。npm lsで対象10パッケージとGTFS・Prismaの基準解決値を照合した。lint、strict TypeScript、buildは成功した。

基準の本番モードローカル起動はHTTP 200、Jestは174スイート・1,456件成功、2スイート・13件スキップだった。

### Compatible dependencies

10パッケージを更新した。複数版のbrace-expansionとjs-yamlも修正版を解決した。親依存のメジャー更新と新しいoverrideはない。付随依存とnpmによるoptional依存のロック補完を含む。クリーン導入、lint、strict TypeScript、build、ローカル起動、Jest 174スイート・1,456件が成功した。13件は基準と同じスキップだった。実SDKのURL生成・代替応答処理、query-stringの日本語・プラス記号・不正パーセント表記の往復、sharpのSVGからPNGへの変換を確認した。地図・PDFの既存契約テストも成功した。実Google通信とChromeによるPDF出力は未確認である。

監査は全依存・開発依存を除く両方で7件（high 3、moderate 4、critical 0）だった。残るのはPrisma系3、GTFS系2、Google Maps系2である。
