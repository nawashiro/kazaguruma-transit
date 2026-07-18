import { prisma } from "../../db/prisma";
import { ROUTE_PARAMS, TimeTableRouter } from "../route-algorithm";

jest.mock("../../db/prisma", () => ({
  prisma: {
    calendar: { findMany: jest.fn() },
    calendarDate: { findMany: jest.fn() },
    trip: { findMany: jest.fn() },
  },
}));

const mockedCalendarFindMany = prisma.calendar.findMany as jest.Mock;
const mockedCalendarDateFindMany = prisma.calendarDate.findMany as jest.Mock;
const mockedTripFindMany = prisma.trip.findMany as jest.Mock;

interface TestStopTime {
  stop_id: string;
  stop_sequence: number;
  arrival_time: string;
  departure_time: string;
  stop: { id: string; name: string; lat: number; lon: number };
}

function stopTime(
  stopId: string,
  stopSequence: number,
  arrivalTime: string,
  departureTime = arrivalTime
): TestStopTime {
  return {
    stop_id: stopId,
    stop_sequence: stopSequence,
    arrival_time: arrivalTime,
    departure_time: departureTime,
    stop: {
      id: stopId,
      name: stopId,
      lat: 35 + stopSequence / 100,
      lon: 139 + stopSequence / 100,
    },
  };
}

function trip(
  id: string,
  routeId: string,
  stopTimes: TestStopTime[]
) {
  return {
    id,
    route_id: routeId,
    service_id: "weekday",
    route: { id: routeId, short_name: routeId, long_name: null },
    stop_times: stopTimes.map((item) => ({ ...item, trip_id: id })),
  };
}

describe("TimeTableRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCalendarFindMany.mockResolvedValue([
      { service_id: "weekday" },
    ]);
    mockedCalendarDateFindMany.mockResolvedValue([]);
  });

  test("乗換回数の上限をUIと同じ1回にする", () => {
    expect(ROUTE_PARAMS.DEFAULT_MAX_TRANSFERS).toBe(1);
    expect(ROUTE_PARAMS.MAX_TRANSFERS).toBe(1);
  });

  test("一括取得した時刻表を索引化して直通便と1回乗換便を探す", async () => {
    mockedTripFindMany.mockResolvedValue([
      trip("direct", "直通", [
        stopTime("origin", 1, "09:10:00"),
        stopTime("destination", 2, "09:50:00"),
      ]),
      trip("first", "前半", [
        stopTime("origin", 1, "09:05:00"),
        stopTime("transfer", 2, "09:20:00"),
      ]),
      trip("second", "後半", [
        stopTime("transfer", 1, "09:25:00"),
        stopTime("destination", 2, "09:40:00"),
      ]),
    ] as never);

    const routes = await new TimeTableRouter().findOptimalRoute(
      "origin",
      "destination",
      new Date(2026, 6, 20, 9, 0),
      true,
      1
    );

    expect(mockedTripFindMany).toHaveBeenCalledTimes(1);
    expect(routes.map((route) => route.transfers)).toEqual([1, 0]);
    expect(routes[0]).toMatchObject({
      departure: "09:05:00",
      arrival: "09:40:00",
      totalDuration: 35,
    });
  });

  test("到着指定時刻より後に到着する便を除外する", async () => {
    mockedTripFindMany.mockResolvedValue([
      trip("on-time", "定刻内", [
        stopTime("origin", 1, "09:00:00"),
        stopTime("destination", 2, "09:50:00"),
      ]),
      trip("late", "遅い便", [
        stopTime("origin", 1, "09:30:00"),
        stopTime("destination", 2, "10:05:00"),
      ]),
    ] as never);

    const routes = await new TimeTableRouter().findOptimalRoute(
      "origin",
      "destination",
      new Date(2026, 6, 20, 10, 0),
      false
    );

    expect(routes).toHaveLength(1);
    expect(routes[0].arrival).toBe("09:50:00");
  });

  test("同じ日の周辺停留所検索では時刻表を再取得しない", async () => {
    mockedTripFindMany.mockResolvedValue([]);
    const router = new TimeTableRouter();
    const date = new Date(2026, 6, 20, 9, 0);

    await router.findOptimalRoute("origin-a", "destination-a", date);
    await router.findOptimalRoute("origin-b", "destination-b", date);

    expect(mockedCalendarFindMany).toHaveBeenCalledTimes(1);
    expect(mockedCalendarDateFindMany).toHaveBeenCalledTimes(1);
    expect(mockedTripFindMany).toHaveBeenCalledTimes(1);
  });
});
