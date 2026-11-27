export interface RouteDestinationLocation {
  name: string;
  lat: number;
  lng: number;
  /** 最寄り停留所までの徒歩距離（メートル）。目録が候補にしたときの値。 */
  walkMeters?: number;
}

export interface RouteDestinationCategory {
  category: string;
  categoryId: string;
  locations: RouteDestinationLocation[];
}
