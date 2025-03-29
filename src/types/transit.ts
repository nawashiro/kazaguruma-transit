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
}

export interface Route {
  id: string;
  name: string;
  shortName?: string;
  longName?: string;
  color?: string;
  textColor?: string;
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
}
