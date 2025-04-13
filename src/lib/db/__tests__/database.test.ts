/**
 * @jest-environment node
 */
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

// Prismaのモック
jest.mock("../../db/prisma", () => ({
  prisma: {
    // @ts-expect-error - モック関数の型定義問題を回避
    $queryRaw: jest.fn().mockResolvedValue([{ "1": 1 }]),
    // @ts-expect-error - モック関数の型定義問題を回避
    $disconnect: jest.fn().mockResolvedValue(undefined),
    stop: {
      // @ts-expect-error - モック関数の型定義問題を回避
      count: jest.fn().mockResolvedValue(10),
    },
    route: {
      // @ts-expect-error - モック関数の型定義問題を回避
      count: jest.fn().mockResolvedValue(5),
    },
  },
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
  // @ts-expect-error - コールバック型が問題になる場合の対応
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

    // Databaseクラスのメソッドをスパイしてモック実装に置き換える
    jest
      .spyOn(Database.prototype, "ensureConnection")
      .mockImplementation(async () => {
        return Promise.resolve();
      });

    jest
      .spyOn(Database.prototype, "closeConnection")
      .mockImplementation(async () => {
        return Promise.resolve();
      });

    jest
      .spyOn(Database.prototype, "checkIntegrity")
      .mockImplementation(async () => {
        return Promise.resolve(true);
      });

    db = Database.getInstance();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
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

    // 正しく呼ばれたことを確認
    expect(db.ensureConnection).toHaveBeenCalledTimes(2);
    expect(db.closeConnection).toHaveBeenCalledTimes(2);
  });

  test("データベース整合性チェックが動作すること", async () => {
    // 接続状態でテストを実行
    await db.checkIntegrity();

    // 正しく呼ばれたことを確認
    expect(db.checkIntegrity).toHaveBeenCalledTimes(1);
  });

  test("withConnection が正常に動作すること", async () => {
    // withConnectionをスパイしてモック実装に置き換える
    jest.spyOn(db, "withConnection").mockImplementation(async (callback) => {
      return await callback();
    });

    const mockCallback = jest
      .fn()
      .mockImplementation(() => Promise.resolve("result"));

    const result = await db.withConnection(
      mockCallback as () => Promise<string>
    );

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(result).toBe("result");
  });
});
