# spec_v2.md 実装計画

## 概要

現在の管理者中心の会話システムを、一般ユーザーが会話を作成できるシステムに拡張する。NIP-72を使用した承認ベースの一覧システムを実装し、悪意のある操作を防ぐ。

## 現在の実装状況

### 既存機能
- `src/app/discussions/page.tsx` - 会話一覧画面（管理者向け）
- `src/app/discussions/[id]/page.tsx` - 会話詳細画面
- `src/app/discussions/manage/page.tsx` - 会話管理画面（管理者のみ）
- `src/app/discussions/[id]/approve/page.tsx` - 投稿承認画面
- `src/types/discussion.ts` - 型定義
- `src/lib/nostr/nostr-utils.ts` - Nostr関連ユーティリティ

### 現在のURL構造
- `/discussions` - 会話一覧
- `/discussions/[id]` - 会話詳細（id形式）
- `/discussions/manage` - 会話管理

## 実装が必要な変更

### 1. URL構造の変更（優先度: 高）

#### 変更前
```
/discussions/[id]          # 例: /discussions/bus-stop-chat
```

#### 変更後
```
/discussions/[naddr]       # 例: /discussions/naddr1abc...def
```

#### 実装箇所
- `src/app/discussions/[id]/page.tsx` → `src/app/discussions/[naddr]/page.tsx`
- `src/app/discussions/[id]/approve/page.tsx` → `src/app/discussions/[naddr]/approve/page.tsx`
- `src/app/discussions/[id]/layout.tsx` → `src/app/discussions/[naddr]/layout.tsx`
- `src/lib/nostr/nostr-utils.ts` に naddr エンコード/デコード関数を追加

#### 技術詳細
- `nostr-tools` の `naddrEncode/naddrDecode` を使用
- 既存の `dTag` ベースの識別からnaddr形式への移行
- ルーティング変更に伴うリンク更新

### 2. ユーザー会話作成フロー（優先度: 高）

#### 新規画面: `/discussions/create/`
- 3ステップ説明UI
  1. 作成すればURLが作られ、すぐに会話開始可能
  2. 会話一覧掲載は担当者確認後
  3. 投稿の手作業承認が必要
- 会話作成フォーム
- 作成完了メッセージとガイダンス

#### 実装箇所
- `src/app/discussions/create/page.tsx` - 新規作成
- 会話一覧への掲載リクエスト機能

### 3. 会話作成者用編集画面（優先度: 中）

#### 新規画面: `/discussions/[naddr]/edit`
- 会話作成者のみアクセス可能
- 既存の `discussions/manage` を参考に実装
- タイトル・説明・モデレーターの編集機能
- 会話削除機能

#### 実装箇所
- `src/app/discussions/[naddr]/edit/page.tsx` - 新規作成
- 権限チェック機能（作成者のみ）

### 4. 権限・表示の変更（優先度: 中）

#### 監査ログの変更
- 管理者・モデレーターのみ名前表示
- 一般ユーザーは「作成者」「モデレーター」badge表示
- プロファイル取得の制限

#### 実装箇所
- `src/components/discussion/AuditTimeline.tsx` - 表示ロジック変更
- `src/lib/nostr/nostr-utils.ts` - `createAuditTimeline` 関数の修正

### 5. 設定画面の拡張（優先度: 低）

#### 機能追加: `/settings`
- 自分が作成した会話一覧表示
- 会話削除機能
- 既存の設定画面に統合

#### 実装箇所
- `src/app/settings/page.tsx` - 既存画面に機能追加

## 技術的考慮事項

### NIP-72 承認ベース一覧
- 管理者作成の Kind:34550 で承認済み投稿を集約
- ユーザー作成の Kind:34550 への引用リンク
- `q` タグを使用した引用形式（NIP-18準拠）

### naddr実装
```typescript
// AddressPointer型の定義（既存）
export type AddressPointer = {
  identifier: string;  // dTag
  pubkey: string;      // 作成者pubkey
  kind: number;        // 34550
  relays?: string[];   // リレー情報
};

// 新規実装が必要
export function naddrEncode(addr: AddressPointer): string
export function naddrDecode(naddr: string): AddressPointer
export function parseNaddrFromUrl(naddr: string): AddressPointer | null
```

### 環境変数
```env
# spec_v2.md で言及された必要な環境変数
NEXT_PUBLIC_DISCUSSION_LIST_NADDR=naddr1... # 会話一覧画面のnaddr
NEXT_PUBLIC_ADMIN_PUBKEY=npub1...           # 管理者のnpub（既存）
```

## 実装順序

### フェーズ1: インフラ整備
1. naddr関連ユーティリティ関数実装
2. URL構造変更（[id] → [naddr]）
3. 既存機能の動作確認

### フェーズ2: ユーザー作成機能
1. `/discussions/create/` 画面実装
2. 会話作成フロー実装
3. 作成者編集画面実装

### フェーズ3: 権限・表示調整
1. 監査ログの表示変更
2. 権限チェック機能強化
3. 設定画面の機能追加

### フェーズ4: 統合・テスト
1. 全機能の統合テスト
2. NIP-72準拠の確認
3. UX改善

## リスク・注意点

### 互換性
- 既存のURL構造変更による影響
- 既存データのマイグレーション不要（naddr変換は動的）

### セキュリティ
- 作成者権限の適切な検証
- 悪意のある会話作成の防止
- モデレーション機能の確保

### パフォーマンス
- naddr変換処理のパフォーマンス
- 会話一覧の表示速度
- 大量の会話作成リクエスト処理

## テスト計画

### 単体テスト
- naddr エンコード/デコード関数
- 権限チェック関数
- バリデーション関数

### 統合テスト
- 会話作成フロー
- 承認フロー
- 権限チェック

### E2Eテスト
- ユーザー会話作成 → 承認 → 表示
- 編集・削除機能
- 権限に応じた画面表示

## 成功指標

- [ ] 一般ユーザーが会話を作成できる
- [ ] 管理者が会話作成リクエストを承認できる
- [ ] 会話作成者が自分の会話を編集・削除できる
- [ ] 監査ログで適切な権限管理が行われている
- [ ] naddr形式のURLが正常に動作する
- [ ] 既存機能が引き続き動作する

## 技術債務・改善案

### 現在のコード品質
- 型安全性は良好
- コンポーネント分離も適切
- エラーハンドリングが充実

### 改善が必要な箇所
- URL構造変更に伴うリンク更新の漏れ防止
- naddr変換の一元化
- 権限チェックの統一化

## 関連ドキュメント

- [NIP-18](NIP-18.md) - 引用仕様
- [NIP-72](NIP-72.md) - 承認ベース一覧
- [nostr-tools](nostr-tools.md) - naddr実装詳細
- [spec_v2.md](spec_v2.md) - 元仕様書