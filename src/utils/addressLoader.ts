import { Location } from "@/types/core";

export interface AddressLocation {
  name: string;
  lat: number;
  lng: number;
  copyright?: string | null;
  licence?: string | null;
  licenceUri?: string | null;
  [key: string]: string | number | null | undefined;
}

export interface AddressCategory {
  category: string;
  locations: AddressLocation[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function convertToLocation(address: {
  name: string;
  lat: number;
  lng: number;
}): Location {
  return {
    lat: address.lat,
    lng: address.lng,
    address: address.name,
  };
}

export function isNonEmptyStringValue(value: unknown): value is string {
  return isNonEmptyString(value);
}
