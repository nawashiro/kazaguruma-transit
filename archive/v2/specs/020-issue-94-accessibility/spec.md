# Issue #94: 主要画面のアクセシビリティ回帰修正

## 背景

Issue #94 は、現行の `dev` ブランチにおける次のアクセシビリティ上の疑いを修正する。

- `/` でTabを2回押すと、現在位置が分からなくなる可能性がある。
- `/routes` の検索読み込み時に、古い `role="alert"` が残る可能性がある。

## User Stories

### US1 (P1): ホームのキーボードフォーカス位置が可視である

キーボード利用者として、ホーム画面でTab移動したとき、見た目のない制御要素へフォーカスが吸われず、次に操作できるメニューまたは本文の位置を把握したい。

**独立した確認方法**:

- 共通レイアウトを描画し、drawer制御用の内部checkboxがTab順から除外されていることを確認する。
- メニューボタンが通常のbuttonとしてフォーカス可能であり、drawerの開閉制御を維持していることを確認する。

### US2 (P1): 経路検索の読み込み状態が古い警告を表示しない

経路検索を再実行する利用者として、新しい検索条件の読み込み中は前回のエラー警告が残らず、検索中であることだけがステータスメッセージとして通知される状態を確認したい。

**独立した確認方法**:

- 一度APIエラーを表示した後、別の検索条件へ遷移させ、未解決のfetch中に `role="alert"` が存在しないことを確認する。
- 初回読み込みでは `role="status"` が表示され、APIエラー時には従来どおり `role="alert"` と復帰リンクが表示されることを確認する。

## 受け入れ条件

- [ ] drawerの内部checkboxはキーボードのTab順に含まれず、実際のメニューボタンが操作可能である。
- [ ] `/routes` の初回・検索条件変更後の読み込み中に `role="alert"` が表示されない。
- [ ] `/routes` の入力不備・APIエラー・レート制限の利用者向け警告は維持される。
- [ ] 既存の見た目、検索APIのURL、レート制限ページへの遷移、検索結果表示を変更しない。
- [ ] 新規永続化、DB/Prisma、Nostr、GTFS、外部API契約の変更を行わない。
- [ ] 回帰テストを本番コードより先に追加し、REDを確認する。
- [ ] strict TypeScript、Lint、Jest、Build、`git diff --check`を実行し、結果を分離して記録する。

## 対象範囲

- `src/components/layouts/SidebarLayout.tsx`
- `src/components/layouts/__tests__/SidebarLayout.test.tsx`
- `src/components/features/RouteSearchResults.tsx`
- `src/app/routes/__tests__/page.test.tsx`
- Issue #94 の設計・タスクリスト文書

## 対象外

- Sidebar全体のナビゲーション構造やDaisyUIの置換
- `/routes` のエラー文言やAPI処理の再設計
- 他画面の `role="alert"` の一括変更
- DBスキーマ、Nostrイベント、GTFSデータ、永続化形式の変更
