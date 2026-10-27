# 2026-10-27 独立検証

対象: dev `03203a7246e380ae7e31228d29b65400bfdeec41`。憲章を確認し、独立したチェックアウトとLocal VMで検証した。結論はアーカイブ不可。

## 2.1 管理設定: 完了

利用者による変更後、接続済みGoogle Analyticsアカウントから管理APIをGETした。こちらから設定変更は行っていない。

- 対象: property `484911547`、stream `10607728345`、測定ID `G-RD0ELFR3RW`。
- 取得先: `https://analyticsadmin.googleapis.com/v1alpha/properties/484911547/dataStreams/10607728345/enhancedMeasurementSettings`。
- 応答の `streamEnabled` はtrue。`pageChangesEnabled` と `outboundClicksEnabled` は省略されており、protobuf JSONの既定値falseとして履歴変更ページビューと外部リンク自動計測の無効化を確認した。
- scrolls、siteSearch、videoEngagement、fileDownloads、formInteractionsはtrueだった。管理画面を目視したという記録ではなく、管理APIによる設定値確認である。

## 2.2 実送信: 未完了

対象コミットをbuild/startした `http://127.0.0.1:3102` で、座標・日時クエリとフラグメント付きの結果URLを開き、実検索結果とPDF出力を確認した。FirefoxのコンソールでdataLayerを読み取った結果は次のとおり。

```json
[["set",{"page_path":"/routes","page_location":"http://127.0.0.1:3102/routes","page_referrer":""}],["config","G-RD0ELFR3RW",{"send_page_view":false}],["event","page_view",{"page_path":"/routes","page_location":"http://127.0.0.1:3102/routes","page_referrer":""}]]
```

この観測ではクエリ・フラグメントが除去され、page_viewは1件だけキューに入っていた。しかし、これは送信済みの証拠ではない。ネットワーク欄で確認できたcollectはKo-fi側の別測定ID `G-M13FZ7VQ2C` であり、アプリの測定IDについて初期表示・遷移・外部リンク操作の送信内容と重複を確認できていない。ブラウザの追跡防止もあるため、送信されない原因をアプリの不具合と断定しない。

共有URLによる検索再現は部分確認済みだが、必要な実送信の証拠が不足している。2.2は未完了のまま残す。認証情報や未加工の通信記録は保存しない。
