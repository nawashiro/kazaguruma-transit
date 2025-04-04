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
    const response = await fetch(
      "https://raw.githubusercontent.com/nawashiro/chiyoda_city_main_facilities/refs/heads/main/kazaguruma_json/main_facilities.json"
    );
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
