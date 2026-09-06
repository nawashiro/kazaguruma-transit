# Issue #79 実装計画

正本は[Spec Kitのplan.md](../../specs/023-location-pages-route-form/plan.md)とする。

- 仕様: [spec.md](../../specs/023-location-pages-route-form/spec.md)
- 調査: [research.md](../../specs/023-location-pages-route-form/research.md)
- データモデル: [data-model.md](../../specs/023-location-pages-route-form/data-model.md)
- URL契約: [ui-url-contract.md](../../specs/023-location-pages-route-form/contracts/ui-url-contract.md)
- 検証: [quickstart.md](../../specs/023-location-pages-route-form/quickstart.md)

このIssueでは、単一のビルド用データスナップショット、全件事前生成の施設ページ、部分入力URL、単一のネイティブ検索フォームを実装する。旧詳細URLとJSON目的地引渡しは残さない。429利用制限遷移は既存どおり維持する。
