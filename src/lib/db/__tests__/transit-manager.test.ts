import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { TransitManager } from "../transit-manager";

// fsモジュールのモックを先に設定
jest.mock("fs", () => {
  return {
    readFileSync: jest.fn().mockReturnValue(
      JSON.stringify({
        sqlitePath: ".temp/gtfs/gtfs.db",
        agencies: [{ agency_key: "test", url: "test.zip" }],
        skipImport: true,
      })
    ),
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlink: jest.fn().mockImplementation(() => {
      return Promise.resolve();
    }),
    promises: {
      // @ts-expect-error - モック関数の戻り値型の不一致を無視
      unlink: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// GTFSモジュールのモック
jest.mock("gtfs", () => ({
  // @ts-expect-error - モック関数の型定義問題を回避するための対応
  openDb: jest.fn().mockResolvedValue(undefined),
  // @ts-expect-error - モック関数の型定義問題を回避するための対応
  closeDb: jest.fn().mockResolvedValue(undefined),
  // @ts-expect-error - モック関数の型定義問題を回避するための対応
  getStops: jest.fn().mockResolvedValue([
    {
      stop_id: "stop1",
      stop_name: "Test Stop 1",
      stop_lat: "35.681236",
      stop_lon: "139.767125",
    },
    {
      stop_id: "stop2",
      stop_name: "Test Stop 2",
      stop_lat: "35.683275",
      stop_lon: "139.775327",
    },
  ]),
  // @ts-expect-error - モック関数の型定義問題を回避するための対応
  getRoutes: jest.fn().mockResolvedValue([
    {
      route_id: "route1",
      route_short_name: "R1",
      route_long_name: "Test Route 1",
      route_color: "FF0000",
    },
    {
      route_id: "route2",
      route_short_name: "R2",
      route_long_name: "Test Route 2",
      route_color: "00FF00",
    },
  ]),
  // @ts-expect-error - モック関数の型定義問題を回避するための対応
  getTrips: jest.fn().mockResolvedValue([
    {
      trip_id: "trip1",
      route_id: "route1",
      service_id: "service1",
    },
    {
      trip_id: "trip2",
      route_id: "route2",
      service_id: "service1",
    },
  ]),
  // @ts-expect-error - モック関数の型定義問題を回避するための対応
  getStoptimes: jest.fn().mockResolvedValue([
    {
      trip_id: "trip1",
      stop_id: "stop1",
      departure_time: "12:00:00",
      stop_sequence: 1,
    },
    {
      trip_id: "trip2",
      stop_id: "stop2",
      departure_time: "12:30:00",
      stop_sequence: 1,
    },
  ]),
  // @ts-expect-error - モック関数の型定義問題を回避するための対応
  importGtfs: jest.fn().mockResolvedValue(undefined),
}));

// pathモジュールのモック
jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
}));

// 現在時刻をモック
jest.mock("luxon", () => {
  const mockDateValue = new Date(2023, 0, 2, 12, 0, 0); // 2023年1月2日 12:00:00 (月曜日)
  // mockDateValueを使用
  return {
    DateTime: {
      fromJSDate: jest.fn().mockReturnValue({
        hour: mockDateValue.getHours(),
        minute: mockDateValue.getMinutes(),
        second: mockDateValue.getSeconds(),
        weekday: 1, // 月曜日
      }),
    },
  };
});

// モジュールを直接インポートする代わりにモックを使用
jest.mock("../database");

// Databaseモジュールのモック - 各テストケースで個別に設定するためにシンプルに保つ
const setupDatabaseMock = () => {
  return {
    Database: {
      getInstance: jest.fn().mockReturnValue({
        // @ts-expect-error - モック関数の戻り値型の不一致を無視
        ensureConnection: jest.fn().mockResolvedValue(undefined),
        // @ts-expect-error - モック関数の戻り値型の不一致を無視
        closeConnection: jest.fn().mockResolvedValue(undefined),
        // @ts-expect-error - モック関数の戻り値型の不一致を無視
        checkIntegrity: jest.fn().mockResolvedValue(true),
        withConnection: jest.fn().mockImplementation(async (callbackFn) => {
          // コールバックを実行
          if (typeof callbackFn === "function") {
            await callbackFn();
          }
          // デフォルトは空の配列を返す
          return [];
        }),
      }),
    },
  };
};

describe("TransitManager", () => {
  let transitManager: TransitManager;

  beforeEach(() => {
    // テスト前にモックをリセット
    jest.clearAllMocks();
    transitManager = TransitManager.getInstance();
  });

  test("getInstance returns a singleton instance", () => {
    const instance1 = TransitManager.getInstance();
    const instance2 = TransitManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test.skip("prepareGTFSData skips import when database is valid", async () => {
    // モックを設定
    const fsModule = {
      existsSync: jest.fn().mockReturnValue(true),
      readFileSync: jest.fn().mockReturnValue(
        JSON.stringify({
          sqlitePath: ".temp/gtfs/gtfs.db",
          agencies: [{ agency_key: "test", url: "test.zip" }],
          skipImport: true,
        })
      ),
    };

    // jest.setMockでモックを設定
    jest.doMock("fs", () => fsModule);

    // データベースモックを設定
    const dbModule = setupDatabaseMock();
    jest.doMock("../database", () => dbModule);

    // GTFSモックを設定
    // @ts-expect-error - モジュールのモック化による型の不一致
    const gtfsModule = { importGtfs: jest.fn().mockResolvedValue({}) };
    jest.doMock("gtfs", () => gtfsModule);

    const result = await transitManager.prepareGTFSData();

    // @ts-expect-error - prepareGTFSDataの戻り値型定義と実際の戻り値の不一致
    expect(result.success).toBe(true);
    // モックがプロパティにアクセスできない場合は、適切なアサーションに変更
    // @ts-expect-error - モックオブジェクトの型定義と実際の実装の不一致
    expect(dbModule.Database.getInstance().checkIntegrity).toHaveBeenCalled();
    expect(gtfsModule.importGtfs).not.toHaveBeenCalled();
  });

  test.skip("getStops returns formatted stops data", async () => {
    // withConnectionのモックを更新
    // @ts-expect-error - モックオブジェクトの型定義と実際の実装の不一致
    const db = jest.requireMock("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callbackFn: any) => {
      // コールバックを実行
      if (typeof callbackFn === "function") {
        await callbackFn();
      }
      // モックデータを返す
      return [
        {
          id: "stop1",
          name: "Test Stop 1",
          code: undefined,
        },
        {
          id: "stop2",
          name: "Test Stop 2",
          code: undefined,
        },
      ];
    });

    const stops = await transitManager.getStops();

    expect(stops).toHaveLength(2);
    expect(stops[0].id).toBe("stop1");
    expect(stops[0].name).toBe("Test Stop 1");
  });

  test.skip("getRoutes returns formatted routes data", async () => {
    // withConnectionのモックを更新
    // @ts-expect-error - モックオブジェクトの型定義と実際の実装の不一致
    const db = jest.requireMock("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callbackFn: any) => {
      // コールバックを実行
      if (typeof callbackFn === "function") {
        await callbackFn();
      }
      // モックデータを返す
      return [
        {
          id: "route1",
          name: "R1",
          shortName: "R1",
          longName: "Test Route 1",
          color: "#FF0000",
          textColor: "#FFFFFF",
        },
        {
          id: "route2",
          name: "R2",
          shortName: "R2",
          longName: "Test Route 2",
          color: "#00FF00",
          textColor: "#FFFFFF",
        },
      ];
    });

    const routes = await transitManager.getRoutes();

    expect(routes).toHaveLength(2);
    expect(routes[0].id).toBe("route1");
    expect(routes[0].name).toBe("R1");
  });

  test.skip("getDepartures returns properly formatted departures", async () => {
    // withConnectionのモックを更新
    // @ts-expect-error - モックオブジェクトの型定義と実際の実装の不一致
    const db = jest.requireMock("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callbackFn: any) => {
      // コールバックを実行
      if (typeof callbackFn === "function") {
        await callbackFn();
      }
      // モックデータを返す
      return [
        {
          stopId: "stop1",
          tripId: "trip1",
          routeId: "route1",
          routeName: "Test Route 1",
          time: "12:00",
          timeUntilDeparture: "0分",
          msUntilDeparture: 0,
          headsign: "",
        },
        {
          stopId: "stop2",
          tripId: "trip2",
          routeId: "route2",
          routeName: "Test Route 2",
          time: "12:30",
          timeUntilDeparture: "30分",
          msUntilDeparture: 1800000,
          headsign: "",
        },
      ];
    });

    const departures = await transitManager.getDepartures("stop1");

    expect(departures).toHaveLength(2);
    expect(departures[0].stopId).toBe("stop1");
    expect(departures[0].routeId).toBe("route1");
  });

  test.skip("getNearestStops returns the closest stops to given coordinates", async () => {
    // withConnectionのモックを更新
    // @ts-expect-error - モックオブジェクトの型定義と実際の実装の不一致
    const db = jest.requireMock("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callbackFn: any) => {
      // コールバックを実行
      if (typeof callbackFn === "function") {
        await callbackFn();
      }
      // モックデータを返す
      return {
        stops: [
          {
            id: "stop1",
            name: "Test Stop 1",
            code: undefined,
          },
          {
            id: "stop2",
            name: "Test Stop 2",
            code: undefined,
          },
        ],
        nearestStop: {
          stop_id: "stop1",
          stop_name: "Test Stop 1",
          stop_code: undefined,
          stop_lat: "35.681236",
          stop_lon: "139.767125",
          distance: 0.05,
        },
      };
    });

    const result = await transitManager.getNearestStops(35.6812, 139.7671);

    expect(result.stops).toHaveLength(2);
    expect(result.nearestStop).not.toBeNull();
    expect(result.nearestStop.stop_id).toBe("stop1");
  });
});
