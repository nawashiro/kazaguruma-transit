# SCRUM-13 実装詳細: ルート検索アルゴリズムの最適化と徒歩距離オプション

この実装計画では、SCRUM-13 の詳細な実装ステップについて説明します。

## 1. UI 変更

### 経路検索フォームの拡張

#### 1.1. 検索オプション追加

`/src/components/RouteSearchForm.tsx` を修正し、検索オプションを追加します。

```tsx
// 新しいラジオボタングループを追加
<div className="route-search-options">
  <label className="text-sm font-medium mb-2 block">経路優先条件</label>
  <div className="flex gap-4">
    <div className="flex items-center">
      <input
        type="radio"
        name="routePreference"
        id="minTime"
        value="minTime"
        checked={preference === "minTime"}
        onChange={handlePreferenceChange}
        className="mr-2"
      />
      <label htmlFor="minTime" className="text-sm">
        所要時間最小
      </label>
    </div>
    <div className="flex items-center">
      <input
        type="radio"
        name="routePreference"
        id="minWalk"
        value="minWalk"
        checked={preference === "minWalk"}
        onChange={handlePreferenceChange}
        className="mr-2"
      />
      <label htmlFor="minWalk" className="text-sm">
        徒歩距離最小
      </label>
    </div>
  </div>
</div>
```

#### 1.2. 状態管理の追加

```tsx
// 状態管理の追加
const [preference, setPreference] = useState<"minTime" | "minWalk">("minTime");

const handlePreferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setPreference(e.target.value as "minTime" | "minWalk");
};

// 検索パラメータに優先条件を追加
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // ...既存のコード
  try {
    const params: RouteSearchParams = {
      // ...既存のパラメータ
      preference: preference,
    };
    // ...検索処理
  } catch (error) {
    // ...エラー処理
  }
};
```

## 2. API 変更

### 2.1. ルート検索 API の拡張

`/src/pages/api/transit/routes.ts` を修正し、新しいパラメータに対応します。

```typescript
// リクエストインターフェースを拡張
interface RouteRequest extends ApiRequest {
  origin: Coordinates;
  destination: Coordinates;
  time?: string;
  isDeparture?: boolean;
  preference?: "minTime" | "minWalk"; // 追加
}

// APIハンドラの修正
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ...既存のバリデーション

  const {
    origin,
    destination,
    time,
    isDeparture = true,
    preference = "minTime",
  } = req.body as RouteRequest;

  // TransitServiceに検索リクエストを転送
  const result = await transitService.findRoutes({
    type: "route",
    origin,
    destination,
    time,
    isDeparture,
    preference, // 新しいパラメータを追加
  });

  // ...レスポンス処理
}
```

## 3. トランジットサービスの拡張

### 3.1. TransitService の修正

`/src/lib/transit/transit-service.ts` のクエリインターフェイスとルート検索関数を修正します。

```typescript
// ApiRouteQueryインターフェースを拡張
export interface ApiRouteQuery {
  type: 'route';
  origin: Coordinates;
  destination: Coordinates;
  time?: string;
  isDeparture?: boolean;
  preference?: 'minTime' | 'minWalk'; // 追加
  searchRadius?: number; // バス停検索半径（メートル） - 追加
}

// searchRoute関数の修正
private async searchRoute(
  query: ApiRouteQuery
): Promise<{ journeys: Journey[]; stops: NearbyStop[] }> {
  try {
    const {
      origin,
      destination,
      time,
      isDeparture = true,
      preference = 'minTime',
      searchRadius = 500 // デフォルト500m
    } = query;

    logger.log(
      `[TransitService] 経路検索: ${origin.lat},${origin.lng} → ${
        destination.lat
      },${destination.lng}, ${isDeparture ? "出発" : "到着"}時刻 = ${time}, 優先条件 = ${preference}, 検索半径 = ${searchRadius}m`
    );

    // 検索半径をキロメートルに変換（TransitManagerはkm単位で扱う）
    const radiusKm = searchRadius / 1000;

    // 出発地点周辺の複数のバス停を取得
    const nearbyOriginStops = await this.findNearbyStops(origin.lat, origin.lng, radiusKm);

    // 目的地点周辺の複数のバス停を取得
    const nearbyDestStops = await this.findNearbyStops(destination.lat, destination.lng, radiusKm);

    if (nearbyOriginStops.length === 0 || nearbyDestStops.length === 0) {
      logger.error("[searchRoute] 最寄りバス停が見つかりません");
      return { journeys: [], stops: [] };
    }

    // 全ての組み合わせで経路を検索し、最適なものを選択
    const allRoutes: {
      route: TimeTableRouteResult;
      originStop: NearbyStop;
      destStop: NearbyStop;
      totalWalkingDistance: number;
    }[] = [];

    // 検討する組み合わせの数を制限する（上位5つの起点と終点を使用）
    const topOriginStops = nearbyOriginStops.slice(0, 5);
    const topDestStops = nearbyDestStops.slice(0, 5);

    for (const originStop of topOriginStops) {
      for (const destStop of topDestStops) {
        // 同じバス停の場合はスキップ
        if (originStop.id === destStop.id) continue;

        try {
          // 時刻表ベースのルーター
          const timeTableRouter = new TimeTableRouter();
          const departureTime = time ? new Date(time) : new Date();

          // 経路を検索
          const routes = await timeTableRouter.findOptimalRoute(
            originStop.id,
            destStop.id,
            departureTime,
            isDeparture,
            2,  // 最大2回の乗換
            180 // 3時間の時間枠
          );

          if (routes.length > 0) {
            // 各ルートに徒歩距離情報を追加
            for (const route of routes) {
              // 出発地点から最初のバス停までの徒歩距離
              const walkToFirstStop = this.calculateDistance(
                origin.lat, origin.lng,
                originStop.lat, originStop.lng
              );

              // 最後のバス停から目的地までの徒歩距離
              const walkFromLastStop = this.calculateDistance(
                destStop.lat, destStop.lng,
                destination.lat, destination.lng
              );

              // 合計徒歩距離
              const totalWalkingDistance = walkToFirstStop + walkFromLastStop;

              // 経路情報を保存
              allRoutes.push({
                route,
                originStop,
                destStop,
                totalWalkingDistance
              });
            }
          }
        } catch (error) {
          logger.error(`[searchRoute] バス停組み合わせでのエラー: ${originStop.id} → ${destStop.id}`, error);
          // エラーがあってもスキップして次の組み合わせを試す
        }
      }
    }

    if (allRoutes.length === 0) {
      return { journeys: [], stops: [] };
    }

    // 優先条件に基づいて最適な経路を選択
    let optimizedRoute: typeof allRoutes[0] | null = null;

    if (preference === 'minWalk') {
      // 徒歩距離最小化
      optimizedRoute = allRoutes.sort((a, b) => {
        // 徒歩距離が近い順にソート
        return a.totalWalkingDistance - b.totalWalkingDistance;
      })[0];
    } else {
      // 所要時間最小化（デフォルト）
      optimizedRoute = allRoutes.sort((a, b) => {
        // 総所要時間でソート
        return a.route.totalDuration - b.route.totalDuration;
      })[0];
    }

    if (!optimizedRoute) {
      return { journeys: [], stops: [] };
    }

    // 選択した経路をJourneyオブジェクトに変換
    const journey: Journey = {
      // Journeyオブジェクトの変換処理
      // ... existing code ...
      preference: preference, // 使用された検索条件を追加
      totalWalkingDistance: optimizedRoute.totalWalkingDistance,
      // ... existing code ...
    };

    return {
      journeys: [journey], // 最適な一つの経路のみを返す
      stops: [optimizedRoute.originStop, optimizedRoute.destStop]
    };
  } catch (error) {
    logger.error("[TransitService] 経路検索エラー:", error);
    return { journeys: [], stops: [] };
  }
}
```

### 3.2. 近隣バス停検索メソッドの追加

`/src/lib/transit/transit-service.ts` に新しいメソッドを追加します。

```typescript
/**
 * 指定した座標から特定の半径内にあるバス停を検索
 */
private async findNearbyStops(
  lat: number,
  lng: number,
  radiusKm: number = 0.5 // デフォルト500メートル
): Promise<NearbyStop[]> {
  try {
    logger.log(`[findNearbyStops] 検索条件: 座標(${lat}, ${lng}), 半径${radiusKm}km`);

    // すべてのバス停を取得
    const stops = await prisma.stop.findMany({
      select: {
        id: true,
        name: true,
        lat: true,
        lon: true,
      },
    });

    if (stops.length === 0) {
      logger.log("[findNearbyStops] バス停データが見つかりません");
      return [];
    }

    // JavaScript側で距離計算と半径でのフィルタリングを行う
    const nearbyStops = stops
      .map(stop => {
        // ハバーサイン公式で距離を計算
        const latDiff = stop.lat - lat;
        const lonDiff = stop.lon - lng;
        // 概算距離（km）- ハバーサイン公式を簡略化
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111.32;

        return {
          id: stop.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lon,
          distance,
        };
      })
      .filter(stop => stop.distance <= radiusKm) // 半径内のバス停だけをフィルタリング
      .sort((a, b) => a.distance - b.distance); // 距離順にソート

    logger.log(`[findNearbyStops] ${nearbyStops.length}件のバス停が半径${radiusKm}km内に見つかりました`);
    return nearbyStops;
  } catch (error) {
    logger.error("[TransitService] 周辺バス停検索エラー:", error);
    return [];
  }
}

/**
 * 2点間の距離をキロメートル単位で計算（ハバーサイン公式）※既存の実装アリ
 */
private calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球の半径（キロメートル）
  const dLat = this.toRadians(lat2 - lat1);
  const dLon = this.toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

/**
 * 角度をラジアンに変換
 */
private toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
```

ここでは定数をハードコードしていますが、実際には一か所にまとめて定義する必要があります。これらはいち実装例に過ぎないことを留意してください。

## 6. テスト計画

1. 単体テスト:

   - ハバーサイン公式による距離計算の正確性テスト
   - バス停検索ロジックのテスト
   - 最適ルート選択ロジックのテスト

2. 統合テスト:

   - 徒歩距離最小化モードでの経路検索精度テスト
   - 所要時間最小化モードでの経路検索精度テスト
   - エッジケース（近接するバス停、同一バス停など）のテスト

3. UI テスト:
   - 検索オプションの動作検証
   - 経路表示の正確性テスト
   - レスポンシブデザインの確認
