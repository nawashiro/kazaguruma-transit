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

import { TransitService } from "../transit-service";
import { prisma } from "../../db/prisma";
import type { TimeTableRouteResult } from "../route-algorithm";

const findManyMock = prisma.stop.findMany as unknown as jest.Mock;

const ORIGIN = { lat: 35.69, lng: 139.75 };
const DESTINATION = { lat: 35.685, lng: 139.748 };
const KM_PER_LAT_DEGREE = 111.195;

function stopAtNorthDistance(
  id: string,
  baseLat: number,
  distanceKm: number
): { id: string; name: string; lat: number; lon: number } {
  return {
    id,
    name: id,
    lat: baseLat + distanceKm / KM_PER_LAT_DEGREE,
    lon: ORIGIN.lng,
  };
}

function stopAtSouthDistance(
  id: string,
  baseLat: number,
  distanceKm: number
): { id: string; name: string; lat: number; lon: number } {
  return {
    id,
    name: id,
    lat: baseLat - distanceKm / KM_PER_LAT_DEGREE,
    lon: ORIGIN.lng,
  };
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
      stopLat: ORIGIN.lat + 0.05 / KM_PER_LAT_DEGREE,
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
      stopLat: DESTINATION.lat + 0.05 / KM_PER_LAT_DEGREE,
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

describe("バス停候補の最悪徒歩距離上限", () => {
  it("周辺候補の絞り込みは碁盤目補正後の徒歩距離で行う", async () => {
    findManyMock.mockResolvedValue([
      stopAtNorthDistance("stop-200m", ORIGIN.lat, 0.2),
      stopAtNorthDistance("stop-350m", ORIGIN.lat, 0.35),
      stopAtNorthDistance("stop-360m", ORIGIN.lat, 0.36),
    ]);

    const service = TransitService.getInstance();
    const stops = await (
      service as unknown as {
        findNearbyStops: (
          lat: number,
          lng: number,
          radiusKm: number
        ) => Promise<{ id: string; distance: number }[]>;
      }
    ).findNearbyStops(ORIGIN.lat, ORIGIN.lng, 0.5);

    expect(stops.map((stop) => stop.id)).toEqual(["stop-200m", "stop-350m"]);
  });

  it("最寄りバス停が上限を超える従来経路は経路を返さない", async () => {
    findManyMock.mockResolvedValue([
      stopAtNorthDistance("far-origin-stop", ORIGIN.lat, 2),
      stopAtSouthDistance("far-destination-stop", DESTINATION.lat, 2),
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

  it("上限以内の最寄りバス停がある従来経路は従来どおり検索する", async () => {
    findManyMock.mockResolvedValue([
      stopAtNorthDistance("near-origin-stop", ORIGIN.lat, 0.05),
      stopAtNorthDistance("near-destination-stop", DESTINATION.lat, 0.05),
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
