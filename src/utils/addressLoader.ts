import { Location } from "../types/transit";

export interface AddressLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface AddressCategory {
  category: string;
  locations: AddressLocation[];
}

export async function loadAddressData(): Promise<AddressCategory[]> {
  try {
    const response = await fetch("/address.json");
    if (!response.ok) {
      throw new Error("住所データの取得に失敗しました");
    }
    const data = await response.json();
    return data as AddressCategory[];
  } catch (error) {
    console.error("住所データ読み込みエラー:", error);
    return [];
  }
}

export function convertToLocation(address: AddressLocation): Location {
  return {
    lat: address.lat,
    lng: address.lng,
    address: address.name,
  };
}
