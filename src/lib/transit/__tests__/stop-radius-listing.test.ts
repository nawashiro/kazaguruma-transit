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

const findManyMock = prisma.stop.findMany as unknown as jest.Mock;

type StopRow = { id: string; name: string; lat: number; lon: number };

function setRows(rows: StopRow[]): void {
  findManyMock.mockImplementation((args?: { take?: number }) =>
    Promise.resolve(
      args && args.take !== undefined ? rows.slice(0, args.take) : rows
    )
  );
}

const ORIGIN = { lat: 35.69, lng: 139.75 };
const KM_PER_LAT_DEGREE = 111.195;

function stopAtNorthDistance(
  id: string,
  distanceKm: number
): { id: string; name: string; lat: number; lon: number } {
  return {
    id,
    name: id,
    lat: ORIGIN.lat + distanceKm / KM_PER_LAT_DEGREE,
    lon: ORIGIN.lng,
  };
}

function stopAtEastDistance(
  id: string,
  distanceKm: number
): { id: string; name: string; lat: number; lon: number } {
  const KM_PER_LNG_DEGREE = 111.195 * Math.cos((35.69 * Math.PI) / 180);
  return {
    id,
    name: id,
    lat: ORIGIN.lat,
    lon: ORIGIN.lng + distanceKm / KM_PER_LNG_DEGREE,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("半径一覧のバス停検索", () => {
  it("DBの取得順が後ろのバス停も半径内に返る", async () => {
    setRows([
      ...Array.from({ length: 10 }, (_, index) =>
        stopAtNorthDistance(`far-${index}`, 2)
      ),
      stopAtNorthDistance("near-stop", 0.5),
      stopAtNorthDistance("far-11", 2.5),
    ]);

    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        findStopsByLocation: (
          location: { lat: number; lng: number },
          radius: number
        ) => Promise<{ success: boolean; data: { stops: { id: string }[] } }>;
      }
    ).findStopsByLocation(ORIGIN, 1);

    expect(
      result.data.stops.map((stop) => stop.id)
    ).toContain("near-stop");
    expect(
      result.data.stops.map((stop) => stop.id).filter((id) => id.startsWith("far"))
    ).toEqual([]);
  });

  it("距離はハバーサインの直線距離で判定する", async () => {
    setRows([
      stopAtNorthDistance("at-radius", 1),
      stopAtNorthDistance("past-radius", 1.05),
    ]);

    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        findStopsByLocation: (
          location: { lat: number; lng: number },
          radius: number
        ) => Promise<{
          success: boolean;
          data: { stops: { id: string; distance: number }[] };
        }>;
      }
    ).findStopsByLocation(ORIGIN, 1);

    expect(result.data.stops.map((stop) => stop.id)).toEqual(["at-radius"]);
    const atRadius = result.data.stops[0];
    expect(atRadius.distance).toBeGreaterThan(0.999);
    expect(atRadius.distance).toBeLessThan(1.001);
  });

  it("半径内が11件のとき近い順に10件を返す", async () => {
    const distances = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55];
    setRows(
      distances.map((distance, index) =>
        stopAtNorthDistance(`stop-${index}`, distance)
      )
    );

    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        findStopsByLocation: (
          location: { lat: number; lng: number },
          radius: number
        ) => Promise<{
          success: boolean;
          data: {
            stops: {
              id: string;
              distance: number;
            }[];
          };
        }>;
      }
    ).findStopsByLocation(ORIGIN, 1);

    expect(result.data.stops).toHaveLength(10);
    expect(result.data.stops[0].id).toBe("stop-0");
    expect(result.data.stops[9].id).toBe("stop-9");
  });

  it("半径内のバス停がないとき空の成功を返す", async () => {
    setRows([stopAtNorthDistance("far-stop", 2)]);

    const service = TransitService.getInstance();
    const result = await (
      service as unknown as {
        findStopsByLocation: (
          location: { lat: number; lng: number },
          radius: number
        ) => Promise<{ success: boolean; data: { stops: unknown[] } }>;
      }
    ).findStopsByLocation(ORIGIN, 0.5);

    expect(result.success).toBe(true);
    expect(result.data.stops).toEqual([]);
  });

  it("最寄りバス停の選択は実距離で行う", async () => {
    setRows([
      { id: "north-stop", name: "north", lat: ORIGIN.lat + 0.0029, lon: ORIGIN.lng },
      stopAtEastDistance("east-stop", 0.3166),
    ]);

    const service = TransitService.getInstance();
    const nearest = await (
      service as unknown as {
        findNearestStop: (
          lat: number,
          lng: number
        ) => Promise<{ stopId: string } | null>;
      }
    ).findNearestStop(ORIGIN.lat, ORIGIN.lng);

    expect(nearest!.stopId).toBe("east-stop");
  });
});
