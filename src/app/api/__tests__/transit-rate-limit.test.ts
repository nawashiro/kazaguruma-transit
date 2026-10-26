import { NextRequest } from "next/server";
import { GET, POST } from "../transit/route";
import { dataManager } from "@/lib/db/data-manager";
import { searchRoutes } from "@/lib/transit/search-routes";

jest.mock("server-only", () => ({}), { virtual: true });
jest.unmock("@/lib/api/rate-limit-middleware");
jest.mock("@/lib/db/data-manager", () => ({ dataManager: {
  init: jest.fn(), getRateLimitByIp: jest.fn(), resetRateLimit: jest.fn(), incrementRateLimit: jest.fn(),
} }));
const mockProcess = jest.fn();
jest.mock("@/lib/transit/transit-service", () => ({ TransitService: {
  getInstance: () => ({ process: mockProcess }),
} }));

const params = new URLSearchParams({ origin: "35,139", destination: "36,140", time: "2026-07-18T09:30", isDeparture: "true", prioritizeSpeed: "false" });
const db = jest.mocked(dataManager);
function request(ip?: string) {
  const req = new NextRequest(`http://localhost/api/transit?type=route&${params}`);
  Object.defineProperty(req, "headers", { value: new Headers(ip ? { "x-forwarded-for": ip } : {}) });
  return req;
}

describe("APIとページの共通利用制限", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.init.mockResolvedValue(undefined);
    db.getRateLimitByIp.mockResolvedValue(null);
    mockProcess.mockResolvedValue({ success: true, data: { journeys: [], stops: [] } });
  });
  it("GET・POSTとも既存の成功レスポンスと入力契約を保つ", async () => {
    const get = await GET(request("a"));
    const req = request("b");
    const query = { type: "route", origin: { lat: 35, lng: 139 }, destination: { lat: 36, lng: 140 }, time: "2026-07-18T09:30", isDeparture: true, prioritizeSpeed: false };
    Object.defineProperty(req, "json", { value: async () => query });
    const post = await POST(req);
    expect(await get.json()).toEqual({ success: true, data: { journeys: [], stops: [] } });
    expect(await post.json()).toEqual(await get.json());
    expect(mockProcess.mock.calls).toEqual([[query], [query]]);
    expect(db.incrementRateLimit.mock.calls).toEqual([["a"], ["b"]]);
  });
  it("POST上限でも既存の429契約を保ち計算しない", async () => {
    db.getRateLimitByIp.mockResolvedValue({ ip: "a", count: 60, lastAccess: Date.now() });
    const response = await POST(request("a"));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ success: false, error: "レート制限を超えました。1時間後に再度お試しください。", limitExceeded: true });
    expect(mockProcess).not.toHaveBeenCalled();
  });
  it("最初の転送IPごとに一度加算し、ヘッダーなしでは既存の既定IPを使う", async () => {
    await GET(request("192.0.2.1, 192.0.2.2"));
    await GET(request("192.0.2.3"));
    await GET(request());
    await GET(request(" ,proxy"));
    expect(db.incrementRateLimit.mock.calls).toEqual([["192.0.2.1"], ["192.0.2.3"], ["0.0.0.0"], [""]]);
  });
  it("60回は拒否し、59回は加算する", async () => {
    db.getRateLimitByIp.mockResolvedValue({ ip: "192.0.2.1", count: 60, lastAccess: Date.now() });
    const denied = await GET(request("192.0.2.1"));
    expect(denied.status).toBe(429);
    expect(await denied.json()).toEqual({ success: false, error: "レート制限を超えました。1時間後に再度お試しください。", limitExceeded: true });
    expect(db.incrementRateLimit).not.toHaveBeenCalled();
    db.getRateLimitByIp.mockResolvedValue({ ip: "192.0.2.1", count: 59, lastAccess: Date.now() });
    expect((await GET(request("192.0.2.1"))).status).toBe(200);
    expect(db.incrementRateLimit).toHaveBeenCalledTimes(1);
  });
  it("1時間を超えた窓だけリセットし一度加算する", async () => {
    jest.spyOn(Date, "now").mockReturnValue(10_000_000);
    db.getRateLimitByIp.mockResolvedValue({ ip: "a", count: 60, lastAccess: 6_400_000 });
    expect((await GET(request("a"))).status).toBe(429);
    db.getRateLimitByIp.mockResolvedValue({ ip: "a", count: 60, lastAccess: 6_399_999 });
    expect((await GET(request("a"))).status).toBe(200);
    expect(db.resetRateLimit).toHaveBeenCalledWith("a");
    expect(db.incrementRateLimit).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });
  it.each(["init", "getRateLimitByIp", "incrementRateLimit", "resetRateLimit"] as const)("判定・加算の失敗も429にする: %s", async (method) => {
    if (method === "resetRateLimit") db.getRateLimitByIp.mockResolvedValue({ ip: "a", count: 60, lastAccess: 0 });
    db[method].mockRejectedValue(new Error("db"));
    const response = await GET(request("a"));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ success: false, error: "サーバーエラーが発生しました。しばらく経ってからお試しください。", limitExceeded: true });
  });
  it("ページ検索でも同じIP制限を一度だけ適用する", async () => {
    await searchRoutes(params, new Headers({ "x-forwarded-for": "192.0.2.4, proxy" }));
    expect(db.incrementRateLimit.mock.calls).toEqual([["192.0.2.4"]]);
    db.getRateLimitByIp.mockResolvedValue({ ip: "192.0.2.4", count: 60, lastAccess: Date.now() });
    expect(await searchRoutes(params, new Headers({ "x-forwarded-for": "192.0.2.4" }))).toEqual({ status: "limited" });
  });
});
