# Issue #94 調査記録

## 調査対象と基準

- Repository: `/opt/data/kazaguruma-transit`
- 調査対象ブランチ: `dev`
- 調査時のHEAD: `78aad3a88599ae1610b6a886bbc8f2793ae5a16f`
- `origin/dev`: 同じSHA。`git rev-list --left-right --count dev...origin/dev` は `0 0`
- 調査後の作業ブランチ: `fix/issue-94-accessibility`
- Issue: https://github.com/nawashiro/kazaguruma-transit/issues/94

## Issueの現行内容

Issue #94 の本文は次の2項目のみで、コメントは存在しない。

- ナビゲーション: `/` にてtab押下2回めで現在の位置がわからなくなる可能性
- alert: `/routes` にて読み込み時のalert要素残存の可能性。

## 重複調査

- `gh pr list --search "#94" --state all`: 該当PRなし
- `gh pr list --search "focus accessibility" --state open`: 該当PRなし
- `gh pr list --search "focus management" --state open`: 該当PRなし
- 直近コミットと対象パスの履歴を確認した。#94を既に修正したコミットはない。
- `04d9f7e fix: 経路検索エラー表示を改善` はエラーalertの配色だけを変更しており、読み込み中の状態整合性は扱っていない。

## 根拠1: ホームのTab順

`src/components/layouts/SidebarLayout.tsx` は、`SkipToContent` の直後に次の制御用checkboxを置いている。

```tsx
<input
  id="drawer"
  type="checkbox"
  className="drawer-toggle"
  checked={isDrawerOpen}
  onChange={(event) => setIsDrawerOpen(event.target.checked)}
  aria-label="ナビゲーションメニュー"
/>
```

DaisyUI 5 の `drawer-toggle` は通常時に `opacity: 0; width: 0; height: 0; position: fixed` であり、モバイル時は `display: none` にならない。したがって、支援リンクをTabで通過した利用者が、外観も位置も持たないcheckboxをフォーカスする可能性がある。表示上の操作入口は後続の `button.drawer-button` であるため、内部checkboxをTab順から除外するのが最小の修正となる。

## 根拠2: `/routes` の古いalert

`src/components/features/RouteSearchResults.tsx` は検索条件をpropsとして受け取り、`resultState`をローカルstateで保持する。検索条件が変わったとき、次のeffectが実行される。

```tsx
useEffect(() => {
  setResultState({ status: "loading" });
  // 新しいfetch
}, [parsed]);
```

effectが実行されるまでのrenderでは、前回の `resultState.status === "error"` が残るため、`SearchError` の `role="alert"` が一時的に再描画され得る。検索条件とresult stateの対応関係を保持せず、effect側のstate更新だけに依存していることが根本原因である。結果stateに対象の検索条件を紐付け、current queryに対する結果でない場合はloadingを表示する必要がある。

## 現行テストのベースライン

```text
npm test -- --runInBand --runTestsByPath src/app/routes/__tests__/page.test.tsx src/app/__tests__/page.test.tsx
PASS
Test Suites: 2 passed, 2 total
Tests: 9 passed, 9 total
```

既存テストには、drawer内部checkboxのTab除外契約も、前回エラーから新しい検索条件へ切り替えた際のalert不在契約もない。今回の実装では、これらを本番変更前のREDテストとして追加する。

## 設計判断

1. drawerの制御方式は変更せず、内部checkboxに `tabIndex={-1}` を設定する。表示されているメニューボタンの操作、Reactのchecked state、DaisyUIのdrawer挙動を維持する。
2. 結果stateに `searchParams` を保持し、`resultState.searchParams !== searchParams` の間はloadingを描画する。APIの再実行や既存のエラー／成功表示の意味は変えない。
3. 変更は共通レイアウト1箇所と経路検索結果1箇所に限定し、他画面のalertは対象外とする。
