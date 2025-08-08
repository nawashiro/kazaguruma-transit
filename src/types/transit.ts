// These types have been moved to @/types/core
// Keeping only types that are used locally with different structures

export interface TransitApiResponse {
  departures: Departure[];
  error?: string;
}

export interface Stop {
  id: string;
  name: string;
  code?: string;
  stop_id?: string;
  stop_name?: string;
}

export interface Route {
  id: string;
  name: string;
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
  route_id?: string;
  route_short_name?: string;
  route_long_name?: string;
}

// Import the core types for local reference
import { Departure, StopInfo } from "@/types/core";

// GTFS types removed - not used in current codebase

// 統合経路表示のための型定義
// StopInfo moved to core.ts

export interface TransferInfo {
  transferStop: {
    stopId: string;
    stopName: string;
    stopLat: number;
    stopLon: number;
  };
  nextRoute: RouteDetail;
}

export interface RouteDetail {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  transfers?: TransferInfo[];
}

export interface RouteResponse {
  originStop: StopInfo;
  destinationStop: StopInfo;
  routes: RouteDetail[];
  type: "direct" | "transfer" | "none";
  transfers: number;
  message?: string;
  originToStopMapLink?: string;
  stopToDestinationMapLink?: string;
}
