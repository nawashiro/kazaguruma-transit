# Tasks

## 1. 乗車区間の線の色

- [x] 1.1 [IntegratedRouteDisplay.test.tsx](../../../../src/components/features/__tests__/IntegratedRouteDisplay.test.tsx)のエッジ色の期待値を、`bg-secondary-content dark:bg-secondary`を含む形に書き換え、現行実装で失敗することを`npm run test:unit -- IntegratedRouteDisplay`で確認する
- [x] 1.2 `SecondaryEdge`の`<hr>`を`bg-secondary-content dark:bg-secondary`に変え、1.1のテストが通ることを確認する。`npm run test:unit -- IntegratedRouteDisplay`を実行する
- [x] 1.3 徒歩区間（`bg-accent`）、停留所の丸、路線名の文字のクラスが変わっていないことを`git diff src/components/features/IntegratedRouteDisplay.tsx`で確認する

## 2. テーマごとの見え方の確認

- [x] 2.1 `npm run dev`で結果ページを開き、cupcakeで乗車区間の線が地色から区別できること、darkで乗車区間の線と徒歩区間の線の見た目が変わっていないことを、実ブラウザで320 CSS pxと1440 CSS pxの両方で確認する
- [x] 2.2 cupcakeとdarkで、`getComputedStyle`から乗車区間の`<hr>`の背景色を読み、線と地色のコントラスト比を測る。結果と確認した画面幅を変更ディレクトリの`verification.md`へ記録する

## 3. 全体の確認

- [x] 3.1 `npm run lint`と`npm test`が通ることを確認する
- [x] 3.2 `openspec validate cupcake-route-edge-contrast --strict`が通ることを確認する
