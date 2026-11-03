# route-search-form 変更

## ADDED Requirements

### Requirement: 運行情報の外部案内リンク

入力画面は、最新の運行情報を確認できる風ぐるま公式バスロケーションシステム（https://kazaguruma.bus-go.com/sp/sp-busgo.php）へのリンクを表示しなければならない（SHALL）。案内の文言は「最新の運行情報はこちら【千代田区公式】」とする。

#### Scenario: 入力画面の運行情報案内

- **WHEN** 利用者が入力画面を開く
- **THEN** 「最新の運行情報はこちら【千代田区公式】」のリンクが表示され、選択するとバスロケーションシステムが新しいタブで開く
