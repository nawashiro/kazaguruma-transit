export interface RouteDestinationLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteDestinationCategory {
  category: string;
  "category:en": string;
  locations: RouteDestinationLocation[];
}
