# 乗車区間の線の検証記録

cupcakeの乗車区間の線を`secondary-content`へ変えた結果を、開発サーバー（`next dev --turbopack`、127.0.0.1:3001）の実画面で測った。結果URLは`origin=35.694049,139.753241&destination=35.688581,139.742435&time=2026-11-27T10:00&isDeparture=true&prioritizeSpeed=false`で、麹町ルートの直通経路を表示する。乗車区間の線は4本、徒歩区間の線は8本描かれる。

## 測定値

地色は`body`の`base-300`である。Chromiumは算出色を`lab()`で返すため、スクリーンショットの画素を読んでsRGBに直し、WCAG 2.2の相対輝度で比を求めた。線の太さは4px、重なりはない。

| 画面幅 | テーマ | 乗車区間の画素 | 地色の画素 | コントラスト |
|---|---|---|---|---|
| 320 CSS px | cupcake | `rgb(160, 0, 74)` | `rgb(230, 226, 223)` | 6.29:1 |
| 320 CSS px | dark | `rgb(244, 48, 152)` | `rgb(21, 25, 30)` | 4.81:1 |
| 1440 CSS px | cupcake | `rgb(160, 0, 74)` | `rgb(230, 226, 223)` | 6.29:1 |
| 1440 CSS px | dark | `rgb(244, 48, 152)` | `rgb(21, 25, 30)` | 4.81:1 |

変更前の乗車区間は`secondary`で、cupcakeの地色に対する比は1.11:1だった。変更後は6.29:1となり、非文字の識別に必要な3:1を満たす。

## 変えない範囲の確認

- 徒歩区間の線は`bg-accent`のままで、cupcakeは`rgb(255, 214, 167)`（1.06:1）、darkは`rgb(0, 211, 187)`（9.28:1）である。変更前と画素が同じ。
- darkの乗車区間は`secondary`のままで、変更前と同じ`rgb(244, 48, 152)`である。
- 停留所の丸と路線名の文字のクラスは変えていない。`git diff src/components/features/IntegratedRouteDisplay.tsx`の変更は`SecondaryEdge`の1行だけである。

## 横方向のはみ出し

320 CSS pxと1440 CSS pxの両テーマで、`document.documentElement.scrollWidth`は`innerWidth`を超えなかった。

## 測定の方法

測定はPuppeteerのChromeで行い、`sharp`でスクリーンショットの画素を読んだ。作業用スクリプトは測定後に削除した。画面の目視による配色の良し悪しは、この記録の対象ではない。
