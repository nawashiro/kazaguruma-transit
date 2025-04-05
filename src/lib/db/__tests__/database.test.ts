// @ts-nocheck
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import * as gtfs from "gtfs";

// GTFSモジュールの関数をモック
jest.mock("gtfs");

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

// データベースクラスをインポート
import { Database } from "../database";

describe("Database", () => {
  let db: Database;

  beforeEach(() => {
    // テスト前にモックをリセット
    jest.clearAllMocks();
    db = Database.getInstance();

    // モック関数の設定
    gtfs.openDb.mockResolvedValue({ mockDbHandle: true });
    gtfs.closeDb.mockResolvedValue(undefined);
    gtfs.getStops.mockResolvedValue([
      { stop_id: "stop1", stop_name: "Test Stop" },
    ]);
    gtfs.getRoutes.mockResolvedValue([
      { route_id: "route1", route_short_name: "Test Route" },
    ]);
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

  test("データベース接続の開閉が正常に動作すること", async () => {
    // 接続を開く
    await db.ensureConnection();

    // 2回目の呼び出しは問題なく動作する
    await db.ensureConnection();

    // 接続を閉じる
    await db.closeConnection();

    // 2回閉じても問題ない
    await db.closeConnection();
  });

  test("データベース整合性チェックが動作すること", async () => {
    // 接続状態でテストを実行（モックを使うので実際の戻り値はテストしない）
    await db.ensureConnection();

    await db.checkIntegrity();
    // 特に何もチェックしない - エラーが発生しなければOK
  });

  test("withConnection が正常に動作すること", async () => {
    const mockCallback = jest.fn().mockResolvedValue("result");

    const result = await db.withConnection(mockCallback);

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(result).toBe("result");
  });
});
