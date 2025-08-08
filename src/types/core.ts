/**
 * 核心的な型定義 - データ整合性を保つため厳密に管理
 */

// === 基本データ型 ===

// 位置情報 - 緯度経度は数値精度が重要
export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

// バス停情報 - IDと名前は必須、位置情報も重要
export interface StopInfo {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  distance?: number;
}

// 別名でのバス停情報（APIレスポンス用）
export interface NearbyStop {
  id: string;
  name: string;
  distance: number;
  lat?: number;
  lng?: number;
}

// 路線情報 - 色情報は表示に影響するため正確性が必要
export interface RouteInfo {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
}

// 乗り換え情報
export interface TransferInfo {
  stop: string;
  waitTime: number;
  location: Location;
}

// 路線セグメント（乗り換えがある場合）
export interface RouteSegment {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: number;
  route: string;
  color?: string;
  textColor?: string;
}

// 経路情報
export interface Journey {
  departure: string;
  arrival: string;
  duration: number;
  transfers: number;
  route?: string;
  from: string;
  to: string;
  color?: string;
  textColor?: string;
  segments?: RouteSegment[];
  transferInfo?: TransferInfo;
  walkingDistanceKm?: number;
  walkingTimeMinutes?: number;
  userRequestedDepartureTime?: string;
}

// 出発情報（時刻表表示用）
export interface Departure {
  routeId: string;
  routeName: string;
  stopId: string;
  stopName?: string;
  direction?: string;
  scheduledTime?: string;
  realtime?: boolean;
  delay?: number | null;
  tripId?: string;
  time?: string;
  timeUntilDeparture?: string;
  msUntilDeparture?: number;
  headsign?: string;
}

// 時刻表エントリ
export interface TimetableEntry {
  departureTime: string;
  arrivalTime: string;
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  headsign?: string;
  directionId?: number;
}

// === UIフォームデータ ===

// フォームデータ - UI状態管理で一貫性が必要
export interface TransitFormData {
  stopId?: string;
  routeId?: string;
  origin?: Location;
  destination?: Location;
  dateTime?: string;
  isDeparture?: boolean;
}

// === APIクエリ型 ===

// 経路検索クエリ
export interface RouteQuery {
  type: "route";
  origin: Location;
  destination: Location;
  time?: string; // ISO8601形式の日時文字列
  isDeparture?: boolean; // trueの場合は出発時刻、falseの場合は到着時刻
  prioritizeSpeed?: boolean; // はやさ優先オプション
}

// バス停検索クエリ
export interface StopQuery {
  type: "stop";
  location?: Location;
  name?: string;
  radius?: number; // km単位、デフォルト1km
}

// 時刻表クエリ
export interface TimetableQuery {
  type: "timetable";
  stopId: string;
  time?: string; // ISO8601形式の日時文字列
}

export type TransitQuery = RouteQuery | StopQuery | TimetableQuery;

// === APIレスポンス型 ===

// 基本レスポンス
export interface TransitResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 経路検索レスポンス
export interface RouteResponse {
  success: boolean;
  data: {
    journeys: Journey[];
    stops: NearbyStop[];
    message?: string;
  };
}

// バス停検索レスポンス
export interface StopResponse {
  success: boolean;
  data: {
    stops: StopInfo[];
  };
}

// 時刻表レスポンス
export interface TimetableResponse {
  success: boolean;
  data: {
    timetable: TimetableEntry[];
  };
}