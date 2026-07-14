import type { Location } from "@/types/core";

export interface RouteDisplayStop {
  stopId: string;
  stopName: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
}

export interface RouteDisplaySegment {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string;
  arrivalTime?: string;
  stopCount?: number;
  transferStop?: RouteDisplayStop;
}

export interface RouteDisplayMemo {
  id: string;
  content: string;
  busStopTag: string;
  evaluationStats: {
    positiveCount: number;
    negativeCount: number;
    score: number;
  };
}

export interface RouteDisplayModel {
  originStop: RouteDisplayStop;
  destinationStop: RouteDisplayStop;
  segments: RouteDisplaySegment[];
  type: "direct" | "transfer" | "none";
  transfers: number;
  origin?: Location;
  destination?: Location;
  memos?: RouteDisplayMemo[];
}
