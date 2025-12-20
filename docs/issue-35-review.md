# #35 コードレビュー

## 指摘（重要度順）
- 高: 監査ログタブ切替時に `loadAuditData` が実行されず、イベントが表示されない可能性があります。`src/app/discussions/page.tsx:193` と `src/app/discussions/[naddr]/page.tsx:585` でタブ切替時に `auditLogSectionRef.current?.loadAuditData()` を呼びますが、`AuditLogSection` は `activeTab === "audit"` のときだけマウントされるため、クリック直後は `ref` が `null` で読み込みが走りません。結果として監査ログが空のままになる恐れがあります。対応案: 親側で `useEffect` による `activeTab` 監視でマウント後に呼ぶ、もしくは `AuditLogSection` 側で初回マウント時に `loadAuditData` を自動実行する。
- 中: 監査ログ用の投稿ストリームがアンマウント時にクリーンアップされません。`src/components/discussion/AuditLogSection.tsx:320` で `approvalStreamCleanupRef` のみ停止しており `postStreamCleanupRef` が残ります。タブ切替や遷移で重複購読・メモリリークが発生し、イベント順序や表示が不安定になる可能性があります。対応案: cleanup で `postStreamCleanupRef.current?.()` も停止する。
- 低: `area-selected` 属性は ARIA 仕様外のため、選択状態が支援技術に伝わりません。`src/app/discussions/page.tsx:217` と `src/app/discussions/[naddr]/page.tsx:572` は `aria-selected` に修正が必要です。

## テスト観点
- 監査ログタブ切替時の初回ロードが走ることのRTLテストが不足しています。`AuditLogSection` の `loadAuditData` が一度だけ実行され、監査イベントが描画されることを確認したいです。
- タブのアンマウント後にストリームが停止することのテストがありません。cleanup の呼び出しを検証するテスト追加を検討してください。

## 補足/質問
- 監査ログの読み込みはタブ表示と同時に自動起動する設計で良いでしょうか。明示的なユーザー操作を要求する意図がある場合、UI側に読み込みボタンなどの誘導が必要になります。

関連: #35
