# Issue #83 実装プラン

## 目的

`/settings`の未認証ユーザーが、目的の認証操作へ一回のクリックで到達できるようにする。あわせて、Issueスレッドで確認された認証復帰先の重複と、認証画面・基本表示のサイズ指定を現行設計に沿って修正する。

## 憲章ゲート

根拠文書は`AGENTS.md`と`.specify/memory/constitution.md`（Version 3.0.0）である。

- **Clear Naming:** `buildAuthRoute`、`buildSignupRoute`など、認証モードと動作を表す名前を使う。
- **Simple Logic:** URL生成は共通関数へ集約し、settingsの表示はリンク2つの単純な分岐にする。余計な状態や自動再試行は追加しない。
- **Structured Organization:** 画面のナビゲーションは既存のnavigation helper、表示は既存のsettings/auth component境界に置く。
- **Type Safety:** 認証モードをunion型で限定し、未知の復帰先は既存の`resolveSafeReturnTarget`で`/`へフォールバックする。
- **Test-First Development:** test writerが先に意味のあるREDを作り、独立したfresh reviewerのPASS後にproduction codeを変更する。
- **Accessibility & UX:** native link、固有の accessible name、既存の44px touch target、PageHeader、loading/error表示を維持する。WCAG 2.2 AAの2.4.4（リンクの目的）、2.5.8（ターゲットサイズ）、1.4.4（テキストのサイズ変更）に関係する。
- **Documentation & Comments:** 調査事実とスコープ外を本ディレクトリへ記録し、コメントは設計理由が必要な箇所だけに置く。
- **KISS / 後方互換性:** 旧combined CTAや重複returnTo経路を残さず、別の認証メッセージ機構や旧ルートのフォールバックは増やさない。
- **日本語:** 作業文書・commit・PRは日本語とする。

## 実装方針

### Slice A: settings認証導線

1. `buildLoginRoute`と対になる`buildSignupRoute`を追加し、共通の`buildAuthRoute`で安全な`returnTo`と任意のreasonを生成する。
2. `AuthRoutePage`のログイン／アカウント作成切替リンクは、`returnTo`がある場合だけその値を保持する。直接アクセス時の通常href（`/signup`、`/login`）は維持する。
3. settingsの未認証表示は`Button`＋`router.push`をやめ、`/login`と`/signup`へ向かう2つのnative `Link`を描画する。両方に`returnTo=/settings`を設定し、reasonは渡さない。
4. 既存のログイン成功後の安全な復帰、外部URL・action-like queryの拒否、AuthRoutePageのreason表示は維持する。

### Slice B: 公開モデレーター画面の復帰先

1. 現行正規ルート`/discussions/moderator`を定数または直接の明示値として利用する。
2. 未認証の申請操作では`/login?returnTo=%2Fdiscussions%2Fmoderator`へ遷移し、reason/action/payload等は付加しない。
3. 個別会話の`/discussions/[naddr]/moderators`の復帰先は変更しない。

### Slice C: global文字サイズとsettings余白

1. `globals.css`の16pxルールに`code`を追加し、`span`を外す。
2. 既存productionのbadge利用へ`badge-md`を付け、DaisyUI標準14pxを利用側で明示する。badge表示を16pxへ拡大する変更はしない。
3. settings未認証表示から内側`py-8`と`h3.text-lg`を除く。外側ページ余白、h2の`mb-4`、既存のエラー表示は維持する。

## 受入基準と検証対応

| ID | 受入基準 | 検証 |
|---|---|---|
| AC-1 | 未認証settingsに、名前が「ログイン」「アカウント作成」の2リンクだけがあり、combined CTAがない | settings RTLテスト |
| AC-2 | 2リンクのhrefはそれぞれ安全な`returnTo=/settings`を持ち、reason/action-like stateを含まない | settings RTLテスト、auth-route unit test |
| AC-3 | auth route間の切替で、存在する安全な`returnTo`を保持する。直接アクセスの通常hrefは維持する | login/signup page test |
| AC-4 | 公開モデレーター画面の未認証操作は正規ルート`/discussions/moderator`へ復帰し、reasonなしでログインを開く | moderator route RTLテスト |
| AC-5 | `code`はglobal 16px対象、`span`はglobal selector対象外、badgeは利用側で`badge-md`を明示する | CSS/UI source contract test、font-size test |
| AC-6 | settingsの未認証見出しはデフォルト16pxで、内側`py-8`を持たない | settings RTL/source contract test |
| AC-7 | PageHeader、loading/error、認証失敗時の表示、個別会話モデレーター復帰先に回帰がない | 既存関連suite、full Jest |
| AC-8 | strict TypeScript、lint、build、`git diff --check`を実行し、結果を実測記録する | 品質ゲート |

## 変更予定ファイル

### production

- `src/lib/navigation/auth-route.ts`
- `src/app/settings/page.tsx`
- `src/components/auth/AuthRoutePage.tsx`
- `src/components/discussion/DiscussionManagementModeratorPage.tsx`
- `src/app/globals.css`
- badge利用9ファイル（詳細は`research.md`）。`src/app/discussions/[naddr]/approve/page.tsx`は既に`badge-md`準拠のためvalidation-onlyであり、write対象にしない。

### tests

- `src/lib/navigation/__tests__/auth-route.test.ts`（新規）
- `src/app/settings/__tests__/page.streaming.test.tsx`
- `src/app/login/__tests__/page.test.tsx`
- `src/app/signup/__tests__/page.test.tsx`
- `src/app/discussions/moderator/__tests__/page.test.tsx`（新規）
- `src/app/__tests__/issue-83-style-contract.test.ts`（Slice Cの新規契約。CSS/AST/DOMのcanonical test）
- `src/app/__tests__/font-size-compliance.test.ts`（既存の全体font-size regression）

## リスクと対策

- **URL復帰先の退行:** 既存のsafe-return-targetを共通helperから再利用し、外部・protocol-relative・action-like queryは既存テストで維持する。
- **native linkの見た目退行:** Buttonと同じDaisyUI class、`min-h-[44px]`、`rounded-full dark:rounded-sm`を使い、RTLでtag/href/nameを確認する。
- **badgeのサイズ過剰変更:** `.badge-md`はDaisyUI 5で14pxを明示するクラスであり、標準表示を16pxへ変更しない。
- **既存reason経路の破壊:** reason表示機構を削除せず、settingsと公開モデレーターの呼び出しだけreasonなしにする。
- **LFS:** 既存のpng属性/blob不整合は画像を触らず、Issue変更の検証から分離する。
- **テスト環境:** Node 22.xを優先する。現環境の壊れたNext SWCとSIGBUSはコード失敗と混同せず、単独suiteとfull suiteの結果を分離記録する。

## 実装完了の条件

全テストと品質ゲートの終了コードを確認し、変更が上記manifest内に限定され、Issue #83に紐づくfeature branchへcommit/pushされていること。PRを作成した場合は、baseが`dev`であること、head SHA、ファイル、CI実行状態をGitHubから読み返して確認する。未実行または未triggerのCIは成功扱いにしない。
