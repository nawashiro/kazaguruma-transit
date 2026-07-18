import type { Journey, Location, NearbyStop } from "@/types/core";

export interface RouteDetailInfo {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string;
  arrivalTime?: string;
  transfers?: {
    transferStop: {
      stopId: string;
      stopName: string;
      stopLat: number;
      stopLon: number;
    };
    nextRoute: RouteDetailInfo;
  }[];
}

export interface RouteDisplayStop {
  stopId: string;
  stopName: string;
  distance: number;
  stop_lat?: number;
  stop_lon?: number;
  lat?: number;
  lng?: number;
}

export interface RouteResultViewModel {
  hasRoute: boolean;
  routes: RouteDetailInfo[];
  type: "direct" | "transfer" | "none";
  transfers: number;
  message?: string;
  originStop: RouteDisplayStop;
  destinationStop: RouteDisplayStop;
}

export interface RouteResultData {
  journeys: Journey[];
  stops: NearbyStop[];
  message?: string;
}

function findStop(stops: NearbyStop[], name: string): NearbyStop | undefined {
  return stops.find((stop) => stop.name === name);
}

function createRouteDetails(journey: Journey): RouteDetailInfo[] {
  if (!journey.segments?.length) {
    const routeName = journey.route || "不明";
    return [
      {
        routeId: "route-1",
        routeName,
        routeShortName: routeName,
        routeLongName: journey.route || "",
        routeColor: journey.color || "#000000",
        routeTextColor: journey.textColor || "#FFFFFF",
        departureTime: journey.departure,
        arrivalTime: journey.arrival,
      },
    ];
  }

  const firstSegment = journey.segments[0];
  const firstRoute: RouteDetailInfo = {
    routeId: "route-1",
    routeName: firstSegment.route,
    routeShortName: firstSegment.route,
    routeLongName: firstSegment.route,
    routeColor: firstSegment.color || "#000000",
    routeTextColor: firstSegment.textColor || "#FFFFFF",
    departureTime: firstSegment.departure,
    arrivalTime: firstSegment.arrival,
  };

  const secondSegment = journey.segments[1];
  if (journey.transferInfo && secondSegment) {
    firstRoute.transfers = [
      {
        transferStop: {
          stopId: "transfer-stop",
          stopName: journey.transferInfo.stop,
          stopLat: journey.transferInfo.location.lat,
          stopLon: journey.transferInfo.location.lng,
        },
        nextRoute: {
          routeId: "route-2",
          routeName: secondSegment.route,
          routeShortName: secondSegment.route,
          routeLongName: secondSegment.route,
          routeColor: secondSegment.color || "#000000",
          routeTextColor: secondSegment.textColor || "#FFFFFF",
          departureTime: secondSegment.departure,
          arrivalTime: secondSegment.arrival,
        },
      },
    ];
  }

  return [firstRoute];
}

export function createRouteResultViewModel(
  data: RouteResultData | undefined,
  origin: Location,
  destination: Location,
): RouteResultViewModel {
  const journey = data?.journeys[0];
  if (!journey) {
    return {
      hasRoute: false,
      routes: [],
      type: "none",
      transfers: 0,
      message: data?.message || "経路が見つかりませんでした",
      originStop: { stopId: "unknown", stopName: "最寄りバス停", distance: 0 },
      destinationStop: {
        stopId: "unknown",
        stopName: "目的地最寄りバス停",
        distance: 0,
      },
    };
  }

  const originStopInfo = findStop(data?.stops ?? [], journey.from);
  const destinationStopInfo = findStop(data?.stops ?? [], journey.to);

  return {
    hasRoute: true,
    routes: createRouteDetails(journey),
    type: journey.transfers > 0 ? "transfer" : "direct",
    transfers: journey.transfers || 0,
    message: data?.message,
    originStop: {
      stopId: originStopInfo?.id || "unknown",
      stopName: journey.from,
      distance: originStopInfo?.distance || 0,
      stop_lat: originStopInfo?.lat || 0,
      stop_lon: originStopInfo?.lng || 0,
      ...origin,
    },
    destinationStop: {
      stopId: destinationStopInfo?.id || "unknown",
      stopName: journey.to,
      distance: destinationStopInfo?.distance || 0,
      stop_lat: destinationStopInfo?.lat || 0,
      stop_lon: destinationStopInfo?.lng || 0,
      ...destination,
    },
  };
}
