# Tasks

## 1. バリアフリー情報と状態バッジ

- [ ] 1.1 `src/components/features/__tests__/BarrierAccessibility.test.tsx`を追加し、全面=成功色、一部=警告色、非対応=エラー色、情報なし=無彩色の塗りバッジ、読み上げ順「車いす」「一部」、セクション内に「情報源: OpenStreetMap」がないことを検証する。`npm run test:unit -- src/components/features/__tests__/BarrierAccessibility.test.tsx`が失敗することを確認する。
- [ ] 1.2 `BarrierAccessibility.tsx`に状態と意味色の対応関数を追加し、`BarrierBadge`を`badge-outline`から意味色の塗りバッジへ変える。アイコンは`size-5`、代替テキストは`sr-only`の「車いす」で与える。1.1のテストが通ることを確認する。
- [ ] 1.3 `BarrierDetailBlock`から`rounded-box border-l-4 bg-base-200 p-4`の入れ子ブロックと「情報源: OpenStreetMap」を削除し、セクション直下に見出し、バッジ、説明文、参照リンク、関連ページを置く。`npm run test:unit -- src/app/locations/location-detail/[id]/__tests__/page.test.tsx`でバリアフリー節の検証が通ることを確認する。
- [ ] 1.4 `page.test.tsx`と`src/app/__tests__/accessibility-source-contract.test.ts`の「情報源: OpenStreetMap」前提を、代替テキストと出典の非重複を確認する内容へ更新する。`npm run test:unit -- src/app/__tests__/accessibility-source-contract.test.ts "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が通ることを確認する。

## 2. 場所詳細の操作ボタン

- [ ] 2.1 `page.visual-contract.test.tsx`に、編集リンクとバリアフリーの参照リンクが`btn-secondary`で、`btn-outline`を持たず、`rounded-full`と`dark:rounded-sm`、`min-h-[44px]`、`text-base`を持つことを検証するテストを追加する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.visual-contract.test.tsx"`が失敗することを確認する。
- [ ] 2.2 `EditLocationLink`とバリアフリーの参照リンクのクラスを、既存の「ここへ行く」に合わせて`btn btn-secondary`、`rounded-full dark:rounded-sm`、`min-h-[44px]`、`gap-2`、`whitespace-normal`へ変える。参照リンクの可視文言は「詳細を見る・編集する（WheelMapを開きます）」の1文にする。2.1のテストが通ることを確認する。
- [ ] 2.3 `page.test.tsx`の編集リンクと参照リンクのアクセシブルな名前、`target`、`rel`の検証が変わらず通ることを確認する。

## 3. 基本情報の行揃え

- [ ] 3.1 `page.visual-contract.test.tsx`に、基本情報の各`list-row`が`items-center`を持ち、dtとddの文字が16px以上で同じであることを検証するテストを追加する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.visual-contract.test.tsx"`が失敗することを確認する。
- [ ] 3.2 `BasicInfoSection`の各行に`items-center`を追加し、dtとddの文字サイズを16pxで揃える。リンクの`min-h-[44px]`は残す。3.1のテストが通ることを確認する。

## 4. 提供元の単一表示

- [ ] 4.1 `page.test.tsx`と`page.visual-contract.test.tsx`に、提供元のOpenStreetMapリンクが1件だけであること、「座標・電話・ウェブサイト・営業時間」の列挙、バリアフリー情報の個別行、画像の個別行がないこと、施設情報とバリアフリー情報の出典が1文で分かることを検証するテストを追加する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が失敗することを確認する。
- [ ] 4.2 `ProviderSection`を、OpenStreetMap contributors（ODbL 1.0）へのリンクと、施設情報とバリアフリー情報（wheelchairタグ）の出典を述べる1段落に置き換える。新しいタブで開くことを`sr-only`で伝える。4.1のテストが通ることを確認する。
- [ ] 4.3 `page.test.tsx`の提供元の並び順（基本情報の後）と`OpenStreetMap contributors`の表示の検証が通ることを確認する。

## 5. 営業状態のバッジ

- [ ] 5.1 `page.test.tsx`と`page.visual-contract.test.tsx`に、営業中と24時間営業が成功色、営業時間外がエラー色の塗りバッジで、状態文言を含むこと、解釈できない規則ではバッジを出さないことを検証するテストを追加する。`npm run test:unit -- "src/app/locations/location-detail/[id]/__tests__/page.test.tsx"`が失敗することを確認する。
- [ ] 5.2 `OpeningHoursSection`の状態表示を`badge badge-success`または`badge badge-error`にし、次に変わる時刻はバッジの外に置く。24時間営業も成功色のバッジにする。解釈できない規則はバッジを出さない。5.1のテストが通ることを確認する。
- [ ] 5.3 `page.visual-contract.test.tsx`の営業状態の文字サイズと`time`要素の検証が通ることを確認する。

## 6. 一覧カードの写真帰属と角丸

- [ ] 6.1 `page.visual-contract.test.tsx`に、場所カードがリンクそのものであること、`figure`がカードの最初の子であること、作者とライセンスが`card-body`内の`dl`の`dt`/`dd`で示されること、コロンとスラッシュを使わないこと、ライセンスがリンクでないこと、画像の上端だけが角丸になることを検証するテストを追加する。`npm run test:unit -- "src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx"`が失敗することを確認する。
- [ ] 6.2 `LocationSummary`を、`Link`をカードのルートにし、`figure`を最初の子、`card-body`に場所名・バッジ・地域・帰属の`dl`を置く構造へ変える。帰属は`gap-x-4 gap-y-1`で区切り、ライセンスのリンクを削除する。6.1のテストが通ることを確認する。
- [ ] 6.3 `docs/how-to/update-location-data.md`のライセンス表示を、一覧はテキスト、詳細だけがURIへのリンクを持つ記述へ更新する。記載どおりに一覧と詳細の表示を確認する。
- [ ] 6.4 `page.visual-contract.test.tsx`のカード、見出し、地域、画像、長い名前の検証が引き続き通ることを確認する。

## 7. 統合確認

- [ ] 7.1 `npm run test:unit`を実行し、場所ページと関連コンポーネントのテストがすべて通ることを確認する。
- [ ] 7.2 `npm run lint`と`npx tsc --noEmit`を実行し、警告と型エラーがないことを確認する。
- [ ] 7.3 開発サーバーを起動し、場所一覧と場所詳細をライトテーマとダークテーマで表示する。バッジの塗りとコントラスト、ボタンの角丸、基本情報の行揃え、提供元の1件表示、写真の角丸を目視で確認する。
- [ ] 7.4 ブラウザを起動できる環境では`npm run accessibility:strict`を実行し、対象ページの違反がないことを確認する。起動できない場合は、その旨と代替の目視確認の結果を作業記録に残す。

## Workflow follow-up

- レビュー要件を満たしたあと、この変更をアーカイブする。
- アーカイブ後に`location-ui`仕様とメイン仕様の整合を確認する。
