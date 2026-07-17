import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { logger } from "@/utils/logger";
import { parseGtfsTime } from "./walking";

export const ROUTE_PARAMS = {
  DEFAULT_TIME_WINDOW: 180,
  MAX_TRANSFERS: 1,
  DEFAULT_MAX_TRANSFERS: 1,
  MIN_TRANSFER_WAIT: 1,
  MAX_TRANSFER_WAIT: 15,
  MAX_TRANSFER_CANDIDATES: 10,
} as const;

export interface TimeTableNode {
  stopId: string;
  stopName: string;
  tripId: string;
  routeId: string;
  routeName: string;
  arrivalTime: string;
  departureTime: string;
  stopSequence: number;
  stopLat: number;
  stopLon: number;
}

export interface TimeTableRouteResult {
  nodes: TimeTableNode[];
  transfers: number;
  totalDuration: number;
  departure: string;
  arrival: string;
}

type ScheduledTrip = Prisma.TripGetPayload<{
  include: {
    route: true;
    stop_times: { include: { stop: true } };
  };
}>;

type ScheduledStopTime = ScheduledTrip["stop_times"][number];

interface DestinationBoarding {
  trip: ScheduledTrip;
  boardingIndex: number;
  destinationIndex: number;
  departureSeconds: number;
}

interface SearchWindow {
  requestedSeconds: number;
  startSeconds: number;
  endSeconds: number;
  isDeparture: boolean;
}

const DAY_FIELDS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function formatDateForGtfs(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatTimeForGtfs(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function getDepartureSeconds(stopTime: ScheduledStopTime): number | undefined {
  return stopTime.departure_time
    ? parseGtfsTime(stopTime.departure_time)
    : undefined;
}

function getArrivalSeconds(stopTime: ScheduledStopTime): number | undefined {
  return stopTime.arrival_time
    ? parseGtfsTime(stopTime.arrival_time)
    : undefined;
}

function findFirstIndexAtOrAfter(
  boardings: DestinationBoarding[],
  minimumDepartureSeconds: number
): number {
  let low = 0;
  let high = boardings.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (boardings[middle].departureSeconds < minimumDepartureSeconds) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function createNode(
  trip: ScheduledTrip,
  stopTime: ScheduledStopTime
): TimeTableNode {
  const fallbackTime =
    stopTime.departure_time ?? stopTime.arrival_time ?? "00:00:00";

  return {
    stopId: stopTime.stop_id,
    stopName: stopTime.stop.name,
    tripId: trip.id,
    routeId: trip.route_id,
    routeName:
      trip.route.short_name ?? trip.route.long_name ?? trip.route_id,
    arrivalTime: stopTime.arrival_time ?? fallbackTime,
    departureTime: stopTime.departure_time ?? fallbackTime,
    stopSequence: stopTime.stop_sequence,
    stopLat: stopTime.stop.lat,
    stopLon: stopTime.stop.lon,
  };
}

function createRoute(
  nodes: TimeTableNode[],
  transfers: 0 | 1
): TimeTableRouteResult {
  const departure = nodes[0].departureTime;
  const arrival = nodes[nodes.length - 1].arrivalTime;
  return {
    nodes,
    transfers,
    totalDuration: (parseGtfsTime(arrival) - parseGtfsTime(departure)) / 60,
    departure,
    arrival,
  };
}

function isRouteInWindow(
  departureSeconds: number,
  arrivalSeconds: number,
  window: SearchWindow
): boolean {
  if (window.isDeparture) {
    return (
      departureSeconds >= window.startSeconds &&
      departureSeconds <= window.endSeconds
    );
  }

  return (
    departureSeconds >= window.startSeconds &&
    arrivalSeconds <= window.endSeconds
  );
}

function buildDestinationBoardingsByStop(
  trips: ScheduledTrip[],
  destinationStopId: string
): Map<string, DestinationBoarding[]> {
  const boardingsByStop = new Map<string, DestinationBoarding[]>();

  for (const trip of trips) {
    for (let destinationIndex = 1; destinationIndex < trip.stop_times.length; destinationIndex += 1) {
      if (trip.stop_times[destinationIndex].stop_id !== destinationStopId) {
        continue;
      }

      for (let boardingIndex = 0; boardingIndex < destinationIndex; boardingIndex += 1) {
        const boardingStopTime = trip.stop_times[boardingIndex];
        const departureSeconds = getDepartureSeconds(boardingStopTime);
        if (departureSeconds === undefined) {
          continue;
        }

        const boardings = boardingsByStop.get(boardingStopTime.stop_id) ?? [];
        boardings.push({
          trip,
          boardingIndex,
          destinationIndex,
          departureSeconds,
        });
        boardingsByStop.set(boardingStopTime.stop_id, boardings);
      }
    }
  }

  for (const boardings of boardingsByStop.values()) {
    boardings.sort(
      (first, second) => first.departureSeconds - second.departureSeconds
    );
  }

  return boardingsByStop;
}

function findRoutesInTimetable(
  trips: ScheduledTrip[],
  originStopId: string,
  destinationStopId: string,
  window: SearchWindow,
  maxTransfers: number
): TimeTableRouteResult[] {
  const routes: TimeTableRouteResult[] = [];
  const destinationBoardingsByStop =
    maxTransfers > 0
      ? buildDestinationBoardingsByStop(trips, destinationStopId)
      : new Map<string, DestinationBoarding[]>();

  for (const firstTrip of trips) {
    for (let originIndex = 0; originIndex < firstTrip.stop_times.length; originIndex += 1) {
      const originStopTime = firstTrip.stop_times[originIndex];
      if (originStopTime.stop_id !== originStopId) {
        continue;
      }

      const departureSeconds = getDepartureSeconds(originStopTime);
      if (departureSeconds === undefined) {
        continue;
      }

      for (let nextIndex = originIndex + 1; nextIndex < firstTrip.stop_times.length; nextIndex += 1) {
        const nextStopTime = firstTrip.stop_times[nextIndex];
        const arrivalSeconds = getArrivalSeconds(nextStopTime);
        if (arrivalSeconds === undefined) {
          continue;
        }

        if (nextStopTime.stop_id === destinationStopId) {
          if (isRouteInWindow(departureSeconds, arrivalSeconds, window)) {
            routes.push(
              createRoute(
                [
                  createNode(firstTrip, originStopTime),
                  createNode(firstTrip, nextStopTime),
                ],
                0
              )
            );
          }
          continue;
        }

        if (maxTransfers === 0) {
          continue;
        }

        const boardings = destinationBoardingsByStop.get(nextStopTime.stop_id);
        if (!boardings) {
          continue;
        }

        const minimumDepartureSeconds =
          arrivalSeconds + ROUTE_PARAMS.MIN_TRANSFER_WAIT * 60;
        const maximumDepartureSeconds =
          arrivalSeconds + ROUTE_PARAMS.MAX_TRANSFER_WAIT * 60;
        const firstBoardingIndex = findFirstIndexAtOrAfter(
          boardings,
          minimumDepartureSeconds
        );
        const lastBoardingIndex = Math.min(
          boardings.length,
          firstBoardingIndex + ROUTE_PARAMS.MAX_TRANSFER_CANDIDATES
        );

        for (let boardingIndex = firstBoardingIndex; boardingIndex < lastBoardingIndex; boardingIndex += 1) {
          const boarding = boardings[boardingIndex];
          if (boarding.departureSeconds > maximumDepartureSeconds) {
            break;
          }
          if (boarding.trip.id === firstTrip.id) {
            continue;
          }

          const destinationStopTime =
            boarding.trip.stop_times[boarding.destinationIndex];
          const finalArrivalSeconds = getArrivalSeconds(destinationStopTime);
          if (
            finalArrivalSeconds === undefined ||
            !isRouteInWindow(departureSeconds, finalArrivalSeconds, window)
          ) {
            continue;
          }

          routes.push(
            createRoute(
              [
                createNode(firstTrip, originStopTime),
                createNode(firstTrip, nextStopTime),
                createNode(
                  boarding.trip,
                  boarding.trip.stop_times[boarding.boardingIndex]
                ),
                createNode(boarding.trip, destinationStopTime),
              ],
              1
            )
          );
        }
      }
    }
  }

  const uniqueRoutes = Array.from(
    new Map(
      routes.map((route) => [
        `${route.nodes.map((node) => node.tripId).join("|")}:${route.departure}:${route.arrival}`,
        route,
      ])
    ).values()
  );

  return uniqueRoutes.sort((first, second) => {
    if (window.isDeparture) {
      return (
        parseGtfsTime(first.arrival) - parseGtfsTime(second.arrival) ||
        first.transfers - second.transfers ||
        parseGtfsTime(first.departure) - parseGtfsTime(second.departure)
      );
    }

    return (
      parseGtfsTime(second.departure) - parseGtfsTime(first.departure) ||
      first.transfers - second.transfers ||
      parseGtfsTime(second.arrival) - parseGtfsTime(first.arrival)
    );
  });
}

/**
 * 有効な便を一度だけ読み込み、停留所別の乗換索引を使って直通便と
 * 1回乗換便を探索する。
 */
export class TimeTableRouter {
  private cachedDate?: string;
  private cachedTrips?: Promise<ScheduledTrip[]>;

  private async getActiveServiceIds(date: Date): Promise<string[]> {
    const dateString = formatDateForGtfs(date);
    const dayField = DAY_FIELDS[date.getDay()];
    const [calendars, exceptions] = await Promise.all([
      prisma.calendar.findMany({
        where: {
          [dayField]: 1,
          start_date: { lte: dateString },
          end_date: { gte: dateString },
        },
        select: { service_id: true },
      }),
      prisma.calendarDate.findMany({
        where: { date: dateString },
        select: { service_id: true, exception_type: true },
      }),
    ]);

    const serviceIds = new Set(
      calendars.map((calendar) => calendar.service_id)
    );
    for (const exception of exceptions) {
      if (exception.exception_type === 1) {
        serviceIds.add(exception.service_id);
      } else if (exception.exception_type === 2) {
        serviceIds.delete(exception.service_id);
      }
    }
    return [...serviceIds];
  }

  private async loadActiveTrips(activeServiceIds: string[]): Promise<ScheduledTrip[]> {
    return prisma.trip.findMany({
      where: {
        service_id: { in: activeServiceIds },
      },
      include: {
        route: true,
        stop_times: {
          include: { stop: true },
          orderBy: { stop_sequence: "asc" },
        },
      },
    });
  }

  private loadSchedule(date: Date): Promise<ScheduledTrip[]> {
    const dateString = formatDateForGtfs(date);
    if (this.cachedDate === dateString && this.cachedTrips) {
      return this.cachedTrips;
    }

    this.cachedDate = dateString;
    this.cachedTrips = this.getActiveServiceIds(date).then((serviceIds) =>
      serviceIds.length > 0 ? this.loadActiveTrips(serviceIds) : []
    );
    return this.cachedTrips;
  }

  public async findOptimalRoute(
    originStopId: string,
    destinationStopId: string,
    time: Date,
    isDeparture = true,
    maxTransfers: number = ROUTE_PARAMS.DEFAULT_MAX_TRANSFERS,
    timeWindowMinutes: number = ROUTE_PARAMS.DEFAULT_TIME_WINDOW
  ): Promise<TimeTableRouteResult[]> {
    try {
      const trips = await this.loadSchedule(time);
      const requestedSeconds = parseGtfsTime(formatTimeForGtfs(time));
      const windowSeconds = timeWindowMinutes * 60;
      const window: SearchWindow = {
        requestedSeconds,
        startSeconds: isDeparture
          ? requestedSeconds
          : requestedSeconds - windowSeconds,
        endSeconds: isDeparture
          ? requestedSeconds + windowSeconds
          : requestedSeconds,
        isDeparture,
      };

      return findRoutesInTimetable(
        trips,
        originStopId,
        destinationStopId,
        window,
        Math.min(Math.max(maxTransfers, 0), ROUTE_PARAMS.MAX_TRANSFERS)
      );
    } catch (error) {
      logger.error("[TimeTableRouter] 経路検索エラー:", error);
      return [];
    }
  }
}
