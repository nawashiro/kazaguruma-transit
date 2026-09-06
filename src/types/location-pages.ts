export interface LocationSuggestion {
  name: string;
  lat: number;
  lng: number;
}

export interface LocationSuggestionCategory {
  categoryName: string;
  locations: LocationSuggestion[];
}

export interface LocationPageLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  areaName: string;
  description?: string | null;
  descriptionCopyright?: string | null;
  imageUri?: string | null;
  imageCopyright?: string | null;
  /** @deprecated The source dataset uses this historical spelling. */
  imageCopylight?: string | null;
  uri?: string | null;
  nodeCopyright: string;
  nodeSourceId?: number | null;
  licence: string;
  licenceUri: string;
  [key: string]: unknown;
}

export interface LocationPageCategory {
  id: string;
  name: string;
  locations: LocationPageLocation[];
}

export interface LocationDataSnapshot {
  locationsDataVersion: string;
  generatedAt: string;
  suggestionCategories: LocationSuggestionCategory[];
  categories: LocationPageCategory[];
}

export type LocationDataLoader = () => Promise<unknown> | unknown;

export interface LocationDataLoadOptions {
  locationsDataVersion: string;
  generatedAt: string;
  loadMainFacilities: LocationDataLoader;
  loadKeyLocations: LocationDataLoader;
  loadTownGeoJson: LocationDataLoader;
}

export interface LocationDataArtifactOptions extends LocationDataLoadOptions {
  outputPath: string;
}
