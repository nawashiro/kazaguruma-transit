# 経路検索フォームの検証記録

本記録は既存変更の検証結果をまとめる。新しい要件やタスクは追加しない。各結果は記載した実行時点のものであり、サイト全体のWCAG適合を宣言しない。`/tmp`の証拠は作業環境内の一時ファイルである。

## 実ブラウザの操作と出力

cupcake / darkの両テーマで、施設選択、GPS、住所のEnter検索、確定後のフォーカス、再編集、空結果からの再試行、通常のGET送信を確認した。住所検索は応答fixture、GPSはブラウザの位置情報APIへの座標・権限設定を使用した。Googleの実検索とGPS機器の測位は対象外である。注入した429では`/rate-limit?source=home`へ遷移した。

Rubyfulは通常のブラウザセキュリティで外部スクリプトとAPIを実際に使用した。POST 200と`.rubyful-rt`生成、キーボードでの4回の切替、保存済みON設定の復元を確認した。以前のCORS失敗は、検証用`x-forwarded-for`が外部APIにも送られた条件で起きた。成功した検証では同ヘッダーをlocalhostだけに限定し、`--disable-web-security`は使用していない。

両テーマで切替後のICS・PDFダウンロードが`completed`になった。ICSは605 bytes、メモなしPDFは284367 bytesで、日付・停留所・時刻が一致した。出力は既存の直通経路URLから検証しており、施設・GPS操作でその経路を得たという結果ではない。

非空メモは、制御した2件の短いNostrデータで別に検証した。実際の`RouteResultDiscussion`→`RouteResultActions`→`RoutePdfExport`→PDF API 200→ダウンロード→`pdftotext`の経路で、両テーマのPDF各297095 bytesに2件の本文を確認した。`selectedDateTime=2026-07-18T09:30`と停留所別`memoData`も保持した。取得境界・設定・メモ子UIはfixtureであり、実リレー通信、署名検証、moderation、子UIの表示は対象外である。PDF応答、props、state setterは置換していない。

証拠: `/tmp/route-final-real.log`、`/tmp/route-final-exports.log`、`/tmp/route-final-downloads/`、`/tmp/route-memo-{cupcake,dark}-evidence.json`、`/tmp/route-memo-downloads/`。

## 読み上げ・フォーカス・拡大

Orca 50.3 / AT-SPI 2.60.7の実行ログで、確定住所と空結果エラーの発話を確認した。エラーはlive-regionイベントとして処理された。これはスクリーンリーダーが生成した発話記録であり、音声の聴取確認ではない。住所の重複発話も記録に残る。共有デスクトップのフォーカス干渉があった初期操作は成功扱いにせず、明示的なフォーカス指定後の操作と独立したTab巡回を証拠とした。

入力・直通・乗換・経路なし画面は、両テーマの320 / 375 / 768 / 1024 / 1440 CSS pxで文書の横溢れなし。入力のラベル・legend・操作文字は16px以上、検索3か所は44×44pxだった。

Chromiumの`chrome.tabs.setZoom`によるネイティブ200%・400%拡大を確認した。1280px幅で`innerWidth`は640 / 320、DPRは2 / 4となり、両テーマの入力・結果で`scrollWidth=innerWidth`だった。別の文字サイズ200%シミュレーションと、失敗した初期ズーム操作を混同しない。

証拠: `/tmp/route-final-orca-speech-extract.log`、`/tmp/route-final-orca.log`、`/tmp/route-final-keyboard.log`、`/tmp/route-final-native-extension.log`、`/tmp/route-final-{input-widths,widths}.log`。

## 監査の再判定と配色

初回の既定5ルート監査は通常exit 0、strict exit 1だった。後続の修正・再実行では通常・strictともexit 0となった。全5ページのaccessibility、color-contrast、target-sizeは1.00。`label-content-name-mismatch`のscore=nullはnotApplicableであり、独立したpassとは扱わない。

スキップリンクがフォーカス中にメニューを覆う問題は実際に再現し、通常フローへの移動後に解消した。GPSのRubyful表示も、ルビ付き可視ラベルと基底文字の読み上げ用ラベルの分離後に再検証した。実Rubyful通信後のaxe 4.13.0で、非フォーカス・スキップリンクフォーカス・メニューフォーカスの各状態に両ルールの違反はなかった。監査ルールの抑制や除外は追加していない。

後続の`/tmp/button-contrast-green.log`は、実画面120状態とコンポーネント統合288状態を測定した。primary / secondary、アイコン、joined、loading / disabled、ルビON / OFF、通常・hover・active・focusを含む。両テーマを合わせた有効操作の最小比は、文字4.5342:1、境界6.5625:1、可視フォーカス5.4690:1だった。loading / disabledは非アクティブ操作のコントラスト例外として別扱いにし、`disabled`とloading時の`aria-busy=true`を確認した。初期の小さい配色fixtureだけを全状態の証拠とはしない。

証拠: `/tmp/route-audit-fixed-{normal,strict}/`、同名`.log`・`.exit`、`/tmp/route-audit-fixed.log`、`/tmp/button-contrast-green.log`。結果・不正条件・利用制限の追加3ルートもstrict exit 0だった（`/tmp/route-final-a11y-results/`）。

## RED / GREENと品質検査

RubyfulのDOM置換後のButton更新は`/tmp/ruby-button-red.log`で2件失敗、`/tmp/ruby-button-green.log`で14件成功を記録した。スキップリンクは`/tmp/route-skip-red.log`から`/tmp/route-skip-green.log`で失敗→成功を記録した。配色検証も`/tmp/button-contrast-red.log`の失敗と後続GREENを残した。これらは個別の回帰証拠であり、全変更のTDD履歴を代替しない。

隔離した作業ツリーのスナップショットでproduction buildとGTFS取込を実行し、実production HTTPに対する3 suites / 6 testsが成功した。同時点の全Jestは183 suites・1511 tests成功、2 suites・12 testsスキップだった。型検査と`npm run lint`も成功した。証拠は`/tmp/route-final-quality-logs/`にある。

専用マーカー`transit-button`への変更後、`/tmp/full-test-final.log`で183 suites・1515 tests成功、2 suites・12 testsスキップを確認した。型検査、ソースESLint、`npm run lint`、配色マトリクス、スキップリンク検証も再実行して成功した。最後の通常・strict監査はともにexit 0で、既定5ページすべてaccessibility・color-contrastが1.00だった（`/tmp/route-a11y-last.log`、`/tmp/route-a11y-strict-last.log`）。

master向けPRでは、別件のAnalytics変更を含めない専用ブランチへ今回の2コミットだけを移した。このブランチの全体テストは182 suites・1507 tests成功、2 suites・12 testsスキップだった（`/tmp/route-pr-tests-retry.log`）。初回は既存のdiscussion streamingテスト10件が失敗したが、同ファイルの単独実行と全体再実行は成功した。この不安定さを隠さず、上記の元ブランチの件数と区別する。PR用ブランチでも型検査・ソースESLint・`npm run lint`は成功した。

ESLint全体は未成功である。同品質検査の`npx eslint .`は生成`.next`を含み807 errors / 4454 warnings、`.next`除外後も2 errors / 47 warningsだった。残るエラーはNext生成`next-env.d.ts`のtriple-slash参照と、既存`tailwind.config.js`のrequireである。`src __tests__ scripts`の検査は0 errors / 42 warnings。`npm run lint`成功をリポジトリ全体のESLint成功と読み替えず、正しさのルールも無効化しない。

## 残る検証上の制約

非空メモの個別テーマ実行はpageerrorなしで成功したが、準備・再実行では断続的な`SyntaxError: Invalid or unexpected token`が残る。combined runは成功扱いにしない。検証ハーネス付近で観測した失敗の原因は未確定であり、アプリ不具合ともハーネスだけの問題とも断定しない。

長いメモの初期fixtureは既存PDF CSSで省略表示された。今回の短い非空メモの成功は、長文を省略せず出力する保証ではない。読み上げの音声聴取、実GPS測位、実Nostrリレーの一連の動作は未検証である。

参照元: `/tmp/route-final-verification.md`、`/tmp/route-final-quality.md`、`/tmp/route-audit-resolution.md`、`/tmp/route-memo-report.md`。初回報告の未解決監査と非空メモの証拠不足は上記の後続結果で更新し、未確定のハーネス安定性は留保する。

## 2026-10-26 レビュー対応（#149）の再検証

レビューのマージ阻害事項と追加指摘に対する、改定要件（design 1・2・5・8・10・12）の検証記録である。証拠の操作スクリプトは`/tmp/opencode/review-149-probes/`にある。

**RED / GREEN**。タスク9.1〜9.3、10.1、11.1〜11.3は、対応するコンポーネントテスト・CSS契約テスト・ページテストを先に追加または改め、失敗を確認してから実装して成功させた。対象は`DestinationSelector.test.tsx`（名前検索のDOM順）、`page.test.tsx`（住所検索2か所はアイコン専用、最終submitは可視文字と読み上げ名「経路を検索」）、`LocationFieldset.test.tsx`（なおすをfieldsetの直接の格子項目にしない）、`button-border-contract.test.ts`（新設。forced-colorsメディア外で`.transit-button`と`.my-toggle`が文字色の枠線を強制しない）、`IntegratedRouteDisplay.test.tsx`（区間の乗車停留所・路線名・降車停留所順、重複する「経路」見出しなし、路線名と停留所名の同サイズ）、`RouteSearchResults.test.tsx`（戻るリンクをflexで分割しない）。全体Jestは180 suites・1506 tests成功、6 tests失敗は既知の本番ポート3100接続拒否のみで、失敗内容は改定前と同じである。

**実ブラウザ（devとproduction）**。`next dev --turbopack`と`npm run build`後の`npm run start`を別々に起動し、Chromium（puppeteer）で実画面460pxを中心に確認した。両環境で、目的地の名前で検索が施設一覧よりDOM順・表示順とも先であること、最終submitの可視文字「経路を検索」と読み上げ名の一致、住所検索2か所がアイコン専用のまま別フォームを送信すること、確定後の「なおす」が内容幅84px（親394px）で全幅に伸びないこと、GPSボタンが226pxで内容幅であること、ページh1「経路検索結果」以外の重複見出しがないこと、区間が毎日新聞→神田ルート→神田公園出張所の順で路線名が停留所間にありbadgesと区切り線のスタイルを持つこと、を確認した。両テーマ（cupcake / dark）×320 / 1440pxで、戻るリンクの3つのルビが同一行（`display: block`、インラインの文として流れる）、横溢れなし、計測した全要素の算出フォントサイズ16px同一を確認した。ルビのON / OFF切替後もこれらを維持した。ICS・PDF出力はdevでクリックし、PDF API 200（バッファ426261バイト）とエラーなき完了を確認した。ダウンロード完了イベント自体は今回取得しておらず、両テーマでのICS・PDFのバイト一致は前節の既存記録に依る。

**装飾枠線とコントラスト**。`src/app/globals.css`から`.transit-button:not(:disabled)`の`border-color: currentColor`と`.my-toggle`の`border: 2px solid currentColor`を除き、DaisyUIとテーマの既定表現に戻した。forced-colorsメディアの枠線と可視フォーカスは残す。`scripts/check-button-contrast.mjs`の境界判定を、文字かアイコンで識別できる操作の装飾枠線を対象外とする規則へ改めた（[Understanding 1.4.11 Boundaries](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html#boundaries)照合）。改定後の実行でapp 120状態・コンポーネント統合288状態が全成功し、既定・cupcake・darkの3テーマを含む。

**監査と品質検査**。本番サーバーに対し`npm run accessibility`と`npm run accessibility:strict`を再実行し、ともにexit 0、全ページaccessibility・color-contrast 1.00だった（`artifacts/lighthouse/`）。`npx tsc --noEmit --incremental false`、`npx eslint src scripts`（0 errors / 42 warnings）、`npm run lint`（成功、既存warningのみ）を確認した。

**SyntaxErrorの調査（design 12・タスク12.1）**。devとproductionを分けて実ブラウザで計36回以上のロード（7画面×3周、コールド起動直後、15セッションの並行遷移、ルビ切替3回、フォーム入力・送信、結果画面、ICS・PDF出力）を行い、pageerror・console・応答を収集した。アプリが配信するスクリプト（dev チャンク、インラインflight、外部Rubyful v2）からは1件もSyntaxError・Unexpected tokenを観測しなかった。観測した失敗は外部のみである（Ko-fiウィジェットの`ERR_BLOCKED_BY_RESPONSE`、Nostrリレー`wss://purplepag.es`の握手502。サンドボックスの外部経路に起因）。既存記録が留保する「検証ハーネス付近で観測した断続的な`SyntaxError: Invalid or unexpected token`」は、このクリーンな操作系では再現せず、アプリの配信文字列ではなくハーネス注入文字列側のAttributionを示す証拠と整合する。アプリ側の文字列生成・配信に原因箇所を特定できなかったため、アプリコードの修正対象はない。レビュアー環境で再発した場合は、失敗したスクリプトURLと行・列、配信応答の取得によって配信文字列と注入文字列を区別する。
