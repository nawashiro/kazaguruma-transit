export interface RouteDestinationLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteDestinationCategory {
  category: string;
  categoryId: string;
  locations: RouteDestinationLocation[];
}
