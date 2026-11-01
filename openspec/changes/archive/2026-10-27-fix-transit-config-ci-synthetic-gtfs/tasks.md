## 1. Import失敗境界

- [x] 1.1 transit-configが欠落・不正な場合とGTFS入力元が存在しない場合のREDテストを追加し、現状の成功終了を再現してテストが失敗することを確認する
- [x] 1.2 GTFS取り込みの設定読み込み・入力取得エラーを非ゼロ終了へ伝播させ、1.1の失敗系テストがGREENになることを確認する
- [x] 1.3 必須エンティティを取り込めない空データをbuild失敗として扱い、空データの警告だけでは成功しないテストがGREENになることを確認する

## 2. 合成GTFS fixture

- [x] 2.1 架空のagency、route、stop、trip、stop_times、service、shapeからなる最小GTFSファイル群を`ci/gtfs/`へ追加し、実在データの名称・ID・座標・URLが含まれないことを確認する
- [x] 2.2 `ci/transit-config.json`を追加し、外部URLではなく`ci/gtfs/`のローカル入力元を参照することを設定検証で確認する
- [x] 2.3 日本語を含むID、ゼロ埋めID、空の任意項目、空のroute_short_name、calendar_datesの追加・削除例外、終端pickup/dropoffをfixtureへ含め、GTFS取り込みテストが必須データを保持してGREENになることを確認する
- [x] 2.4 BOM、CRLF/LF混在、stop_timesの列順差、shape_dist_traveledなし、fare_rulesなしをfixtureまたは入力テストで検証し、対応する形式差で取り込みが失敗しないことを確認する

## 3. Quality Gate連携

- [x] 3.1 `quality-gate.yml`でlintと型検査の後、build直前に合成transit-configをrootへ配置してから`npm run build`を実行し、CI設定の契約テストが配置順を確認する
- [x] 3.2 CIのtransit入力がGitHub Secret、本番GTFS、外部GTFS URL、`pull_request_target`に依存しないことをworkflow契約テストで確認する
- [x] 3.3 fixtureの相対パス、root配置、終了時の一時ファイル境界をCI上で確認し、合成fixture付きbuildが非ゼロ終了なしで完了することを確認する

## 4. ローカル・CI統合検証

- [x] 4.1 合成fixtureを配置した`npm run build`を実行し、GTFS取り込み、Next.js build、生成物の存在を確認する
- [x] 4.2 rootのtransit-configを除いた状態で`npm run build`を実行し、設定欠落が非ゼロ終了になることを確認する
- [x] 4.3 lint、型検査、対象テスト、全Jestを実行し、既存のアプリケーション契約と新しい失敗境界がGREENになることを確認する

## 5. 利用方法とライセンス境界

- [x] 5.1 ローカル開発者が`transit-config.json.example`から設定を準備する手順と、設定なしbuildが意図的に失敗することをREADMEへ記載し、手順と実際の終了状態を確認する
- [x] 5.2 合成fixtureが本番CC BY 4.0データの複製でないこと、アプリケーションコードとfixtureのライセンス境界を文書化し、fixture内に実データの識別情報がないことを確認する
- [x] 5.3 OpenSpecの全成果物と実装差分を`openspec validate --all --json`で検証し、Changeのstatusが全必須成果物完了になることを確認する
