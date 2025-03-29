export interface Departure {
  routeId: string;
  routeName: string;
  stopId: string;
  stopName: string;
  direction: string;
  scheduledTime: string;
  realtime: boolean;
  delay: number | null;
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
