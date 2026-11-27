import { describe, expect, it } from "@jest/globals";
import {
  collectPrintMapLegs,
  generateRouteHTML,
  type GeneratePdfRequest,
} from "@/lib/pdf/route-html";

function createRequest(
  overrides: Partial<GeneratePdfRequest> = {},
): GeneratePdfRequest {
  return {
    originStop: {
      stopId: "origin",
      stopName: "出発",
      distance: 120,
      stop_lat: 35.6941,
      stop_lon: 139.7532,
    },
    destinationStop: {
      stopId: "destination",
      stopName: "到着",
      distance: 80,
      stop_lat: 35.6925,
      stop_lon: 139.7559,
    },
    routes: [
      {
        routeId: "000001",
        routeName: "麹町ルート",
        routeShortName: "",
        routeLongName: "麹町ルート",
        routeColor: "#123456",
        routeTextColor: "#ffffff",
        departureTime: "09:10:00",
        arrivalTime: "09:20:00",
      },
    ],
    type: "direct",
    transfers: 0,
    originLat: 35.6901,
    originLng: 139.7499,
    destLat: 35.6999,
    destLng: 139.7601,
    ...overrides,
  };
}

function withoutMapFrames(html: string): string {
  return html
    .replace(/<div class="map-container"[\s\S]*?<\/div>\s*<\/div>/g, "")
    .replace(/<div class="print-map-frame">[\s\S]*?<\/div>\s*<\/div>/g, "");
}

describe("PDFの地図を含むHTML", () => {
  it("地図の描画領域を区間ごとに置く", async () => {
    const html = await generateRouteHTML(createRequest());
    expect(html).toContain('data-print-map="origin"');
    expect(html).toContain('data-print-map="destination"');
  });

  it("紙面に4つの出典を載せる", async () => {
    const html = await generateRouteHTML(createRequest());
    expect(html).toContain("OpenMapTiles");
    expect(html).toContain("OpenFreeMap");
    expect(html).toContain("OpenStreetMap contributors");
    expect(html).toContain("ODbL-1.0");
  });

  it("地図の枠と描画先を本文へ含める", async () => {
    const html = await generateRouteHTML(createRequest());
    expect(html).toContain('class="print-map"');
    expect(html).toContain('class="print-map-frame"');
  });

  it("座標がない区間の地図を置かない", async () => {
    const html = await generateRouteHTML(
      createRequest({ destLat: undefined, destLng: undefined }),
    );
    expect(html).toContain('data-print-map="origin"');
    expect(html).not.toContain('data-print-map="destination"');
  });

  it("出発地の座標が欠けていれば、その区間の地図を置かない", async () => {
    const html = await generateRouteHTML(
      createRequest({ originLat: undefined, originLng: undefined }),
    );
    expect(html).not.toContain('data-print-map="origin"');
    expect(html).toContain('data-print-map="destination"');
  });

  it("停留所の座標が欠けていれば、その区間の地図を置かない", async () => {
    const html = await generateRouteHTML(
      createRequest({
        originStop: { stopId: "origin", stopName: "出発", distance: 120 },
      }),
    );
    expect(html).not.toContain('data-print-map="origin"');
  });
});

describe("徒歩区間の座標の受け口", () => {
  it("折れ線を渡しても地図以外の本文は変わらない", async () => {
    const plain = await generateRouteHTML(createRequest());
    const withPaths = await generateRouteHTML(
      createRequest({
        walkPaths: {
          originToStop: [
            [139.7499, 35.6901],
            [139.7512, 35.692],
            [139.7532, 35.6941],
          ],
          stopToDestination: [
            [139.7559, 35.6925],
            [139.7599, 35.6999],
          ],
        },
      }),
    );
    expect(withoutMapFrames(withPaths)).toBe(withoutMapFrames(plain));
  });

  it("折れ線が1点だけでも地図とマーカーを残す", async () => {
    const legs = collectPrintMapLegs(
      createRequest({
        walkPaths: {
          originToStop: [[139.7532, 35.6941]],
          stopToDestination: [[139.7559, 35.6925]],
        },
      }),
    );
    expect(legs.find((leg) => leg.id === "origin")?.path).toHaveLength(1);

    const html = await generateRouteHTML(
      createRequest({
        walkPaths: {
          originToStop: [[139.7532, 35.6941]],
          stopToDestination: [[139.7559, 35.6925]],
        },
      }),
    );
    expect(html).toContain('data-print-map="origin"');
    expect(html).toContain('data-print-map="destination"');
  });

  it("地図の読み上げ名に両端の地名を含める", async () => {
    const html = await generateRouteHTML(createRequest());
    expect(html).toContain('aria-label="出発地から出発までの地図"');
    expect(html).toContain('aria-label="到着から目的地までの地図"');
  });

  it("折れ線の有無で描く線の座標が変わる", async () => {
    const plain = collectPrintMapLegs(createRequest());
    const withPaths = collectPrintMapLegs(
      createRequest({
        walkPaths: {
          originToStop: [
            [139.7499, 35.6901],
            [139.7532, 35.6941],
          ],
        },
      }),
    );
    expect(plain.find((leg) => leg.id === "origin")?.path).toBeUndefined();
    expect(withPaths.find((leg) => leg.id === "origin")?.path).toHaveLength(2);
  });
});

describe("経路のないPDF", () => {
  it("地図を持たない", async () => {
    const html = await generateRouteHTML(
      createRequest({ type: "none", routes: [] }),
    );
    expect(html).not.toContain("data-print-map");
    expect(html).not.toContain("print-map-frame");
  });

  it("経路がない旨の本文を保つ", async () => {
    const html = await generateRouteHTML(
      createRequest({ type: "none", routes: [] }),
    );
    expect(html).toContain("ルートが見つかりません");
    expect(html).toContain("この2つの地点を結ぶルートが見つかりませんでした");
    expect(html).toContain("別の交通手段をご検討ください");
  });

  it("描く地図を持たない", () => {
    expect(collectPrintMapLegs(createRequest({ type: "none" }))).toEqual([]);
  });
});
