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

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface TransitFormData {
  stopId?: string;
  routeId?: string;
  origin?: Location;
  destination?: Location;
  dateTime?: string;
  isDeparture?: boolean;
}

export interface GTFSStop {
  stop_id: string;
  stop_name: string;
  stop_code?: string;
  stop_lat: string;
  stop_lon: string;
  [key: string]: any;
}

export interface GTFSRoute {
  route_id: string;
  route_short_name?: string;
  route_long_name?: string;
  route_color?: string;
  route_text_color?: string;
  [key: string]: any;
}

export interface GTFSStopTime {
  trip_id?: string;
  arrival_time?: string;
  departure_time?: string;
  stop_id?: string;
  stop_sequence?: number;
  stop_headsign?: string;
  pickup_type?: number;
  drop_off_type?: number;
  shape_dist_traveled?: number;
  timepoint?: number;
  [key: string]: any;
}

export interface GTFSTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;
  [key: string]: any;
}

// 統合経路表示のための型定義
export interface StopInfo {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  distance?: number;
}

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
}
