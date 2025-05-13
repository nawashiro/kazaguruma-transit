# SCRUM-15: 実装計画

## 1. 変更が必要なファイルのリスト

### 削除対象のファイル

1. **コンポーネント**

   - `src/components/SupporterRegistration.tsx`
   - `src/components/SupporterRegistrationModal.tsx`
   - `src/components/KofiSupportCard.tsx`

2. **API エンドポイント**
   - `src/app/api/auth/supporter/*` 配下の全ファイル
   - `src/app/api/auth/session/*` 配下の全ファイル
   - `src/app/api/auth/logout/*` 配下の全ファイル

### 修正が必要なファイル

1. **コンポーネント**

   - `src/components/AuthStatus.tsx` - 認証状態表示の削除または情報表示への変更
   - `src/components/Sidebar.tsx` - Ko-fi サポートリンクの変更、メニュー構成の調整

2. **データベース**

   - `prisma/schema.prisma` - `Supporter`と`AuthRateLimit`モデルの削除

3. **設定ファイル**
   - レート制限の調整（おそらく`src/app/api/transit/*/route.ts`などに存在）

## 2. 実装手順

### フェーズ 1: バックエンド変更

1. **データベーススキーマの更新**

   ```prisma
   // prisma/schema.prisma から以下のモデルを削除
   model AuthRateLimit {
     id              Int      @id @default(autoincrement())
     ip              String
     action_type     String
     count           Int      @default(1)
     first_attempt   BigInt
     last_attempt    BigInt

     @@unique([ip, action_type])
     @@map("auth_rate_limits")
   }

   model Supporter {
     email           String   @id
     verification_code String?
     code_expires    BigInt?
     verified        Boolean  @default(false)
     verified_at     BigInt?

     @@map("supporters")
   }
   ```

2. **マイグレーションファイルの作成**

   ```bash
   cd repo
   npx prisma migrate dev --name remove_auth_tables
   ```

3. **認証関連 API エンドポイントの削除**

   - `src/app/api/auth/` 配下の全ファイルを削除

4. **レート制限の調整**
   - レート制限に関連するファイル（例: `src/app/api/transit/route.ts`）を特定し、制限値を緩和

### フェーズ 2: フロントエンド変更

1. **コンポーネント削除**

   - `src/components/SupporterRegistration.tsx`を削除
   - `src/components/SupporterRegistrationModal.tsx`を削除
   - `src/components/KofiSupportCard.tsx`を削除

2. **サイドバーの更新**

   ```tsx
   // src/components/Sidebar.tsx の Ko-fiリンク部分を区の問い合わせ情報に変更
   <ul className="menu bg-base-200 w-full text-xl">
     <li>
       <Link href="/contact" onClick={toggleSidebar}>
         <InformationCircleIcon className="h-6 w-6" />
         区への問い合わせ
       </Link>
     </li>
   </ul>
   ```

3. **認証ステータス表示の変更**

   - `src/components/AuthStatus.tsx`を修正し、認証状態ではなく公共サービスである旨の情報表示に変更

4. **問い合わせ情報ページの追加**
   - `src/app/contact/page.tsx`を作成し、区の問い合わせ情報を追加

### フェーズ 3: クリーンアップとテスト

1. **未使用インポートの削除**

   - 認証関連機能を参照している他のファイルがないか確認し、必要に応じて修正

2. **テスト更新**
   - 認証関連のテストがある場合は削除または更新

## 3. テスト計画

1. **機能テスト**

   - 認証機能が完全に削除されたことを確認
   - サイドバーから認証/Ko-fi 関連のリンクが正しく削除/変更されていることを確認
   - 問い合わせ情報ページが正しく表示されることを確認

2. **統合テスト**

   - アプリ全体のナビゲーションフローが正常に動作することを確認
   - 認証なしでもすべての機能にアクセスできることを確認

3. **パフォーマンステスト**

   - 変更後のレート制限が適切に機能することを確認
   - API 呼び出しの応答時間に変化がないことを確認

4. **ブラウザ互換性テスト**
   - 複数のブラウザ（Chrome、Firefox、Safari、Edge）で変更後の UI を確認

## 4. デプロイ計画

1. **事前準備**

   - 現在のプロダクション環境のバックアップを作成
   - マイグレーションのロールバックプランを用意

2. **デプロイ手順**

   - ステージング環境で変更をテスト
   - データベースマイグレーションを実行
   - フロントエンドとバックエンドの変更をデプロイ
   - 動作確認

3. **デプロイ後の作業**
   - モニタリングの強化（特に API レート制限に関して）
   - ユーザーフィードバックの収集

## 5. 注意点と推奨事項

1. **コミットメッセージ**

   - 変更内容を明確に示すコミットメッセージを使用
   - 例: "Remove authentication and payment features for public service transition"

2. **コード削除時の注意点**

   - 他のコンポーネントから参照されている部分がないかよく確認
   - 特にグローバルな状態管理（Context など）がある場合は注意

3. **UI の一貫性**
   - 認証関連の要素を削除した後、UI に違和感がないように調整
   - 必要に応じて新しい区の情報を強調表示
