import { NextRequest } from "next/server";
import { GET } from "../transit/route";

const mockProcess = jest.fn();
const mockRateLimit = jest.fn();

jest.mock("@/lib/transit/transit-service", () => ({
  TransitService: {
    getInstance: () => ({ process: mockProcess }),
  },
}));

jest.mock("@/lib/api/rate-limit-middleware", () => ({
  appRouterRateLimitMiddleware: (...args: unknown[]) => mockRateLimit(...args),
}));

describe("GET /api/transit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue(null);
    mockProcess.mockResolvedValue({ success: true, data: { journeys: [], stops: [] } });
  });

  it("URIパラメータを既存のroute queryへ変換する", async () => {
    const request = new NextRequest(
      "http://localhost/api/transit?type=route&origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockProcess).toHaveBeenCalledWith({
      type: "route",
      origin: { lat: 35.68, lng: 139.76 },
      destination: { lat: 35.7, lng: 139.78 },
      time: "2026-07-18T09:30",
      isDeparture: true,
      prioritizeSpeed: false,
    });
  });

  it("不正なURIパラメータは検索せず400を返す", async () => {
    const request = new NextRequest(
      "http://localhost/api/transit?type=route&origin=91%2C139.76",
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({ success: false, error: expect.stringMatching(/検索条件/) }),
    );
    expect(mockProcess).not.toHaveBeenCalled();
  });
});
