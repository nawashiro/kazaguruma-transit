import type { GeocodeKind } from "../../src/lib/location/geocode-index";
import { isGeocodeKind } from "../../src/lib/location/geocode-index";

export interface OSMNamedFeature {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  kind: GeocodeKind;
}

export interface OSMItem {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  refs?: number[];
  members?: Array<{ type: string; id: number; role?: string }>;
}

const NON_LINEAR_HIGHWAY_VALUES = new Set([
  "bus_stop",
  "crossing",
  "traffic_signals",
  "street_lamp",
  "elevator",
  "steps",
]);

const AMENITY_KINDS: Record<string, GeocodeKind> = {
  townhall: "public",
  public_building: "public",
  community_centre: "public",
  library: "culture",
  courthouse: "public",
  police: "public",
  post_office: "public",
  fire_station: "public",
  arts_centre: "culture",
  museum: "culture",
  hospital: "medical",
  clinic: "medical",
  doctors: "medical",
  dentist: "medical",
  pharmacy: "medical",
  school: "school",
  kindergarten: "welfare",
  childcare: "welfare",
  nursing_home: "welfare",
  social_facility: "welfare",
  marketplace: "shop",
  restaurant: "food",
  cafe: "food",
  fast_food: "food",
  bar: "food",
  pub: "food",
  food_court: "food",
  ice_cream: "food",
  parking: "parking",
  parking_entrance: "parking",
  bicycle_parking: "parking",
};

const TOURISM_KINDS: Record<string, GeocodeKind> = {
  museum: "culture",
  gallery: "culture",
  attraction: "culture",
  artwork: "culture",
  hotel: "lodging",
  hostel: "lodging",
  guest_house: "lodging",
};

const LEISURE_KINDS: Record<string, GeocodeKind> = {
  park: "park",
  garden: "park",
  nature_reserve: "park",
};

const ALIAS_TAGS = [
  "official_name",
  "official_name:ja",
  "alt_name",
  "short_name",
  "name:ja",
] as const;

/**
 * 道路・鉄道線・水路・境界は線形要素で、地点検索の候補にはならない。
 * 駅は線形ではなく地点なので残す。
 */
export function isLinearFeature(tags: Record<string, string>): boolean {
  if (tags.railway === "station" || tags.railway === "halt") {
    return false;
  }
  if (tags.public_transport === "station") {
    return false;
  }
  if (tags.highway !== undefined) {
    return !NON_LINEAR_HIGHWAY_VALUES.has(tags.highway);
  }
  if (tags.route !== undefined || tags.waterway !== undefined) {
    return true;
  }
  if (tags.boundary !== undefined || tags.railway !== undefined) {
    return true;
  }
  return tags.natural === "water" || tags.natural === "coastline";
}

export function classifyKind(tags: Record<string, string>): GeocodeKind {
  if (tags.railway === "station" || tags.railway === "halt") {
    return "station";
  }
  if (tags.public_transport === "station") {
    return "station";
  }
  if (tags.leisure !== undefined && LEISURE_KINDS[tags.leisure] !== undefined) {
    return LEISURE_KINDS[tags.leisure];
  }
  if (tags.amenity !== undefined && AMENITY_KINDS[tags.amenity] !== undefined) {
    return AMENITY_KINDS[tags.amenity];
  }
  if (tags.tourism !== undefined && TOURISM_KINDS[tags.tourism] !== undefined) {
    return TOURISM_KINDS[tags.tourism];
  }
  if (tags.historic !== undefined && tags.historic !== "no") {
    return "culture";
  }
  if (tags.healthcare !== undefined) {
    return "medical";
  }
  if (tags.shop !== undefined) {
    return "shop";
  }
  if (tags.social_facility !== undefined) {
    return "welfare";
  }
  return "other";
}

export function readAliases(tags: Record<string, string>): string[] {
  const aliases = new Set<string>();
  for (const key of ALIAS_TAGS) {
    const value = tags[key];
    if (typeof value !== "string") {
      continue;
    }
    for (const part of value.split(";")) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        aliases.add(trimmed);
      }
    }
  }
  aliases.delete(tags.name?.trim() ?? "");
  return [...aliases];
}

export interface TownBoundary {
  name: string;
  polygons: number[][][][];
}

export function isInsideRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];
    if (currentLat > lat === previousLat > lat) {
      continue;
    }
    const boundaryLng =
      ((previousLng - currentLng) * (lat - currentLat)) /
        (previousLat - currentLat) +
      currentLng;
    if (lng < boundaryLng) {
      inside = !inside;
    }
  }
  return inside;
}

export function isInsideBoundary(
  lat: number,
  lng: number,
  boundary: TownBoundary[],
): boolean {
  return boundary.some((feature) =>
    feature.polygons.some((polygon) => {
      const [outer, ...holes] = polygon;
      if (outer === undefined || !isInsideRing(lat, lng, outer)) {
        return false;
      }
      return holes.every((hole) => !isInsideRing(lat, lng, hole));
    }),
  );
}

export function townNameForPoint(
  lat: number,
  lng: number,
  boundary: TownBoundary[],
): string | null {
  for (const feature of boundary) {
    for (const polygon of feature.polygons) {
      const [outer, ...holes] = polygon;
      if (outer === undefined || !isInsideRing(lat, lng, outer)) {
        continue;
      }
      if (holes.some((hole) => isInsideRing(lat, lng, hole))) {
        continue;
      }
      return feature.name;
    }
  }
  return null;
}

interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function boundsOfBoundary(boundary: TownBoundary[]): Bounds | null {
  let minLat = Number.POSITIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  for (const feature of boundary) {
    for (const polygon of feature.polygons) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          minLat = Math.min(minLat, lat);
          minLng = Math.min(minLng, lng);
          maxLat = Math.max(maxLat, lat);
          maxLng = Math.max(maxLng, lng);
        }
      }
    }
  }
  return Number.isFinite(minLat) ? { minLat, minLng, maxLat, maxLng } : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTagRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function toItems(chunk: unknown): OSMItem[] {
  if (!Array.isArray(chunk)) {
    return [];
  }
  return chunk.filter((item): item is OSMItem => {
    if (!isRecord(item) || typeof item.type !== "string") {
      return false;
    }
    return typeof item.id === "number" && Number.isFinite(item.id);
  });
}

export interface ExtractStats {
  nodesInBoundary: number;
  namedNodes: number;
  wayCenters: number;
  namedRelations: number;
  skippedLinear: number;
  skippedOutside: number;
  skippedNoPosition: number;
}

export interface ExtractResult {
  features: OSMNamedFeature[];
  stats: ExtractStats;
}

/**
 * PBFの全要素を走査し、町字ポリゴンの内側にある名前付き要素を集める。
 * way と relation は構成ノードの重心で代表させ、線形要素は除外する。
 * ノードは id 順、way は id 順、relation は id 順に処理するため、
 * 同じ入力からは同じ並びの結果が得られる。
 */
export async function extractOsmFeatures(
  stream: AsyncIterable<unknown>,
  boundary: TownBoundary[],
): Promise<ExtractResult> {
  const bounds = boundsOfBoundary(boundary);
  if (bounds === null) {
    throw new Error("町字ポリゴンから範囲を求められません");
  }

  const nodes = new Map<number, { lat: number; lng: number }>();
  const nodeTags = new Map<number, Record<string, string>>();
  const ways = new Map<
    number,
    { refs: number[]; tags: Record<string, string> }
  >();
  const relations: Array<{
    id: number;
    members: Array<{ type: string; id: number }>;
    tags: Record<string, string>;
  }> = [];

  let nodesInBoundary = 0;

  for await (const chunk of stream) {
    for (const item of toItems(chunk)) {
      const tags = isTagRecord(item.tags) ? item.tags : {};
      if (item.type === "node") {
        if (
          typeof item.lat !== "number" ||
          typeof item.lon !== "number" ||
          !Number.isFinite(item.lat) ||
          !Number.isFinite(item.lon)
        ) {
          continue;
        }
        if (
          item.lat < bounds.minLat ||
          item.lat > bounds.maxLat ||
          item.lon < bounds.minLng ||
          item.lon > bounds.maxLng
        ) {
          continue;
        }
        nodesInBoundary += 1;
        nodes.set(item.id, { lat: item.lat, lng: item.lon });
        if (Object.keys(tags).length > 0) {
          nodeTags.set(item.id, tags);
        }
        continue;
      }
      if (item.type === "way") {
        if (!Array.isArray(item.refs) || item.refs.length === 0) {
          continue;
        }
        if (Object.keys(tags).length === 0) {
          continue;
        }
        ways.set(item.id, { refs: item.refs, tags });
        continue;
      }
      if (item.type === "relation") {
        if (!Array.isArray(item.members) || Object.keys(tags).length === 0) {
          continue;
        }
        relations.push({
          id: item.id,
          members: item.members.filter(
            (member): member is { type: string; id: number } =>
              isRecord(member) &&
              typeof member.type === "string" &&
              typeof member.id === "number",
          ),
          tags,
        });
      }
    }
  }

  const features: OSMNamedFeature[] = [];
  const stats: ExtractStats = {
    nodesInBoundary,
    namedNodes: 0,
    wayCenters: 0,
    namedRelations: 0,
    skippedLinear: 0,
    skippedOutside: 0,
    skippedNoPosition: 0,
  };

  const accept = (
    tags: Record<string, string>,
    position: { lat: number; lng: number },
  ) => {
    const name = tags.name?.trim() ?? "";
    if (name.length === 0) {
      return false;
    }
    if (isLinearFeature(tags)) {
      stats.skippedLinear += 1;
      return false;
    }
    if (!isInsideBoundary(position.lat, position.lng, boundary)) {
      stats.skippedOutside += 1;
      return false;
    }
    features.push({
      name,
      aliases: readAliases(tags),
      lat: position.lat,
      lng: position.lng,
      kind: classifyKind(tags),
    });
    return true;
  };

  const centerOfRefs = (refs: number[]) => {
    let lat = 0;
    let lng = 0;
    let count = 0;
    for (const ref of refs) {
      const node = nodes.get(ref);
      if (node === undefined) {
        continue;
      }
      lat += node.lat;
      lng += node.lng;
      count += 1;
    }
    return count === 0 ? null : { lat: lat / count, lng: lng / count };
  };

  for (const id of [...nodeTags.keys()].sort((first, second) => first - second)) {
    const tags = nodeTags.get(id);
    const position = nodes.get(id);
    if (tags === undefined || position === undefined) {
      continue;
    }
    if (accept(tags, position)) {
      stats.namedNodes += 1;
    }
  }

  for (const id of [...ways.keys()].sort((first, second) => first - second)) {
    const way = ways.get(id);
    if (way === undefined) {
      continue;
    }
    const center = centerOfRefs(way.refs);
    if (center === null) {
      stats.skippedNoPosition += 1;
      continue;
    }
    stats.wayCenters += 1;
    accept(way.tags, center);
  }

  for (const relation of [...relations].sort(
    (first, second) => first.id - second.id,
  )) {
    const refs: number[] = [];
    for (const member of relation.members) {
      if (member.type === "node") {
        refs.push(member.id);
        continue;
      }
      if (member.type === "way") {
        const way = ways.get(member.id);
        if (way !== undefined) {
          refs.push(...way.refs);
        }
      }
    }
    const center = centerOfRefs(refs);
    if (center === null) {
      stats.skippedNoPosition += 1;
      continue;
    }
    stats.namedRelations += 1;
    accept(relation.tags, center);
  }

  return { features, stats };
}

export function isKnownKind(value: unknown): value is GeocodeKind {
  return isGeocodeKind(value);
}
