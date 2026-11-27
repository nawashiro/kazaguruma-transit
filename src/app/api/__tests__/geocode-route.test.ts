import { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";

import { GET } from "../geocode/route";
import { dataManager } from "@/lib/db/data-manager";

jest.mock("server-only", () => ({}), { virtual: true });
jest.unmock("@/lib/api/rate-limit-middleware");
jest.mock("@/lib/db/data-manager", () => ({
  dataManager: {
    init: jest.fn(),
    getRateLimitByIp: jest.fn(),
    resetRateLimit: jest.fn(),
    incrementRateLimit: jest.fn(),
  },
}));

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    stop: {
      findMany: jest.fn(),
    },
  },
}));

const db = jest.mocked(dataManager);
const findManyMock = prisma.stop.findMany as unknown as jest.Mock;

function request(query: string, ip = "192.0.2.1"): NextRequest {
  const req = new NextRequest(`http://localhost/api/geocode?${query}`);
  Object.defineProperty(req, "headers", {
    value: new Headers({ "x-forwarded-for": ip }),
  });
  return req;
}

describe("/api/geocode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.init.mockResolvedValue(undefined);
    db.getRateLimitByIp.mockResolvedValue(null);
    db.incrementRateLimit.mockResolvedValue(undefined);
    findManyMock.mockResolvedValue([]);
  });

  it("名前で検索して候補を最大5件返す", async () => {
    const response = await GET(request("q=%E5%8D%83%E4%BB%A3%E7%94%B0"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.length).toBeLessThanOrEqual(5);
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        address: expect.any(String),
        lat: expect.any(Number),
        lng: expect.any(Number),
        kind: expect.any(String),
      }),
    );
  });

  it("候補に最寄り停留所までの徒歩距離を付ける", async () => {
    findManyMock.mockResolvedValue([
      { id: "STP_000001_001", lat: 35.694049, lon: 139.753241 },
      { id: "STP_000001_002", lat: 35.690651, lon: 139.757841 },
    ]);

    const response = await GET(request(`q=${encodeURIComponent("科学技術館")}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    const hit = body.results.find(
      (entry: { name: string }) => entry.name === "科学技術館",
    );
    expect(hit.walkMeters).toBeGreaterThan(500);
    expect(hit.walkMeters).toBeLessThan(600);
  });

  it("停留所を読めないときは徒歩距離を付けずに成功する", async () => {
    findManyMock.mockRejectedValue(new Error("no database"));

    const response = await GET(request(`q=${encodeURIComponent("科学技術館")}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results.length).toBeGreaterThan(0);
    for (const entry of body.results) {
      expect(entry.walkMeters).toBeUndefined();
    }
  });

  it("番地として解決できた検索は1件だけ返す", async () => {
    const response = await GET(request("q=%E9%9C%9E%E3%81%8C%E9%96%A21-1"));
    const body = await response.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].address).toBe("千代田区霞が関一丁目1番");
  });

  it("町名の途中でも住所候補を返す", async () => {
    const response = await GET(request("q=%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA%E7%A5%9E%E7%94%B0%E5%92%8C%E6%B3%89%E7%94%BA"));
    const body = await response.json();
    expect(response.status).toBe(200);
    const addresses = body.results
      .filter((entry: { kind: string }) => entry.kind === "address")
      .map((entry: { address: string }) => entry.address);
    expect(addresses).toEqual([
      "千代田区神田和泉町1番",
      "千代田区神田和泉町2番",
      "千代田区神田和泉町3番",
    ]);
  });

  it("街区のあとの号を街区として読まない", async () => {
    const response = await GET(request("q=%E9%9A%BC%E7%94%BA4-1"));
    const body = await response.json();
    expect(body.results[0].address).toBe("千代田区隼町4番");
  });

  it("候補が無いときも成功として空配列を返す", async () => {
    const response = await GET(request("q=%E3%81%82%E3%81%82%E3%81%82%E3%81%82"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.results).toEqual([]);
  });

  it("座標から住所を逆引きする", async () => {
    const response = await GET(request("lat=35.6941626&lng=139.7535624"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.location.address).toMatch(/^千代田区/);
  });

  it("千代田区の外の座標には404を返す", async () => {
    const response = await GET(request("lat=35.5&lng=139.5"));
    expect(response.status).toBe(404);
    expect((await response.json()).success).toBe(false);
  });

  it("座標が数値でなければ400を返す", async () => {
    const response = await GET(request("lat=abc&lng=139.75"));
    expect(response.status).toBe(400);
  });

  it("address パラメーターには400を返す", async () => {
    const response = await GET(request("address=%E9%9C%9E%E3%81%8C%E9%96%A2"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/address/);
  });

  it("q も座標も無ければ400を返す", async () => {
    const response = await GET(request(""));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/q/);
  });

  it("同じ利用元から繰り返し検索しても429を返さない", async () => {
    db.getRateLimitByIp.mockResolvedValue({
      ip: "192.0.2.1",
      count: 600,
      lastAccess: Date.now(),
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await GET(request("q=%E5%8D%83%E4%BB%A3%E7%94%B0"));
      expect(response.status).toBe(200);
      expect((await response.json()).results.length).toBeGreaterThan(0);
    }
    expect(db.incrementRateLimit).not.toHaveBeenCalled();
  });
});
