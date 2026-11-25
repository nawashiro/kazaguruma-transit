import { normalizeSearchTerm } from "../../src/lib/location/geocode-address";
import type {
  GeocodeBlock,
  GeocodeKind,
  GeocodeName,
} from "../../src/lib/location/geocode-index";
import type { OSMNamedFeature } from "./osm-extract";

export interface ArtifactNameInput {
  name: string;
  lat: number;
  lng: number;
  categoryIds: string[];
}

export interface StopNameInput {
  name: string;
  lat: number;
  lng: number;
}

/** gif-poi のコードから種別を決める。分類は dataset のカテゴリ語彙に従う。 */
const GIP_POI_KIND: Record<string, GeocodeKind> = {
  "0702": "culture",
  "0703": "culture",
  "0801": "culture",
  "0802": "culture",
  "0803": "culture",
  "0903": "other",
  "1003": "park",
  "1004": "park",
  "1011": "culture",
  "1219": "public",
  "1302": "public",
  "1304": "public",
  "1306": "public",
  "1307": "public",
  "1402": "welfare",
  "1403": "welfare",
  "1499": "welfare",
  "1503": "school",
  "1512": "culture",
  "1601": "medical",
  "1606": "medical",
  "2603": "shop",
};

export function kindFromCategoryIds(categoryIds: string[]): GeocodeKind {
  const kinds = categoryIds
    .map((id) => GIP_POI_KIND[id])
    .filter((kind): kind is GeocodeKind => kind !== undefined);
  if (kinds.length === 0) {
    return "other";
  }
  const order: GeocodeKind[] = [
    "station",
    "park",
    "public",
    "culture",
    "medical",
    "school",
    "welfare",
    "lodging",
    "shop",
    "food",
    "parking",
    "other",
  ];
  return kinds.sort((first, second) => order.indexOf(first) - order.indexOf(second))[0];
}

function nearestBlock(
  lat: number,
  lng: number,
  blocks: GeocodeBlock[],
): GeocodeBlock | null {
  let best: GeocodeBlock | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const lngScale = Math.cos((lat * Math.PI) / 180);
  for (const block of blocks) {
    const distance =
      (block.lat - lat) ** 2 + ((block.lng - lng) * lngScale) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = block;
    }
  }
  return best;
}

interface AccumulatedName {
  name: string;
  aliases: Set<string>;
  latSum: number;
  lngSum: number;
  count: number;
  kind: GeocodeKind;
  blockKey: string;
}

const KIND_RANK: Record<GeocodeKind, number> = {
  station: 0,
  park: 1,
  public: 2,
  culture: 3,
  medical: 4,
  school: 5,
  welfare: 6,
  lodging: 7,
  shop: 8,
  food: 9,
  parking: 10,
  other: 11,
};

/**
 * 名前と街区が同じ地点は1件にまとめる。3つの出典が同じ施設を別々に
 * 持っていることがあるため、座標ではなく名前と街区の組で同一視する。
 * 種別は優先度の高いものを残し、座標は平均する。
 */
export class NameAccumulator {
  private readonly entries = new Map<string, AccumulatedName>();

  constructor(private readonly blocks: GeocodeBlock[]) {}

  add(
    name: string,
    lat: number,
    lng: number,
    kind: GeocodeKind,
    aliases: string[] = [],
  ): void {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    const block = nearestBlock(lat, lng, this.blocks);
    const blockKey =
      block === null ? "?" : `${block.town}|${block.chome}|${block.block}`;
    const key = `${trimmed}|${blockKey}`;
    const existing = this.entries.get(key);
    if (existing === undefined) {
      this.entries.set(key, {
        name: trimmed,
        aliases: new Set(aliases),
        latSum: lat,
        lngSum: lng,
        count: 1,
        kind,
        blockKey,
      });
      return;
    }
    existing.latSum += lat;
    existing.lngSum += lng;
    existing.count += 1;
    for (const alias of aliases) {
      existing.aliases.add(alias);
    }
    if (KIND_RANK[kind] < KIND_RANK[existing.kind]) {
      existing.kind = kind;
    }
  }

  toNames(): GeocodeName[] {
    const names: GeocodeName[] = [];
    for (const entry of this.entries.values()) {
      entry.aliases.delete(entry.name);
      names.push({
        name: entry.name,
        aliases: [...entry.aliases].sort((first, second) =>
          first.localeCompare(second, "ja"),
        ),
        lat: Number((entry.latSum / entry.count).toFixed(7)),
        lng: Number((entry.lngSum / entry.count).toFixed(7)),
        kind: entry.kind,
      });
    }
    return names.sort(
      (first, second) =>
        normalizeSearchTerm(first.name).localeCompare(
          normalizeSearchTerm(second.name),
          "ja",
        ) ||
        first.lat - second.lat ||
        first.lng - second.lng,
    );
  }
}

export interface MergeInput {
  blocks: GeocodeBlock[];
  artifactNames: ArtifactNameInput[];
  stops: StopNameInput[];
  osm: OSMNamedFeature[];
}

export interface MergeResult {
  names: GeocodeName[];
  counts: {
    artifact: number;
    stops: number;
    osm: number;
    merged: number;
  };
}

export function mergeNames(input: MergeInput): MergeResult {
  const accumulator = new NameAccumulator(input.blocks);
  for (const entry of input.artifactNames) {
    accumulator.add(
      entry.name,
      entry.lat,
      entry.lng,
      kindFromCategoryIds(entry.categoryIds),
    );
  }
  for (const stop of input.stops) {
    accumulator.add(stop.name, stop.lat, stop.lng, "other");
  }
  for (const feature of input.osm) {
    accumulator.add(
      feature.name,
      feature.lat,
      feature.lng,
      feature.kind,
      feature.aliases,
    );
  }
  const names = accumulator.toNames();
  return {
    names,
    counts: {
      artifact: input.artifactNames.length,
      stops: input.stops.length,
      osm: input.osm.length,
      merged: names.length,
    },
  };
}
