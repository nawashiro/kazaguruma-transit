import type { RouteDisplayModel, RouteDisplaySegment, RouteDisplayStop } from "@/types/route-display";

export const UNKNOWN_TIME = "時刻不明";

export interface LegacyRoute {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string;
  arrivalTime?: string;
  stopCount?: number;
  transfers?: Array<{ transferStop: RouteDisplayStop; nextRoute: LegacyRoute }>;
}

export function calculateArrivalTime(
  departureTime: string | undefined,
  durationMinutes = 30
): string {
  if (!departureTime || departureTime === UNKNOWN_TIME) return UNKNOWN_TIME;
  const match = departureTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return UNKNOWN_TIME;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59 || durationMinutes < 0) return UNKNOWN_TIME;
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function toSegment(route: LegacyRoute): RouteDisplaySegment {
  return {
    routeId: route.routeId,
    routeName: route.routeName,
    routeShortName: route.routeShortName,
    routeLongName: route.routeLongName,
    routeColor: route.routeColor,
    routeTextColor: route.routeTextColor,
    departureTime: route.departureTime,
    arrivalTime: route.arrivalTime,
    stopCount: route.stopCount,
  };
}

export function toRouteDisplayModel(input: {
  originStop: RouteDisplayStop;
  destinationStop: RouteDisplayStop;
  routes: LegacyRoute[];
  type: RouteDisplayModel["type"];
  transfers?: number;
}): RouteDisplayModel {
  const segments: RouteDisplaySegment[] = [];
  input.routes.forEach((route) => {
    segments.push(toSegment(route));
    route.transfers?.forEach((transfer) => {
      segments.push({ ...toSegment(transfer.nextRoute), transferStop: transfer.transferStop });
    });
  });
  return {
    originStop: input.originStop,
    destinationStop: input.destinationStop,
    segments,
    type: input.type,
    transfers: input.transfers ?? Math.max(0, segments.length - 1),
  };
}
