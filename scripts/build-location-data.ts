import { resolve } from "node:path";
import { appConfig } from "../src/lib/config/app-config";
import { generateLocationDataArtifact } from "../src/lib/location/location-build-data";
import type { LocationDataArtifactOptions } from "../src/types/location-pages";

const FACILITY_DATA_BASE_URL =
  `https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_main_facilities@${appConfig.locationsDataVersion}/kazaguruma_json_min`;
const MAIN_FACILITIES_URL = `${FACILITY_DATA_BASE_URL}/main_facilities.json`;
const KEY_LOCATIONS_URL = `${FACILITY_DATA_BASE_URL}/key_locations.json`;
const TOWN_GEO_JSON_URL =
  "https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_town_geojson@latest/chiyoda_city.json";

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`位置データの取得に失敗しました (HTTP ${response.status})`);
  }

  const payload: unknown = await response.json();
  return payload;
}

async function main(): Promise<void> {
  const options: LocationDataArtifactOptions = {
    outputPath: resolve(process.cwd(), "src/generated/location-data.json"),
    locationsDataVersion: appConfig.locationsDataVersion,
    generatedAt: new Date().toISOString(),
    loadMainFacilities: () => fetchJson(MAIN_FACILITIES_URL),
    loadKeyLocations: () => fetchJson(KEY_LOCATIONS_URL),
    loadTownGeoJson: () => fetchJson(TOWN_GEO_JSON_URL),
  };

  const snapshot = await generateLocationDataArtifact(options);
  const suggestionCount = snapshot.suggestionCategories.reduce(
    (total, category) => total + category.locations.length,
    0,
  );
  const locationCount = snapshot.categories.reduce(
    (total, category) => total + category.locations.length,
    0,
  );

  console.log(
    `施設データを生成しました: ${snapshot.categories.length}カテゴリ、${locationCount}施設、トップ候補${suggestionCount}件`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`施設データ生成に失敗しました: ${message}`);
  process.exitCode = 1;
});
