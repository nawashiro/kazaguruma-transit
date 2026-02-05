# Research: 会話タブナビゲーション修正

## Decision 1

**Decision**: 既存の権限判定ロジックを流用し、作成者は承認+編集、モデレーターは承認のみを表示する
**Rationale**: 仕様で既存の条件をそのまま使用すると明記されており、差分を最小化できる
**Alternatives considered**: 権限判定の再設計 (却下: 仕様外)

## Decision 2

**Decision**: 旧ブロック表示の導線を撤去し、タブレイアウト内のリンクに集約する
**Rationale**: UIの一貫性と導線の重複排除が目的のため
**Alternatives considered**: 旧ブロック表示を残したまま併存 (却下: 仕様で削除が要求されている)

## Decision 3

**Decision**: 「会話に戻る」導線を編集/承認ページから削除する
**Rationale**: 仕様で明示的に削除が要求されているため
**Alternatives considered**: 文言変更のみで残す (却下: 仕様と矛盾)

## Notes

- 追加の技術的な不確定要素はなし
