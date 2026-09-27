## Context

現状の`npm run build`は、`prisma`処理、`import-gtfs`、Next.js buildを直列に実行する。`import-gtfs`はtransit-configの読み込みエラーを捕捉して成功終了へ変換するため、設定欠落がbuild成功を妨げない。CIは`app-config.json`だけを用意し、transit-configを用意していない。詳細な動機と要求は`proposal.md`と`specs/transit-config-enforcement/spec.md`を参照する。

## Goals / Non-Goals

**Goals:**

- transit-configの欠落・不正・GTFS取り込み失敗をbuildの失敗として確実に伝播させる。
- 本番データやSecretに依存しない小規模な合成GTFS fixtureでCIを検証する。
- 日立自動車交通のデータで確認した入力形式を、実在する値を複製せずに回帰検証する。
- fork由来のPull Requestでも、transit入力のbuild境界を検証できる状態にする。

**Non-Goals:**

- 本番GTFSの収録、再配布、更新監視を行わない。
- 本番GTFSの正確性や事業者固有の全データ品質を、合成fixtureで保証しない。
- `pull_request_target`で未信頼のPull RequestへSecretを渡さない。
- app-configの外部URI取得、公開API、運用中のGTFS取得元を変更しない。
- Shape、Transfer、Fare、FeedInfoなど、現行Prismaモデルが利用しないデータを新たに永続化しない。

## Decisions

### 1. 設定欠落の判定をimport境界でfail-closedにする

`import-gtfs`の設定読み込み・入力取得エラーを成功終了へ変換せず、非ゼロ終了としてbuildへ返す。GTFS入力が空、必須エンティティを作れない、または参照先が解決できない場合も失敗させる。

CIだけで事前にファイルの存在を検査する方式は採用しない。CI検査だけではローカルbuildや他の実行経路で同じ欠陥が再発するため、実際のimport境界を正本にする。CIには早期に原因を表示する補助検証を置けるが、importの失敗判定を置き換えない。

設定欠落時だけを黙ってスキップするフラグは、設定し忘れを再び成功扱いにするため標準経路へ追加しない。

### 2. リポジトリ内に小規模な合成GTFSを置く

`ci/transit-config.json`と`ci/gtfs/`を追跡対象とする。設定は外部URLではなく、リポジトリ内のGTFSファイルを相対参照する。データは架空のagency、route、stop、trip、時刻、サービスだけで作成し、提供された本番ZIPの行、ID、名称、座標、URLは複製しない。

fixtureは1 agency、1 route、2〜3 stops、1 trip、1 shape程度に抑える。次の形式を意図的に含める。

- 日本語を含むservice/trip IDとゼロ埋めID
- 空のroute_short_nameと任意項目
- calendarとcalendar_datesの追加・削除例外
- 始端・終端のpickup/dropoff属性
- tripからshapeへの対応と距離列なし
- BOM、CRLF/LF混在、stop_timesの列順差

独自の`agency_jp.txt`と`office_jp.txt`は、現行importerが無視する入力である。buildの最小fixtureには含めず、未知ファイルの許容を独立に検証する必要が生じた場合だけ追加する。

### 3. CIはbuild直前にfixtureを明示配置する

既存のlint、型検査、依存インストールの流れは維持する。transit依存のbuildを開始する直前に、`ci/transit-config.json`をrootの`transit-config.json`へコピーし、`npm run build`へ渡す。rootの実ファイルは既存のignore境界に置き、fixtureの相対パスがCIの作業ディレクトリから解決できることを確認する。

この方式はSecretを必要としないため、通常の`pull_request`で使える。未信頼コードをcheckoutした`pull_request_target`へ切り替えない。本番Secretを使うtrusted push用jobを別に作ることも今回の必須条件にはしない。

### 4. テストは失敗伝播と実fixtureの両方を固定する

設定読み込みの失敗、GTFS入力元の欠落、取り込み結果が空になるケースを、import境界のテストで非ゼロ失敗として固定する。正常系では合成fixtureを使い、必須のagency、route、stop、trip、stop_time、サービス情報が取り込まれることを確認する。

workflowの契約テストは、CIがfixtureを用意してからbuildを実行すること、Secretや本番URLを参照しないことを検査する。可能な範囲でCI上の実`npm run build`も通し、ソース文字列だけの検査に留めない。

BOM、改行、列順、Unicode ID、空の任意項目などの形式差はfixtureまたはGTFS importerの入力テストで固定する。合成fixtureに含める差異は、importerが仕様上受け入れる差異と、回帰させたくない差異を分けて記録する。

### 5. ライセンス境界をファイル単位で明示する

本変更のfixtureは新規に作成した合成データとして扱い、本番CC BY 4.0データを収録しない。コードのAGPL表示がfixtureの第三者ライセンス表示を代替しないよう、将来第三者データを追加する場合はfixtureディレクトリ内に帰属情報と個別ライセンスを置く設計を維持する。

## Risks / Trade-offs

- [合成fixtureが本番GTFSの品質を代表しない] → importerの入力形式を再現する目的に限定し、本番データの品質検証とは別の検証経路として扱う。
- [fixtureの相対パスが実行ディレクトリに依存する] → CIでrootへ設定を配置してからbuildし、設定内の全ローカル参照をbuild前に解決確認する。
- [設定欠落を非ゼロ化すると既存のローカルbuildが失敗する] → `transit-config.json.example`からの準備方法を文書化し、これは意図したBREAKING変更として扱う。
- [GTFS importerのエラー伝播変更で既存の非致命的入力が失敗する] → 欠落・不正・空データだけを失敗条件にし、BOM、改行、列順、Unicode IDなど既に扱える形式は合成fixtureで回帰確認する。
- [CIでapp-configの外部取得が残る] → 本変更のtransit入力境界とapp-configの場所データ取得を分離し、ネットワーク依存の解消を別Changeへ切り出す。
- [将来、第三者データを誤ってAGPL扱いする] → fixtureとコードのライセンスを別ファイル・別説明で管理し、元データの帰属情報を必須レビュー項目にする。

## Migration Plan

1. import境界の失敗伝播テストを先に追加し、現在の設定欠落経路がREDになることを確認する。
2. GTFS importerの失敗伝播を修正し、空データと無効入力を非ゼロ終了にする。
3. 架空値だけで合成fixtureを作成し、正常系と確認した形式差のテストを追加する。
4. quality-gate workflowでbuild直前にfixtureを配置し、lint、型検査、build、疎通確認、Jestを実行する。
5. 全検証が成功した後、ローカル設定なしのbuildが失敗し、CIのfixture付きbuildが成功することを確認する。

この変更はデータベースの永続スキーマ移行を含まない。問題が発生した場合はChange全体をrevertできるが、revert後は設定欠落が成功扱いになるため、再適用時に失敗伝播とfixtureの両方を再検証する。
