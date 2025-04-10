import { describe, expect, test } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "../../route";
import "isomorphic-fetch";
import * as gtfs from "gtfs";
import { jest } from "@jest/globals";

// SQLiteManagerをモック
jest.mock("../../../../../lib/db/sqlite-manager", () => ({
  sqliteManager: {
    init: jest.fn().mockResolvedValue(undefined as never),
    getRateLimitByIp: jest.fn().mockResolvedValue(null as never),
    incrementRateLimit: jest.fn().mockResolvedValue(undefined as never),
  },
}));

// モジュールをモック
jest.mock("next/server", () => {
  const originalModule = jest.requireActual("next/server") as Record<
    string,
    unknown
  >;
  return {
    __esModule: true,
    ...originalModule,
    NextResponse: {
      ...(originalModule.NextResponse as Record<string, unknown>),
      json: jest.fn().mockImplementation((body: unknown, options?: unknown) => {
        const status = (options as { status?: number })?.status || 200;
        return {
          status,
          json: async () => body,
        };
      }),
    },
  };
});

// レート制限ミドルウェアをモック
jest.mock("../../../../../lib/api/rate-limit-middleware", () => ({
  appRouterRateLimitMiddleware: jest.fn().mockResolvedValue(undefined as never),
}));

// GTFSモジュールのモック化
jest.mock("gtfs", () => ({
  openDb: jest.fn().mockResolvedValue(undefined as never),
  closeDb: jest.fn().mockResolvedValue(undefined as never),
  importGtfs: jest.fn().mockResolvedValue(undefined as never),
  getStops: jest.fn(),
  getStoptimes: jest.fn(),
  getTrips: jest.fn(),
  getRoutes: jest.fn(),
}));

// 実行前にすべてのモックをリセット
beforeEach(() => {
  jest.clearAllMocks();
});

describe("経路検索API", () => {
  // モックのバス停データ
  const mockOriginStop = {
    stop_id: "stop1",
    stop_name: "出発バス停",
    stop_lat: 35.6812,
    stop_lon: 139.7671,
    distance: 0.2,
  };

  const mockDestStop = {
    stop_id: "stop2",
    stop_name: "目的地バス停",
    stop_lat: 35.6895,
    stop_lon: 139.7004,
    distance: 0.3,
  };

  // モックのルートとトリップ
  const mockTrips = [
    { trip_id: "trip1", route_id: "route1" },
    { trip_id: "trip2", route_id: "route2" },
  ];

  const mockRoutes = [
    {
      route_id: "route1",
      route_short_name: "01",
      route_long_name: "循環バス01",
      route_color: "FF0000",
      route_text_color: "FFFFFF",
    },
  ];

  const mockStoptimes = [
    { trip_id: "trip1", stop_id: "stop1", stop_sequence: 1 },
    { trip_id: "trip1", stop_id: "stop2", stop_sequence: 3 },
  ];

  // URLとリクエストオブジェクトの作成ヘルパー
  const createMockRequest = (params: Record<string, string>) => {
    const url = new URL("https://example.com/api/transit/route");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return {
      url: url.toString(),
      method: "GET",
      nextUrl: url,
      searchParams: url.searchParams,
      cookies: {
        get: jest.fn().mockReturnValue(null),
      },
      headers: new Headers(),
    } as unknown as NextRequest;
  };

  test("GET APIは非推奨であることを示すエラーを返す", async () => {
    // バス停検索のモック
    (gtfs.getStops as jest.Mock).mockImplementation((query: unknown) => {
      const q = query as { stop_id?: string };
      if (!q || Object.keys(q).length === 0) {
        return [mockOriginStop, mockDestStop];
      } else if (q.stop_id === "stop1") {
        return [mockOriginStop];
      } else if (q.stop_id === "stop2") {
        return [mockDestStop];
      }
      return [];
    });

    // 停車時刻、トリップ、ルートのモック
    (gtfs.getStoptimes as jest.Mock).mockImplementation((query: unknown) => {
      const q = query as { stop_id?: string; trip_id?: string };
      if (q.stop_id === "stop1") {
        return [mockStoptimes[0]];
      } else if (q.stop_id === "stop2") {
        return [mockStoptimes[1]];
      } else if (q.trip_id === "trip1") {
        if (q.stop_id === "stop1") {
          return [mockStoptimes[0]];
        } else if (q.stop_id === "stop2") {
          return [mockStoptimes[1]];
        }
      }
      return [];
    });

    (gtfs.getTrips as jest.Mock).mockImplementation((query: unknown) => {
      const q = query as { trip_id?: string };
      if (!q) return mockTrips;
      if (q.trip_id && q.trip_id.includes("trip1")) {
        return [mockTrips[0]];
      }
      return [];
    });

    (gtfs.getRoutes as jest.Mock).mockImplementation((query: unknown) => {
      const q = query as { route_id?: string };
      if (!q) return mockRoutes;
      if (q.route_id && q.route_id.includes("route1")) {
        return mockRoutes;
      }
      return [];
    });

    // リクエストの実行
    const req = createMockRequest({
      originLat: "35.6812",
      originLng: "139.7671",
      destLat: "35.6895",
      destLng: "139.7004",
    });

    const res = await GET(req);
    const data = await res.json();

    // アサーション
    expect(res.status).toBe(400);
    expect(data).toHaveProperty("success", false);
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("GET APIは非推奨です");
  });

  test("バス停が同じ場合でもGET APIは非推奨エラーを返す", async () => {
    // 両方同じバス停の場合をモック
    (gtfs.getStops as jest.Mock).mockImplementation(() => {
      return [mockOriginStop];
    });

    // リクエストの実行
    const req = createMockRequest({
      originLat: "35.6812",
      originLng: "139.7671",
      destLat: "35.6812",
      destLng: "139.7671",
    });

    const res = await GET(req);
    const data = await res.json();

    // アサーション
    expect(res.status).toBe(400);
    expect(data).toHaveProperty("success", false);
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("GET APIは非推奨です");
  });

  test("ルートが見つからない場合でもGET APIは非推奨エラーを返す", async () => {
    // バス停検索はできるが、ルートは見つからない場合をモック
    (gtfs.getStops as jest.Mock).mockImplementation(() => {
      return [mockOriginStop, mockDestStop];
    });

    (gtfs.getStoptimes as jest.Mock).mockReturnValue([]);
    (gtfs.getTrips as jest.Mock).mockReturnValue([]);
    (gtfs.getRoutes as jest.Mock).mockReturnValue([]);

    // リクエストの実行
    const req = createMockRequest({
      originLat: "35.6812",
      originLng: "139.7671",
      destLat: "35.6895",
      destLng: "139.7004",
    });

    const res = await GET(req);
    const data = await res.json();

    // アサーション
    expect(res.status).toBe(400);
    expect(data).toHaveProperty("success", false);
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("GET APIは非推奨です");
  });

  test("パラメータが不足していてもGET APIは非推奨エラーを返す", async () => {
    // 不完全なパラメータでリクエスト
    const req = createMockRequest({
      originLat: "35.6812",
      // originLngが欠けている
      destLat: "35.6895",
      destLng: "139.7004",
    });

    const res = await GET(req);
    const data = await res.json();

    // アサーション
    expect(res.status).toBe(400);
    expect(data).toHaveProperty("success", false);
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("GET APIは非推奨です");
  });

  test("バス停が見つからなくてもGET APIは非推奨エラーを返す", async () => {
    // バス停が見つからない場合をモック
    (gtfs.getStops as jest.Mock).mockReturnValue([]);

    // リクエストの実行
    const req = createMockRequest({
      originLat: "35.6812",
      originLng: "139.7671",
      destLat: "35.6895",
      destLng: "139.7004",
    });

    const res = await GET(req);
    const data = await res.json();

    // アサーション
    expect(res.status).toBe(400);
    expect(data).toHaveProperty("success", false);
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("GET APIは非推奨です");
  });
});
