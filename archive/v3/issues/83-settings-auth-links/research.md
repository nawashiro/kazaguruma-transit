# Issue #83 調査記録

## 基準

- Issue: [#83 chor: settingsのログイン・アカウント作成導線のクリック数を減らす](https://github.com/nawashiro/kazaguruma-transit/issues/83)
- Repository: `/opt/data/kazaguruma-transit-issue83`
- Base: `dev` / `origin/dev` at `a4007f10631520457f4f30ab6992b4131abbe270`
- Work branch: `fix/issue-83-settings-auth-links`
- Issue state: OPEN
- Issue body: `/settings` の「ログイン / アカウント作成」を「ログイン」「アカウント作成」の2導線へ分割する。
- Active comments:
  - ログインページへ遷移するだけでよく、settings導線から理由メッセージを渡す必要はない。
  - `/discussions/moderators` として報告されたモデレーター画面のログイン復帰先が重複する。
  - `code` はグローバル16px対象、`span` は対象外とする。badgeなどサイズが変わるコンポーネントはコンポーネント側で明示する。
  - settingsの未認証表示はデフォルト16pxとし、内側の不要な`py-8`を除く。
  - h1の小ささに関する指摘はコメント内で取り消され、別要因で解消済みなら対応不要とされている。

## 最新化とLFSの確認

- `git fetch origin dev` 実行済み。
- `dev...origin/dev` は `0 0` で、ローカルdevとリモートdevは同一だった。
- Issue作業ツリーは開始時点でcleanだった。
- `git lfs version`: 3.7.1。
- LFS管理対象のgif 3件は取得済みで、通常の`git lfs status`では未変更だった。
- ただし`git lfs fsck`は、既存コミットの`src/app/apple-icon.png`と`public/images/map_placeholder.png`について、`.gitattributes`の`*.png filter=lfs`と履歴blobが不整合だと報告した。Issue #83では画像を変更せず、この既存不整合を修復しない。

## 変更前の実装事実

### settingsの認証導線

`src/app/settings/page.tsx`は、未認証時に`Button`を1つだけ描画し、`buildLoginRoute("/settings")`を`router.push`している。表示名は「ログイン / アカウント作成」であり、アカウント作成専用の導線はない。

`src/app/login/page.tsx`と`src/app/signup/page.tsx`は既に存在し、両方とも`AuthRoutePage`を通じて`PageHeader`と`AuthenticationForm`を表示する。`AuthRoutePage`には任意の`reason`を表示する機能があるが、settingsの現行呼び出しはreasonを渡していない。reason表示は投稿・評価など別の認証要求経路が利用しているため、機構全体を削除せず、settings導線では引き続きreasonなしとする。

`buildLoginRoute`は安全な`returnTo`を生成する。signupにも同じ安全な復帰先を渡す必要があるため、login/signup共通のURL生成を用意する。

### モデレーター画面の復帰先

現行の正規ルートはファイル配置・管理タブともに`/discussions/moderator`（単数）である。`src/components/discussion/DiscussionManagementModeratorPage.tsx`は`naddrParam = "moderator"`を使い、未認証時に`/discussions/moderator/moderators`を`returnTo`へ入れている。これは現在の画面自身のルートを余計に連結した値であり、報告された重複遷移の現行コード上の原因である。

動的な個別会話の`/discussions/[naddr]/moderators`は別の正規ルートであり、そちらの復帰先は変更しない。

### グローバル文字サイズとbadge

`src/app/globals.css`は`p, body, a, li, dt, dd, th, td, span`を16pxにしているため、`span`上のDaisyUI badgeの標準`.875rem`（14px）を上書きしている。一方、`code`はグローバルルールに含まれていない。

production codeにはbadge利用が次の箇所にある。

- `src/app/discussions/[naddr]/approve/page.tsx`
- `src/app/discussions/[naddr]/page.tsx`
- `src/app/discussions/manage/page.tsx`
- `src/app/discussions/page.tsx`
- `src/app/license/page.tsx`
- `src/components/discussion/ApprovalStatusTabs.tsx`
- `src/components/discussion/EvaluationComponent.tsx`
- `src/components/discussion/PostPreview.tsx`
- `src/components/features/IntegratedRouteDisplay.tsx`
- `src/components/features/StopTimeDisplay.tsx`

DaisyUI 5の`.badge`は標準14pxで、`.badge-md`も14pxを明示するクラスである。したがって`span`をグローバル対象から外した後も、ユーザー向けbadgeの意図した14pxを各利用箇所で`badge-md`として明示する。

### settingsの未認証表示と共通見出し

`settings/page.tsx`の未認証表示は内側の`div.py-8`と`h3.text-lg`を持つ。これはコメントの「デフォルト16px」「不要なpy-8」と一致しないため、内側`py-8`と`text-lg`を除く。

`login/page.tsx`、`signup/page.tsx`、`AuthRoutePage`、`settings/page.tsx`はいずれも現行コードで`PageHeader`境界を利用している。取り消されたh1指摘を理由に共通レイアウトを変更する必要はない。

## ベースライン検証

- `src/app/settings/__tests__/page.streaming.test.tsx`: baseline時点5 tests passed。
- `src/app/login/__tests__/page.test.tsx`: 7 tests passed。
- `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`: 12 tests passed。
- `src/app/__tests__/font-size-compliance.test.ts`: 15 tests passed。
- `src/app/__tests__/accessibility-source-contract.test.ts`: 6 tests passed。
- 対象5 suiteの一括実行は環境上`SIGBUS`になったが、各suite単独では成功した。原因調査で壊れた`@next/swc-linux-x64-gnu`（ELFヘッダが示すファイルサイズ143MBに対して実体1.99MB）が見つかった。Node 22.23.2でもネイティブモジュール直接読込はSIGBUSだったが、Jest対象suite単独の実行には影響しなかった。
- 実行環境の依存修復で発生した`package-lock.json`差分は復元し、作業ツリーに残していない。

## スコープ境界

### 対応する

1. settingsの未認証認証導線を、ログインとアカウント作成の2つのnative linkへ分割する。
2. 両導線から`/settings`へ安全に復帰できるURLを生成する。settings導線からreasonは渡さない。
3. auth route間の切替でも、既存の安全な`returnTo`を保持する。
4. 公開モデレーター画面の未認証復帰先を、正規ルート`/discussions/moderator`へ修正し、reasonなしで単にログインページを開く。
5. `code`をグローバル16px対象へ追加し、`span`を除外し、badgeの14pxを`badge-md`で利用側に明示する。
6. settings未認証表示の`text-lg`と内側`py-8`を除く。

### 対応しない

- `AuthRoutePage`が別経路で受け取るreason表示機構の削除。
- 個別会話の`/discussions/[naddr]/moderators`の復帰先変更。
- 取り消されたh1指摘への対応、`PageHeader` APIの変更。
- Nostr、DB、API、認証プロトコル、永続化、GTFS、画像、LFS履歴の変更。
- globalの16px方針を理由とする全UIの再設計。既存のbadge利用に限定して明示クラスを追加する。

## 実装後の検証

- Slice A focused: 4 suites / 28 tests passed、exit 0。
- Slice B focused: 2 suites / 13 tests passed、exit 0。公開routeと個別routeの復帰先を確認した。
- Slice C focused: 3 suites / 25 tests passed（style contract 4、settings 6、existing font-size compliance 15）。そのうちstyle contract + settingsの新規契約は2 suites / 10 testsである。
- 9-suite combined aggregate（重複するsettings suiteは一度だけ実行）: 66 tests passed、exit 0。manifestはSlice Aのauth-route/settings/login/signup、Slice Bのpublic/dynamic moderator、Slice Cのstyle/settings/font-size、共通accessibility source contractで構成する。
- Full Jest: 136 suites passed、2 suites skipped、844 tests passed、13 tests skipped、exit 0。
- `npm run lint`: exit 0。既存のany、`<img>`、Hook依存関係などのwarningのみ。
- strict TypeScript: exit 2。今回変更していない`react-icons/fi`と`react-icons/md`の宣言不足5件。
- `npm run build`: GTFS importが未配置の`transit-config.json`でエラーを記録し、Next.jsの型検証でも今回変更していない`react-icons/*`宣言不足5件によりexit 1。コンパイル単体の成功とは扱わない。`.env.local`も未配置。
- `git diff --check`: exit 0。status上の変更pathは23件（tracked modified 17件、untracked 6件。内訳はdocs 3件、test 3件）で、docsを除く実装・test変更は20件。staged pathは0件。
- LFS: `src/app/apple-icon.png`と`public/images/map_placeholder.png`の既存ポインタ不整合が継続。Issue #83では画像を変更していない。
