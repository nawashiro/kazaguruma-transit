// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Fetch APIのモック設定
import { enableMocks } from "jest-fetch-mock";
enableMocks();

// コンポーネントテスト用のモック設定
// NextResponseのモックは削除 - コンポーネントテストでは不要

// モックを設定
jest.mock(
  "gtfs",
  () => ({
    importGtfs: jest.fn(),
    getStops: jest.fn().mockResolvedValue([]),
    getRoutes: jest.fn().mockResolvedValue([]),
    getTrips: jest.fn().mockResolvedValue([]),
    getStoptimes: jest.fn().mockResolvedValue([]),
    openDb: jest.fn(),
    closeDb: jest.fn(),
  }),
  { virtual: true }
);

// NextResponseのモックを作成
jest.mock("next/server", () => {
  return {
    NextRequest: class MockNextRequest {
      constructor(url, init = {}) {
        this.url = url;
        this.method = init.method || "GET";
        this.headers = new Map();
        this.body = init.body || null;
        this.nextUrl = new URL(url, "http://localhost");
        this.searchParams = this.nextUrl.searchParams;
      }
    },
    NextResponse: {
      json: (body, init) => {
        return {
          status: init?.status || 200,
          json: () => Promise.resolve(body),
        };
      },
    },
  };
});

// fsモジュールをモック
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify({
      sqlitePath: ".temp/gtfs/gtfs.db",
      agencies: [{ agency_key: "test", url: "http://example.com/gtfs.zip" }],
      skipImport: true,
    })
  ),
}));
