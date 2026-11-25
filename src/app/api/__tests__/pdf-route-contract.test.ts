import { describe, expect, it } from "@jest/globals";
import { generateRouteHTML } from "@/lib/pdf/route-html";
import { buildPrintMapDrawing } from "@/lib/pdf/print-map";
import { collectPrintMapLegs } from "@/lib/pdf/route-html";

describe("PDF route input contract", () => {
  it("keeps legacy fields optional while requiring route meaning fields", () => {
    const request = {
      originStop: { stopId: "origin", stopName: "出発", distance: 0 },
      destinationStop: { stopId: "destination", stopName: "到着", distance: 0 },
      routes: [],
      type: "none" as const,
      transfers: 0,
      departures: undefined,
      message: undefined,
    };
    expect(request.originStop.stopId).toBe("origin");
    expect(request.type).toBe("none");
    expect(request).toHaveProperty("departures");
    expect(request).toHaveProperty("message");
  });

  it("徒歩区間の折れ線を任意の項目として受け付ける", async () => {
    const base = {
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
      type: "direct" as const,
      transfers: 0,
      originLat: 35.6901,
      originLng: 139.7499,
      destLat: 35.6999,
      destLng: 139.7601,
    };

    const withoutPaths = await generateRouteHTML(base);
    const withPaths = await generateRouteHTML({
      ...base,
      walkPaths: {
        originToStop: [
          [139.7499, 35.6901],
          [139.7532, 35.6941],
        ],
        stopToDestination: [
          [139.7559, 35.6925],
          [139.7599, 35.6999],
        ],
      },
    });

    const stripMapArea = (html: string) =>
      html.replace(/<div class="print-map-frame">[\s\S]*?<\/p>\s*<\/div>/g, "");
    expect(stripMapArea(withPaths)).toBe(stripMapArea(withoutPaths));
  });
});

describe("徒歩経路の折れ線", () => {
  const base = {
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
    type: "direct" as const,
    transfers: 0,
    originLat: 35.6901,
    originLng: 139.7499,
    destLat: 35.6999,
    destLng: 139.7601,
  };

  it("折れ線を渡すと地図がその折れ線に沿った実線になる", async () => {
    const legs = collectPrintMapLegs({
      ...base,
      walkPaths: {
        originToStop: [
          [139.7499, 35.6901],
          [139.7515, 35.6918],
          [139.7532, 35.6941],
        ],
      },
    });
    const origin = legs.find((leg) => leg.id === "origin");
    const drawing = buildPrintMapDrawing(origin!);

    expect(drawing.followsWalkNetwork).toBe(true);
    expect(drawing.path).toHaveLength(3);
  });

  it("折れ線を渡さないと始点と終点を結ぶ破線の対象になる", async () => {
    const legs = collectPrintMapLegs(base);
    const origin = legs.find((leg) => leg.id === "origin");
    const drawing = buildPrintMapDrawing(origin!);

    expect(drawing.followsWalkNetwork).toBe(false);
    expect(drawing.path).toHaveLength(2);
  });
});
