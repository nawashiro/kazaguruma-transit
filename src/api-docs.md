# トランジットAPI ドキュメント

## 概要

トランジットAPIは、バス停検索、経路検索、時刻表取得など、公共交通機関に関する情報を取得するための統合APIです。すべての機能が単一のエンドポイントで提供され、シンプルなリクエスト形式でアクセスできます。

## エンドポイント

### 1. トランジットAPI

**URL**: `/api/transit`  
**メソッド**: `POST`  
**説明**: 経路検索、バス停検索、時刻表取得などのトランジット関連情報を提供します。

#### リクエスト形式

リクエストボディは以下の形式のJSONオブジェクトです：

```json
{
  "type": "<クエリタイプ>",
  // クエリタイプに応じたパラメータ
}
```

クエリタイプは以下のいずれかです：
- `route` - 経路検索
- `stop` - バス停検索
- `timetable` - 時刻表取得

#### レスポンス形式

すべてのAPIレスポンスは以下の共通形式で返されます：

```json
{
  "success": true,
  "data": {
    // 結果データ（クエリタイプに応じて異なる）
  }
}
```

エラー時は以下の形式で返されます：

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

### 2. ジオコーディングAPI

**URL**: `/api/geocode`  
**メソッド**: `GET`  
**パラメータ**: `address` - 住所文字列  
**説明**: 住所から緯度・経度を取得します。

#### リクエスト例

```
GET /api/geocode?address=東京都千代田区
```

#### レスポンス例

```json
{
  "success": true,
  "data": {
    "location": {
      "lat": 35.6894,
      "lng": 139.6917,
      "address": "日本、〒100-0001 東京都千代田区"
    }
  }
}
```

## 使用例

### 1. 経路検索

#### リクエスト

```json
POST /api/transit
Content-Type: application/json

{
  "type": "route",
  "origin": {
    "lat": 36.234,
    "lng": 140.123
  },
  "destination": {
    "lat": 36.345,
    "lng": 140.234
  },
  "time": "2023-12-01T10:00:00Z"
}
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "journeys": [
      {
        "departure": "10:15:00",
        "arrival": "10:45:00",
        "duration": 30,
        "transfers": 0,
        "route": "茂木線",
        "from": "千代田バスターミナル",
        "to": "茂木駅",
        "color": "#0000FF",
        "textColor": "#FFFFFF"
      }
    ],
    "stops": [
      {
        "id": "1",
        "name": "千代田バスターミナル",
        "distance": 0.12
      },
      {
        "id": "5",
        "name": "茂木駅",
        "distance": 0.18
      }
    ]
  }
}
```

### 2. バス停検索

#### リクエスト

```json
POST /api/transit
Content-Type: application/json

{
  "type": "stop",
  "location": {
    "lat": 36.234,
    "lng": 140.123
  },
  "radius": 1
}
```

または名前で検索：

```json
POST /api/transit
Content-Type: application/json

{
  "type": "stop",
  "name": "バスターミナル"
}
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "stops": [
      {
        "id": "1",
        "name": "千代田バスターミナル",
        "lat": 36.234,
        "lng": 140.123,
        "distance": 0.12
      },
      {
        "id": "2",
        "name": "茂木バスターミナル",
        "lat": 36.345,
        "lng": 140.234,
        "distance": 0.56
      }
    ]
  }
}
```

### 3. 時刻表取得

#### リクエスト

```json
POST /api/transit
Content-Type: application/json

{
  "type": "timetable",
  "stopId": "1",
  "time": "2023-12-01T10:00:00Z"
}
```

#### レスポンス

```json
{
  "success": true,
  "data": {
    "timetable": [
      {
        "departureTime": "10:15:00",
        "arrivalTime": "10:15:00",
        "routeId": "route1",
        "routeName": "茂木線",
        "routeShortName": "茂木線",
        "routeLongName": "千代田-茂木駅",
        "routeColor": "#0000FF",
        "routeTextColor": "#FFFFFF",
        "headsign": "茂木駅行き",
        "directionId": 0
      },
      {
        "departureTime": "10:30:00",
        "arrivalTime": "10:30:00",
        "routeId": "route1",
        "routeName": "茂木線",
        "routeShortName": "茂木線",
        "routeLongName": "千代田-茂木駅",
        "routeColor": "#0000FF",
        "routeTextColor": "#FFFFFF",
        "headsign": "茂木駅行き",
        "directionId": 0
      }
    ]
  }
}
```

## エラーコード

- `400` - リクエストが不正
- `404` - 指定されたリソースが見つからない
- `500` - サーバ内部エラー

## 注意事項

- 日時パラメータは ISO8601 形式の文字列で指定してください (`YYYY-MM-DDThh:mm:ssZ`)
- 時刻表の時間は 24 時間形式で返されます
- 距離は km 単位で返されます
- 位置情報はWGS84座標系の緯度経度で指定・返却されます 