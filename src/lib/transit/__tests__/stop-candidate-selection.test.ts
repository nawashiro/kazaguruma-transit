const mockFindOptimalRoute = jest.fn();

jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("../../db/prisma", () => ({
  prisma: { stop: { findMany: jest.fn() } },
}));

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
import { prisma } from "../../db/prisma";
import type { TimeTableRouteResult } from "../route-algorithm";
import { gridPoint } from "../test-support/walk-network-fixture";

const findManyMock = prisma.stop.findMany as unknown as jest.Mock;

const ORIGIN = { lat: 35.69, lng: 139.75 };
const DESTINATION = { lat: 35.685, lng: 139.748 };

function stopAt(id: string, base: { lat: number; lng: number }, northKm: number, eastKm = 0) {
  const point = gridPoint(base, northKm, eastKm);
  return { id, name: id, lat: point.lat, lon: point.lng };
}

const route: TimeTableRouteResult = {
  nodes: [
    {
      stopId: "near-origin-stop",
      stopName: "出発バス停",
      tripId: "trip1",
      routeId: "route1",
      routeName: "ルート1",
      arrivalTime: "10:00:00",
      departureTime: "10:14:00",
      stopSequence: 1,
      stopLat: ORIGIN.lat,
      stopLon: ORIGIN.lng,
    },
    {
      stopId: "near-destination-stop",
      stopName: "目的バス停",
      tripId: "trip1",
      routeId: "route1",
      routeName: "ルート1",
      arrivalTime: "11:00:00",
      departureTime: "11:03:00",
      stopSequence: 2,
      stopLat: DESTINATION.lat,
      stopLon: DESTINATION.lng,
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

describe("徒歩距離によるバス停候補の絞り込み", () => {
  it("徒歩距離が500メートル以内の停留所を候補にする", async () => {
    findManyMock.mockResolvedValue([
      stopAt("stop-200m", ORIGIN, 0.2),
      stopAt("stop-400m", ORIGIN, 0.4),
      stopAt("stop-600m", ORIGIN, 0.6),
    ]);

    const service = TransitService.getInstance();
    const stops = await (
      service as unknown as {
        findNearbyStops: (
          lat: number,
          lng: number,
          radiusKm: number,
        ) => Promise<{ id: string; distance: number }[]>;
      }
    ).findNearbyStops(ORIGIN.lat, ORIGIN.lng, 0.5);

    expect(stops.map((stop) => stop.id)).toEqual(["stop-200m", "stop-400m"]);
  });

  it("道から離れた停留所は接続区間の分だけ徒歩距離が伸びる", async () => {
    findManyMock.mockResolvedValue([
      stopAt("on-road", ORIGIN, 0.3),
      stopAt("off-road", ORIGIN, 0.3, 0.1),
    ]);

    const service = TransitService.getInstance();
    const stops = await (
      service as unknown as {
        findNearbyStops: (
          lat: number,
          lng: number,
          radiusKm: number,
        ) => Promise<{ id: string; distance: number }[]>;
      }
    ).findNearbyStops(ORIGIN.lat, ORIGIN.lng, 0.5);

    expect(stops.map((stop) => stop.id)).toEqual(["on-road", "off-road"]);
  });

  it("最寄り停留所が徒歩距離で上限を超える従来経路は経路を返さない", async () => {
    findManyMock.mockResolvedValue([
      stopAt("far-origin-stop", ORIGIN, 2),
      stopAt("far-destination-stop", DESTINATION, 2),
    ]);

    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        searchRoute: (query: unknown) => Promise<{
          journeys: unknown[];
          stops: unknown[];
        }>;
      }
    ).searchRoute({
      origin: ORIGIN,
      destination: DESTINATION,
      time: "2026-11-01T10:00",
      isDeparture: true,
    });

    expect(result.journeys).toEqual([]);
    expect(result.stops).toEqual([]);
    expect(mockFindOptimalRoute).not.toHaveBeenCalled();
  });

  it("上限を超えた地点と徒歩距離をblockedByで返す", async () => {
    findManyMock.mockResolvedValue([
      stopAt("near-origin-stop", ORIGIN, 0.2),
      stopAt("far-destination-stop", DESTINATION, 2),
    ]);

    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        searchRoute: (query: unknown) => Promise<{
          blockedBy?: { field: "origin" | "destination"; meters: number };
        }>;
      }
    ).searchRoute({
      origin: ORIGIN,
      destination: DESTINATION,
      time: "2026-11-01T10:00",
      isDeparture: true,
    });

    expect(result.blockedBy?.field).toBe("destination");
    expect(result.blockedBy?.meters).toBeGreaterThan(750);
  });

  it("上限以内の最寄り停留所がある従来経路は従来どおり検索する", async () => {
    findManyMock.mockResolvedValue([
      stopAt("near-origin-stop", ORIGIN, 0.05),
      stopAt("near-destination-stop", DESTINATION, 0.05),
    ]);

    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        searchRoute: (query: unknown) => Promise<{ journeys: unknown[] }>;
      }
    ).searchRoute({
      origin: ORIGIN,
      destination: DESTINATION,
      time: "2026-11-01T10:00",
      isDeparture: true,
    });

    expect(mockFindOptimalRoute).toHaveBeenCalledTimes(1);
    expect(result.journeys).not.toEqual([]);
  });
});
