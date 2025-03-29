// @ts-nocheck
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { Database } from "../database";

// GTFSモジュールのモック
jest.mock("gtfs", () => ({
  openDb: jest.fn().mockResolvedValue(undefined),
  closeDb: jest.fn().mockResolvedValue(undefined),
  getStops: jest
    .fn()
    .mockResolvedValue([{ stop_id: "stop1", stop_name: "Test Stop" }]),
  getRoutes: jest
    .fn()
    .mockResolvedValue([
      { route_id: "route1", route_short_name: "Test Route" },
    ]),
}));

// fs, pathモジュールのモック
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify({
      sqlitePath: ".temp/gtfs/gtfs.db",
      agencies: [{ agency_key: "test", url: "test.zip" }],
    })
  ),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlink: jest.fn((path, callback) => callback(null)),
}));

jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
}));

describe("Database", () => {
  let db: Database;

  beforeEach(() => {
    // テスト前にモックをリセット
    jest.clearAllMocks();
    db = Database.getInstance();
  });

  afterEach(async () => {
    // テスト後にデータベース接続を閉じる
    await db.closeConnection();
  });

  test("getInstance returns a singleton instance", () => {
    const instance1 = Database.getInstance();
    const instance2 = Database.getInstance();
    expect(instance1).toBe(instance2);
  });

  test("ensureConnection opens the database connection if not already open", async () => {
    const { openDb } = require("gtfs");

    await db.ensureConnection();

    expect(openDb).toHaveBeenCalledTimes(1);

    // 2回目の呼び出しでは既に接続が開いているため、openDbは再度呼ばれない
    await db.ensureConnection();
    expect(openDb).toHaveBeenCalledTimes(1);
  });

  test("closeConnection closes the database connection if open", async () => {
    const { closeDb } = require("gtfs");

    // まず接続を開く
    await db.ensureConnection();

    // 接続を閉じる
    await db.closeConnection();
    expect(closeDb).toHaveBeenCalledTimes(1);

    // 2回目の呼び出しでは既に接続が閉じているため、closeDbは再度呼ばれない
    await db.closeConnection();
    expect(closeDb).toHaveBeenCalledTimes(1);
  });

  test("checkIntegrity returns true when database is valid", async () => {
    // モックの戻り値を設定
    const { getStops, getRoutes } = require("gtfs");
    getStops.mockResolvedValue([{ stop_id: "stop1", stop_name: "Test Stop" }]);
    getRoutes.mockResolvedValue([
      { route_id: "route1", route_short_name: "Test Route" },
    ]);

    const result = await db.checkIntegrity();
    expect(result).toBe(true);
  });

  test("withConnection executes the callback with connection management", async () => {
    const mockCallback = jest.fn().mockResolvedValue("result");

    const result = await db.withConnection(mockCallback);

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(result).toBe("result");
  });
});
