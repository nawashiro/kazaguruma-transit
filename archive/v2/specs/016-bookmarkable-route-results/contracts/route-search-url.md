# Contract: 経路検索URL

## Result page

`GET /routes?origin={lat},{lng}&destination={lat},{lng}&time={local-date-time}&isDeparture={boolean}&prioritizeSpeed={boolean}`

全キーは必須。出力時のキー順は上記で固定し、未知キーは無視する。

## Transit API

`GET /api/transit?type=route&origin={lat},{lng}&destination={lat},{lng}&time={local-date-time}&isDeparture={boolean}&prioritizeSpeed={boolean}`

- 有効条件: 既存POST route queryと同じresponse body。
- 不正条件: HTTP 400、`{ success: false, error: string }`。
- rate limit: 既存middlewareの429契約を維持。
- POST `/api/transit`: 互換用に維持。

## Accessibility

loadingはstatusとして通知し、エラーはalertとして通知する。不正URLと検索失敗の双方に入力ページへ戻るリンクを置く。
