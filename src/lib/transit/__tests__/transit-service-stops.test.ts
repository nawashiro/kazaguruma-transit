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
