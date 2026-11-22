# Tasks

## 1. 目録の再生成

- [x] 1.1 `npm run update-destinations`を実行し、標準エラーに`追加:`が15件出て、`削除:`と`掲載解除:`が出ないことを確認する。
- [x] 1.2 `git diff data/destinations.json`を確認し、差分が新規15件の追加だけで、既存entryの名前と`includeInRouteForm`が変わっていないことを確かめる。

## 2. 掲載選択

- [x] 2.1 `design.md`の表に挙げた小学校8件と病院6件の`includeInRouteForm`を`true`にし、映画館CINEMALICE（`urn:uuid:01a1d8cc-5f68-7070-9a8e-bded3ad47398`）は`false`のままにする。
- [x] 2.2 Node.jsかjqで目録を読み、entryが85件、`includeInRouteForm: true`が36件、対象14件がすべて`true`、映画館が`false`であることを確認する。

## 3. ビルドと表示の確認

- [x] 3.1 `npm run build`を実行し、成功することを確認する。
- [x] 3.2 `public/generated/location-data.json`を読み、カテゴリが8件、表示が35件、`小学校`が8件、`病院`が6件で、小学校が「その他の社会福祉施設」と「図書館」の間、病院が「図書館」の後ろに並ぶことを確認する。
- [x] 3.3 `npm test`を実行し、既存のテストが通ることを確認する。
- [x] 3.4 ルートページを開き、「よく利用される施設から選択」に「小学校」と「病院」が表示され、施設を選ぶと目的地に設定されることを確認する。

## Workflow follow-up

- レビューを終えたら、このchangeをarchiveする。
