import { searchRoutes } from "../search-routes";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { TransitService } from "../transit-service";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/api/rate-limit", () => ({ checkRateLimit: jest.fn(), getClientIp: (headers: Headers) => headers.get("x-forwarded-for") || "0.0.0.0" }));
jest.mock("../transit-service", () => ({ TransitService: { getInstance: jest.fn() } }));
const process = jest.fn();
const params = new URLSearchParams({ origin: "35,139", destination: "36,140", time: "2026-07-18T09:30", isDeparture: "false", prioritizeSpeed: "true" });
const journey = { from: "始発", to: "終点", departure: "09:30", arrival: "10:00", duration: 30, route: "路線A", transfers: 0 };

describe("サーバー経路検索", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    jest.mocked(TransitService.getInstance).mockReturnValue({ process } as unknown as TransitService);
    process.mockResolvedValue({ success: true, data: { journeys: [journey], stops: [] } });
    global.fetch = jest.fn();
  });
  it.each([0, 1])("直通・乗換を既存モデルへ変換する: transfers=%s", async (transfers) => {
    process.mockResolvedValue({ success: true, data: { journeys: [{ ...journey, transfers }], stops: [] } });
    const result = await searchRoutes(params, new Headers({ "x-forwarded-for": "a" }));
    expect(result).toEqual(expect.objectContaining({ status: "success", routeInfo: expect.objectContaining({ type: transfers ? "transfer" : "direct" }) }));
    expect(process).toHaveBeenCalledWith({ type: "route", origin: { lat: 35, lng: 139 }, destination: { lat: 36, lng: 140 }, time: "2026-07-18T09:30", isDeparture: false, prioritizeSpeed: true });
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
  it("経路なしを成功結果として返す", async () => {
    process.mockResolvedValue({ success: true, data: { journeys: [], stops: [] } });
    expect(await searchRoutes(params, new Headers())).toEqual(expect.objectContaining({ status: "success", routeInfo: expect.objectContaining({ type: "none" }) }));
  });
  it("条件不正では計算しない", async () => {
    expect(await searchRoutes(new URLSearchParams(), new Headers())).toEqual({ status: "error", message: "検索条件が不足しているか、正しくありません。" });
    expect(process).not.toHaveBeenCalled();
  });
  it.each(["response", "throw"])("検索失敗をエラーとして返す: %s", async (kind) => {
    if (kind === "throw") process.mockRejectedValue(new Error("障害"));
    else process.mockResolvedValue({ success: false, error: "障害" });
    expect(await searchRoutes(params, new Headers())).toEqual({ status: "error", message: "経路検索に失敗しました。時間をおいて再度お試しください。" });
  });
  it("制限時は計算しない", async () => {
    jest.mocked(checkRateLimit).mockResolvedValue({ allowed: false, error: "制限" });
    expect(await searchRoutes(params, new Headers())).toEqual({ status: "limited" });
    expect(process).not.toHaveBeenCalled();
  });
});
