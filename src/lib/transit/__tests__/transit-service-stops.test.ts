const mockFindOptimalRoute = jest.fn();

jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("../../db/prisma", () => ({ prisma: {} }));

jest.mock("../route-algorithm", () => ({
  ...jest.requireActual("../route-algorithm"),
  TimeTableRouter: class {
    findOptimalRoute = mockFindOptimalRoute;
  },
}));

jest.mock("../walk-network", () => {
  const actual = jest.requireActual("../walk-network");
  const fixture = jest.requireActual("../test-support/walk-network-fixture");
  return {
    ...actual,
    getWalkNetwork: () => fixture.createGridWalkGraph(),
  };
});

import { TransitService } from "../transit-service";
import type { TimeTableRouteResult } from "../route-algorithm";
import { gridPoint } from "../test-support/walk-network-fixture";

describe("従来型経路検索の徒歩距離", () => {
  const origin = { lat: 35.6938, lng: 139.7504 };
  const destination = { lat: 35.6938, lng: 139.7542 };
  const fromPoint = gridPoint(origin, 0.1);
  const toPoint = gridPoint(destination, 0.2);
  const from = {
    ...fromPoint,
    stopId: "from-stop",
    stopName: "出発バス停",
  };
  const to = {
    ...toPoint,
    stopId: "to-stop",
    stopName: "目的バス停",
  };

  const route: TimeTableRouteResult = {
    nodes: [
      {
        stopId: from.stopId,
        stopName: from.stopName,
        tripId: "trip1",
        routeId: "route1",
        routeName: "ルート1",
        arrivalTime: "10:00:00",
        departureTime: "10:14:00",
        stopSequence: 1,
        stopLat: from.lat,
        stopLon: from.lng,
      },
      {
        stopId: to.stopId,
        stopName: to.stopName,
        tripId: "trip1",
        routeId: "route1",
        routeName: "ルート1",
        arrivalTime: "11:00:00",
        departureTime: "11:03:00",
        stopSequence: 2,
        stopLat: to.lat,
        stopLon: to.lng,
      },
    ],
    transfers: 0,
    totalDuration: 49,
    departure: "10:14:00",
    arrival: "11:03:00",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOptimalRoute.mockResolvedValue([route]);
  });

  it("両端の停留所に利用者地点からの直線距離を保持する", async () => {
    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        findConventionalRoute: (...args: unknown[]) => Promise<{
          journeys: unknown[];
          stops: { id: string; distance: number }[];
        }>;
      }
    ).findConventionalRoute(from, to, origin, destination, "2026-10-27T10:00", true);

    const originStopRow = result.stops.find((stop) => stop.id === from.stopId);
    const destStopRow = result.stops.find((stop) => stop.id === to.stopId);
    expect(originStopRow).toBeDefined();
    expect(destStopRow).toBeDefined();
    // 200メートル以内の直線距離は、徒歩距離ではなく直線距離のまま返す。
    expect(originStopRow!.distance).toBeGreaterThan(0.09);
    expect(originStopRow!.distance).toBeLessThan(0.13);
    expect(destStopRow!.distance).toBeGreaterThan(0.18);
    expect(destStopRow!.distance).toBeLessThan(0.26);
  });

  it("優先条件によって通常経路の選択が変わる", async () => {
    const directRoute: TimeTableRouteResult = {
      ...route,
      nodes: [
        { ...route.nodes[0], departureTime: "10:29:00", arrivalTime: "10:29:00" },
        { ...route.nodes[1], departureTime: "11:00:00", arrivalTime: "11:00:00" },
      ],
      departure: "10:29:00",
      arrival: "11:00:00",
      transfers: 0,
    };
    const transferRoute: TimeTableRouteResult = {
      ...route,
      nodes: [
        { ...route.nodes[0], departureTime: "10:29:00", arrivalTime: "10:29:00" },
        {
          ...route.nodes[1],
          stopId: "transfer-stop",
          stopName: "乗換バス停",
          arrivalTime: "10:44:00",
          departureTime: "10:44:00",
        },
        {
          ...route.nodes[1],
          stopId: "transfer-stop",
          stopName: "乗換バス停",
          arrivalTime: "10:46:00",
          departureTime: "10:46:00",
        },
        { ...route.nodes[1], departureTime: "10:55:00", arrivalTime: "10:55:00" },
      ],
      departure: "10:29:00",
      arrival: "10:55:00",
      transfers: 1,
    };
    mockFindOptimalRoute.mockResolvedValue([transferRoute, directRoute]);

    const service = TransitService.getInstance() as unknown as {
      findConventionalRoute: (...args: unknown[]) => Promise<{
        journeys: { transfers: number; arrival: string }[];
      }>;
    };

    const walking = await service.findConventionalRoute(
      from,
      to,
      origin,
      destination,
      "2026-10-27T10:29",
      true,
      false
    );
    const speedy = await service.findConventionalRoute(
      from,
      to,
      origin,
      destination,
      "2026-10-27T10:29",
      true,
      true
    );

    expect(walking.journeys[0].transfers).toBe(0);
    expect(walking.journeys[0].arrival).toBe("11:00:00");
    expect(speedy.journeys[0].transfers).toBe(1);
    expect(speedy.journeys[0].arrival).toBe("10:55:00");
  });

  it("500mを超え750m以内の停留所も従来経路の対象にする", async () => {
    const service = TransitService.getInstance() as unknown as {
      findConventionalRoute: (...args: unknown[]) => Promise<{
        journeys: unknown[];
      }>;
    };

    // 格子は10m間隔なので、徒歩距離は10m単位に丸まる。
    const inside = { ...from, ...gridPoint(origin, 0.6) };
    const outside = { ...from, ...gridPoint(origin, 0.76) };
    const destStop = { ...to, ...gridPoint(destination, 0.1) };

    const accepted = await service.findConventionalRoute(
      inside,
      destStop,
      origin,
      destination,
      "2026-10-27T10:00",
      true
    );
    expect(accepted.journeys).not.toEqual([]);

    const rejected = await service.findConventionalRoute(
      outside,
      destStop,
      origin,
      destination,
      "2026-10-27T10:00",
      true
    );
    expect(rejected.journeys).toEqual([]);
  });

  it("区間ごとの徒歩距離をメートルで返す", async () => {
    const service = TransitService.getInstance() as unknown as {
      findConventionalRoute: (...args: unknown[]) => Promise<{
        originWalkMeters?: number;
        destinationWalkMeters?: number;
      }>;
    };

    const result = await service.findConventionalRoute(
      from,
      to,
      origin,
      destination,
      "2026-10-27T10:00",
      true
    );

    // 格子の刻みに丸まるため、公称100m・200mに対して数mの差が出る。
    expect(result.originWalkMeters).toBeCloseTo(109, 0);
    expect(result.destinationWalkMeters).toBeCloseTo(205, 0);
  });

  it("徒歩時間は格子状の徒歩距離から求める", async () => {
    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        findConventionalRoute: (...args: unknown[]) => Promise<{
          journeys: { walkingDistanceKm?: number; walkingTimeMinutes?: number }[];
        }>;
      }
    ).findConventionalRoute(from, to, origin, destination, "2026-10-27T10:00", true);

    const journey = result.journeys[0];
    // 出発地から停留所まで約100メートル、降車停留所から目的地まで約200メートル。
    expect(journey.walkingDistanceKm).toBeGreaterThan(0.25);
    expect(journey.walkingDistanceKm).toBeLessThan(0.4);
    expect(journey.walkingTimeMinutes).toBe(Math.round((journey.walkingDistanceKm as number) / 0.05));
  });
});
