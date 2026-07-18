export interface CalendarStop {
  stopId: string;
  stopName: string;
  distance: number;
  stop_lat?: number;
  stop_lon?: number;
  lat?: number;
  lng?: number;
}

export interface CalendarRoute {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string;
  arrivalTime?: string;
  transfers?: CalendarTransfer[];
}

export interface CalendarTransfer {
  transferStop: {
    stopId: string;
    stopName: string;
    stopLat: number;
    stopLon: number;
  };
  nextRoute: CalendarRoute;
}

export interface RouteCalendarInput {
  originStop: CalendarStop;
  destinationStop: CalendarStop;
  routes: CalendarRoute[];
  selectedDateTime: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}
