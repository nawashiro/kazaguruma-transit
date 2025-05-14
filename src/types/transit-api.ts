/**
 * トランジットAPIのクエリ型
 */
export type TransitQuery = RouteQuery | StopQuery | TimetableQuery;

/**
 * 経路検索クエリ
 */
export interface RouteQuery {
  type: "route";
  origin: {
    lat: number;
    lng: number;
  };
  destination: {
    lat: number;
    lng: number;
  };
  time?: string; // ISO8601形式の日時文字列
  isDeparture?: boolean; // trueの場合は出発時刻、falseの場合は到着時刻
}

/**
 * バス停検索クエリ
 */
export interface StopQuery {
  type: "stop";
  location?: {
    lat: number;
    lng: number;
  };
  name?: string;
  radius?: number; // km単位、デフォルト1km
}

/**
 * 時刻表クエリ
 */
export interface TimetableQuery {
  type: "timetable";
  stopId: string;
  time?: string; // ISO8601形式の日時文字列
}

/**
 * トランジットAPIのレスポンス型
 */
export interface TransitResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 経路検索レスポンス
 */
export interface RouteResponse {
  success: boolean;
  data: {
    journeys: Journey[];
    stops: NearbyStop[];
    message?: string;
  };
}

/**
 * 経路
 */
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
  walkingDistanceKm?: number; // 徒歩距離（キロメートル）
  walkingTimeMinutes?: number; // 徒歩時間（分）
}

/**
 * 経路セグメント（乗り換えがある場合）
 */
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

/**
 * 乗り換え情報
 */
export interface TransferInfo {
  stop: string;
  waitTime: number;
  location: {
    lat: number;
    lng: number;
  };
}

/**
 * 最寄りバス停
 */
export interface NearbyStop {
  id: string;
  name: string;
  distance: number;
  lat?: number;
  lng?: number;
}

/**
 * バス停検索レスポンス
 */
export interface StopResponse {
  success: boolean;
  data: {
    stops: StopInfo[];
  };
}

/**
 * バス停情報
 */
export interface StopInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance?: number;
}

/**
 * 時刻表レスポンス
 */
export interface TimetableResponse {
  success: boolean;
  data: {
    timetable: TimetableEntry[];
  };
}

/**
 * 時刻表エントリ
 */
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
