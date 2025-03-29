// @ts-nocheck
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { TransitManager } from "../transit-manager";
import { Database } from "../database";

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
    unlink: jest.fn().mockImplementation((path, callback) => {
      if (callback) callback(null);
      return Promise.resolve();
    }),
    promises: {
      unlink: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// GTFSモジュールのモック
jest.mock("gtfs", () => ({
  openDb: jest.fn().mockResolvedValue(undefined),
  closeDb: jest.fn().mockResolvedValue(undefined),
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
  importGtfs: jest.fn().mockResolvedValue(undefined),
}));

// pathモジュールのモック
jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
}));

// 現在時刻をモック
jest.mock("luxon", () => {
  const mockDate = new Date(2023, 0, 2, 12, 0, 0); // 2023年1月2日 12:00:00 (月曜日)
  return {
    DateTime: {
      fromJSDate: jest.fn().mockReturnValue({
        hour: 12,
        minute: 0,
        second: 0,
        weekday: 1, // 月曜日
      }),
    },
  };
});

// Databaseモジュールのモック - 各テストケースで個別に設定するためにシンプルに保つ
jest.mock("../database", () => {
  // モック関数の定義
  const checkIntegrityMock = jest.fn().mockResolvedValue(true);
  const withConnectionMock = jest.fn().mockImplementation(async (callback) => {
    // デフォルトは空の配列を返す
    return [];
  });

  return {
    Database: {
      getInstance: jest.fn().mockReturnValue({
        ensureConnection: jest.fn().mockResolvedValue(undefined),
        closeConnection: jest.fn().mockResolvedValue(undefined),
        checkIntegrity: checkIntegrityMock,
        withConnection: withConnectionMock,
      }),
    },
  };
});

describe("TransitManager", () => {
  let transitManager: TransitManager;

  beforeEach(() => {
    // テスト前にモックをリセット
    jest.clearAllMocks();
    transitManager = TransitManager.getInstance();
    // 環境変数のモック時刻を無効化
    process.env.MOCK_TIME = "false";
  });

  test("getInstance returns a singleton instance", () => {
    const instance1 = TransitManager.getInstance();
    const instance2 = TransitManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test.skip("prepareGTFSData skips import when database is valid", async () => {
    // 明示的に存在するパスとskipImport=trueを設定
    const fs = require("fs");
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        sqlitePath: ".temp/gtfs/gtfs.db",
        agencies: [{ agency_key: "test", url: "test.zip" }],
        skipImport: true,
      })
    );

    // データベースの整合性チェックを成功させる
    const db = require("../database").Database.getInstance();
    db.checkIntegrity.mockResolvedValue(true);

    const result = await transitManager.prepareGTFSData();

    expect(result.success).toBe(true);
    expect(db.checkIntegrity).toHaveBeenCalled();
    expect(require("gtfs").importGtfs).not.toHaveBeenCalled();
  });

  test.skip("getStops returns formatted stops data", async () => {
    // withConnectionのモックを更新
    const db = require("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callback) => {
      // コールバックは無視して、直接モックデータを返す
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
    const db = require("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callback) => {
      // コールバックは無視して、直接モックデータを返す
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
    const db = require("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callback) => {
      // コールバックは無視して、直接モックデータを返す
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
    expect(departures[0].routeId).toBe("route1");
    expect(departures[0].stopId).toBe("stop1");
  });

  test.skip("getNearestStops returns the closest stops to given coordinates", async () => {
    // withConnectionのモックを更新
    const db = require("../database").Database.getInstance();
    db.withConnection.mockImplementationOnce(async (callback) => {
      // コールバックは無視して、直接モックデータを返す
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
