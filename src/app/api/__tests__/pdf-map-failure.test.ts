/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";

jest.mock("server-only", () => ({}), { virtual: true });

// next/jest の解決では NextResponse がコンストラクタとして使えないため、
// 実装が使う Response 継承の形だけを差し替える。
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server") as typeof import("next/server");
  class TestNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      });
    }
  }
  return { ...actual, NextResponse: TestNextResponse };
});
jest.mock("@/lib/api/rate-limit-middleware", () => ({
  appRouterRateLimitMiddleware: async () => undefined,
}));

const launch = jest.fn();
const waitForNetworkIdle = jest.fn();
const pdf = jest.fn();
const setContent = jest.fn();
const pageClose = jest.fn();
const browserClose = jest.fn();
const addStyleTag = jest.fn();
const addScriptTag = jest.fn();
const evaluate = jest.fn();

jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: (...args: unknown[]) => launch(...args) },
}));

function createBrowser() {
  const page = {
    setDefaultNavigationTimeout: jest.fn(),
    setDefaultTimeout: jest.fn(),
    setContent: (...args: unknown[]) => setContent(...args),
    waitForNetworkIdle: (...args: unknown[]) => waitForNetworkIdle(...args),
    addStyleTag: (...args: unknown[]) => addStyleTag(...args),
    addScriptTag: (...args: unknown[]) => addScriptTag(...args),
    evaluate: (...args: unknown[]) => evaluate(...args),
    pdf: (...args: unknown[]) => pdf(...args),
    close: (...args: unknown[]) => pageClose(...args),
  };
  return {
    newPage: jest.fn().mockResolvedValue(page),
    close: (...args: unknown[]) => browserClose(...args),
  };
}

const routeRequest = {
  originStop: {
    stopId: "origin",
    stopName: "出発",
    distance: 100,
    stop_lat: 35.6941,
    stop_lon: 139.7532,
  },
  destinationStop: {
    stopId: "destination",
    stopName: "到着",
    distance: 100,
    stop_lat: 35.6925,
    stop_lon: 139.7559,
  },
  routes: [
    {
      routeId: "000001",
      routeName: "麹町ルート",
      routeShortName: "",
      routeLongName: "麹町ルート",
      routeColor: "#000000",
      routeTextColor: "#ffffff",
    },
  ],
  type: "direct",
  transfers: 0,
  originLat: 35.6901,
  originLng: 139.7499,
  destLat: 35.6999,
  destLng: 139.7601,
};

function createRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({ "content-type": "application/json" }),
  } as unknown as NextRequest;
}

async function callPost(body: unknown) {
  const { POST } = await import("../pdf/generate/route");
  return POST(createRequest(body));
}

describe("POST /api/pdf/generate の地図失敗", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    launch.mockResolvedValue(createBrowser());
    setContent.mockResolvedValue(undefined);
    waitForNetworkIdle.mockResolvedValue(undefined);
    addStyleTag.mockResolvedValue(undefined);
    addScriptTag.mockResolvedValue(undefined);
    pageClose.mockResolvedValue(undefined);
    browserClose.mockResolvedValue(undefined);
    pdf.mockResolvedValue(Buffer.from("%PDF-1.4"));
  });

  it("地図の描画に失敗したらPDFを返さず500を返す", async () => {
    evaluate.mockResolvedValue({
      ok: false,
      failed: [
        { id: "origin", reason: "timeout" },
        { id: "destination", reason: "timeout" },
      ],
    });

    const response = await callPost(routeRequest);

    expect(response.status).toBe(500);
    expect(pdf).not.toHaveBeenCalled();
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain("PDFを生成できませんでした");
  });

  it("地図が1枚だけ失敗しても部分的なPDFを返さない", async () => {
    evaluate.mockResolvedValue({
      ok: false,
      failed: [{ id: "destination", reason: "map-error" }],
    });

    const response = await callPost(routeRequest);

    expect(response.status).toBe(500);
    expect(pdf).not.toHaveBeenCalled();
  });

  it("MapLibreを読み込めない場合もPDFを返さない", async () => {
    addScriptTag.mockRejectedValueOnce(new Error("injection failed"));

    const response = await callPost(routeRequest);

    expect(response.status).toBe(500);
    expect(pdf).not.toHaveBeenCalled();
  });

  it("地図を描けたときはPDFを返す", async () => {
    evaluate.mockResolvedValue({ ok: true, failed: [] });

    const response = await callPost(routeRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(pdf).toHaveBeenCalledTimes(1);
  });

  it("経路がないPDFは地図を描かずに返す", async () => {
    evaluate.mockResolvedValue({ ok: true, failed: [] });

    const response = await callPost({
      ...routeRequest,
      type: "none",
      routes: [],
    });

    expect(response.status).toBe(200);
    expect(addScriptTag).not.toHaveBeenCalled();
    expect(pdf).toHaveBeenCalledTimes(1);
  });
});
