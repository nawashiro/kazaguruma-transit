# Tasks

## 1. 車いす情報とバリアフリー情報の分割

- [x] 1.1 `page.test.tsx`と`src/components/features/__tests__/BarrierAccessibility.test.tsx`に、場所詳細が「車いす情報」と「バリアフリー情報」の2つの見出しを持ち、車いす情報に状態バッジ・説明文・参照リンクがあり、バリアフリー情報には関連ページのリンクだけがあることを検証するテストを追加する。関連ページがないときはバリアフリー情報の見出しが出ないことも検証する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が失敗することを確認する。
- [x] 1.2 `BarrierAccessibility.tsx`を、車いす情報のセクションとバリアフリー情報のセクションに分ける。`BarrierBadge`と`getWheelchairStatus`は共有し、関連ページがないときはバリアフリー情報を描画しない。1.1のテストが通ることを確認する。
- [x] 1.3 状態バッジと説明文を`flex flex-wrap items-center gap-2`の行に置き、バッジに`whitespace-nowrap`を付ける。状態が情報なしの説明文を「追加してください。」に変え、「バリアフリー情報がありません。」を表示しないことをテストで確認する。
- [x] 1.4 状態バッジと参照リンクが`.ruby-text`の内側にないこと、見出しと説明文には`ruby-text`があることを検証するテストを追加する。`npm run test:unit -- src/components/features/__tests__/BarrierAccessibility.test.tsx src/app/__tests__/span-structure-contract.test.ts src/app/__tests__/accessibility-source-contract.test.ts`が失敗することを確認する。
- [x] 1.5 セクション全体の`ruby-text`を外し、見出し・説明文・リンク名に付ける。バッジとボタンは`.ruby-text`の外に置く。1.4のテストが通ることを確認する。
- [x] 1.6 `page.test.tsx`のバリアフリー節の取得方法と、`accessibility-source-contract.test.ts`の見出し・文言の契約を新しいセクション構成に合わせる。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx" src/app/__tests__/accessibility-source-contract.test.ts`が通ることを確認する。

## 2. 参照リンクの文言とボタン

- [x] 2.1 `src/lib/location/__tests__/wheelchair-status.test.ts`と`BarrierAccessibility.test.tsx`、`page.test.tsx`の期待値を「編集する（WheelMapを開きます）」「追加する（WheelMapを開きます）」に変え、「詳細を見る」を含まないことを検証するテストを追加する。`npm run test:unit -- src/lib/location/__tests__/wheelchair-status.test.ts`が失敗することを確認する。
- [x] 2.2 `wheelchair-status.ts`の`linkLabelMain`を「編集する」「追加する」に変え、relationは「編集する」にする。`BarrierAccessibility.tsx`は主文言と副文言を1つの`span`に連結する。2.1のテストが通ることを確認する。
- [x] 2.3 参照リンクの`target`、`rel`、`sr-only`の「新しいタブで開きます」、`aria-label`を使わない契約が変わらず通ることを確認する。
- [x] 2.4 編集リンクと参照リンクから`py-2`を外し、`h-auto min-h-[44px]`と`btn`の中央揃えに戻す。ラベルが上端に寄らないことを、`h-auto`・`min-h-[44px]`・`.ruby-text`外であることのクラス契約で確認する。

## 3. 営業時間を基本情報へ移す

- [x] 3.1 `page.test.tsx`に、基本情報の中に「営業状態」と「営業時間」の行があり、営業状態の行に状態バッジ、次に変わる時刻、祝日の警告、目安の注意書き、営業時間の行に一週間の一覧と目安の注意書きがあることを検証するテストを追加する。基本情報の外に「営業時間」の見出しがないことも検証する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が失敗することを確認する。
- [x] 3.2 `OpeningHoursSection`を独立したセクションとして描画するのをやめ、`BasicInfoSection`の中で営業状態と営業時間の行を出す。基本情報の表示条件に営業時間を加え、`LocationDetailContent`から独立セクションを外す。3.1のテストが通ることを確認する。
- [x] 3.3 営業状態の行は注意書きで複数行になるため`items-start`、営業時間の行も`items-start`で揃える。規則がないときは2行とも出さず、解釈できないときは営業状態の行を出さずに営業時間の行へ生の規則と目安の注意書きだけを出し、祝日の警告を出さないことをテストで確認する。
- [x] 3.4 `WeekSchedule`の先頭の日付表示を「今日」に変える。固定した日時で、先頭が「今日」、2日目以降が日付と曜日、`time`の`dateTime`が当日のままであることを検証する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が通ることを確認する。
- [x] 3.5 営業時間の一覧を`.ruby-text`の外に置き、日付・曜日・時間帯にルビが付かないことを検証するテストを追加する。`page.visual-contract.test.tsx`で一覧の`time`要素が`.ruby-text`の内側にないことを確認する。
- [x] 3.6 `docs/how-to/update-location-data.md`の営業時間の配置を、基本情報の中の「営業状態」「営業時間」の2行に更新する。記載どおりに画面を確認する。

## 4. 出典の行内表示と編集リンク

- [x] 4.1 `page.test.tsx`と`page.visual-contract.test.tsx`に、独立した「提供」セクションがないこと、車いす情報の状態・説明の直後に「© OpenStreetMap contributors ODbL-1.0」があること、基本情報の情報行の直後に同じ出典行があること、編集リンクが基本情報の最後にあることを検証するテストを追加する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が失敗することを確認する。
- [x] 4.2 `ProviderSection`を削除し、車いす情報と基本情報の直後に出典行を描画する。`OpenStreetMap contributors`を著作権ページへのリンクにする。出典行は`.ruby-text`の外に置く。4.1のテストが通ることを確認する。
- [x] 4.3 `EditLocationLink`を`LocationDetailContent`の先頭から外し、`BasicInfoSection`の最後へ移す。基本情報は電話・ウェブサイト・Wikipedia・営業時間・編集リンクのどれかがあれば表示し、編集リンクだけでも表示する。`page.test.tsx`の上部の編集リンクを前提にした検証を、基本情報末尾の検証へ更新する。
- [x] 4.4 `page.test.tsx`に、編集リンクだけで基本情報が表示されること、基本情報が空なら表示されないことを検証するテストを追加する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が通ることを確認する。
- [x] 4.5 `accessibility-source-contract.test.ts`の提供元・編集リンクのソース契約を、出典行と基本情報末尾の編集リンクへ更新する。`npm run test:unit -- src/app/__tests__/accessibility-source-contract.test.ts`が通ることを確認する。
- [x] 4.6 `docs/how-to/update-location-data.md`の出典と編集リンクの記述を、独立した提供元セクションを置かず、車いす情報と基本情報の直後に出典を出す形へ更新する。

## 5. 写真帰属を1行にする

- [x] 5.1 `src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx`に、帰属が「写真 さくら・CC BY-SA 4.0」の1行で、`dl`と「ライセンス」の別ラベルがなく、カード内にライセンスリンクがないことを検証するテストを追加する。`npm run test:unit -- "src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx"`が失敗することを確認する。
- [x] 5.2 `LocationSummary`の帰属を`<p className="text-base">写真 {作者}・{ライセンス}</p>`に変える。カードのリンク構造、`figure`を最初の子に置く構造、上端だけの角丸は変えない。5.1のテストが通ることを確認する。
- [x] 5.3 `docs/how-to/update-location-data.md`の画像帰属を、一覧は「写真 作者・ライセンス」の1行、詳細だけがライセンスリンクを持つ記述に更新する。

## 6. 一覧の情報なしバッジ

- [x] 6.1 `BarrierAccessibility.test.tsx`と`src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx`に、`wheelchair`が`null`または未知でも「情報なし」の無彩色バッジを表示すること、既知の3状態は意味色のバッジを表示することを検証するテストを追加する。`npm run test:unit -- src/components/features/__tests__/BarrierAccessibility.test.tsx`が失敗することを確認する。
- [x] 6.2 `BarrierBadge`の`null`返却をやめ、`null`と未知の値を「情報なし」として`WheelchairStatusBadge`に渡す。一覧のカードは常にバッジを持つ。6.1のテストが通ることを確認する。
- [x] 6.3 `wheelchair-accessibility`の一覧バッジに関するテストと`accessibility-source-contract.test.ts`を、情報なしも表示する契約へ更新する。`npm run test:unit -- "src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx" src/app/__tests__/accessibility-source-contract.test.ts`が通ることを確認する。

## 7. 統合確認

- [x] 7.1 `PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH" npm run test:unit`を実行し、全スイートが通ることを確認する。
- [x] 7.2 `npm run lint`と`npx tsc --noEmit`を実行し、エラーがないことを確認する。
- [x] 7.3 開発サーバーを起動し、ルビON・OFFの両方で場所詳細と一覧を表示する。営業時間外のバッジが1行、車いす情報の状態と説明が横一列、参照ボタンのラベルが中央、基本情報に営業状態と営業時間の行と出典、編集リンクが最後、一覧の先頭が「今日」、一覧の情報なしバッジ、写真帰属が1行であることを確認する。ブラウザを起動できない場合は、SSR HTMLで同じ構造を確認し、その旨を作業記録に残す。
- [x] 7.4 ブラウザを起動できる環境では`npm run accessibility:strict`を実行し、対象ページの違反がないことを確認する。起動できない場合は、その旨を作業記録に残す。
  - 2026-11-18: ローカルのChrome共有ライブラリでLighthouseを実行し、場所一覧と場所詳細のaccessibilityとcolor-contrastは1.00だった。

## Workflow follow-up

- レビュー要件を満たしたあと、この変更をアーカイブする。
- アーカイブ後に`location-ui`、`wheelchair-accessibility`、`opening-hours`、`location-facts`の整合を確認する。
