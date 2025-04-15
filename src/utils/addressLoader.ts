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

// 主要施設データ用の拡張インターフェース
export interface KeyLocation extends AddressLocation {
  id: string;
  description: string | null;
  descriptionCopyright: string | null;
  imageUri: string | null;
  imageCopylight: string | null;
  uri: string | null;
  nodeCopyright: string;
  nodeSourceId: number | null;
  licence: string;
  licenceUri: string;
  [key: string]: any; // その他の属性（多言語名など）
}

export interface KeyLocationCategory {
  category: string;
  "category:en": string;
  locations: KeyLocation[];
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

// key_locations.jsonからデータを読み込む関数
export async function loadKeyLocationsData(): Promise<KeyLocationCategory[]> {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/nawashiro/chiyoda_city_main_facilities/refs/heads/main/kazaguruma_json/key_locations.json"
    );
    if (!response.ok) {
      throw new Error("主要施設データの取得に失敗しました");
    }
    const data = await response.json();
    return data as KeyLocationCategory[];
  } catch (error) {
    console.error("主要施設データ読み込みエラー:", error);
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
