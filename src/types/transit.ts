// これらの型定義は @/types/core に移動されました
// ローカルで異なる構造で使用される型のみ保持

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

// ローカル参照用にコア型をインポート
import { Departure, StopInfo } from "@/types/core";

// GTFS型は削除済み - 現在のコードベースで未使用

// 統合経路表示のための型定義
// StopInfo は core.ts に移動済み

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
