const mockFindOptimalRoute = jest.fn();

jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("../../db/prisma", () => ({ prisma: {} }));

jest.mock("../route-algorithm", () => ({
  ...jest.requireActual("../route-algorithm"),
  TimeTableRouter: class {
    findOptimalRoute = mockFindOptimalRoute;
  },
}));

import { TransitService } from "../transit-service";
import type { TimeTableRouteResult } from "../route-algorithm";

describe("従来型経路検索の停留所距離", () => {
  const origin = { lat: 35.698353, lng: 139.773114 };
  const destination = { lat: 35.693807, lng: 139.750046 };
  const from = {
    lat: origin.lat + 0.001,
    lng: origin.lng,
    stopId: "from-stop",
    stopName: "出発バス停",
  };
  const to = {
    lat: destination.lat + 0.002,
    lng: destination.lng,
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
    expect(originStopRow!.distance).toBeGreaterThan(0.09);
    expect(originStopRow!.distance).toBeLessThan(0.13);
    expect(destStopRow!.distance).toBeGreaterThan(0.18);
    expect(destStopRow!.distance).toBeLessThan(0.26);
  });
});
