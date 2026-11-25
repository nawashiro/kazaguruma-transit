import {
  arabicNumberToKanji,
  normalizeAddressQuery,
  normalizeSearchTerm,
  parseAddressQuery,
} from "./geocode-address";
import type {
  GeocodeBlock,
  GeocodeIndex,
  GeocodeKind,
  GeocodeName,
} from "./geocode-index";

const MAX_CANDIDATES = 5;
const STATION_SUFFIX = "駅";

/**
 * 種別の優先度。駅・公園・公共施設・文化施設・医療機関を上位に、
 * 物販・飲食・駐車場を下位に置く。同じ優先度の中では名前の一致種別で
 * 並べ、それでも決まらない場合は名前の短さと座標で決める。
 */
const KIND_PRIORITY: Record<GeocodeKind, number> = {
  station: 1,
  park: 1,
  public: 1,
  culture: 1,
  medical: 1,
  school: 2,
  welfare: 2,
  lodging: 2,
  shop: 3,
  food: 3,
  parking: 3,
  other: 3,
};

const MATCH_EXACT = 0;
const MATCH_PREFIX = 1;
const MATCH_PARTIAL = 2;

export interface GeocodeCandidate {
  name: string;
  /** `千代田区◯◯◯丁目N番` 形式の住所。解決できない場合は空文字。 */
  address: string;
  lat: number;
  lng: number;
  kind: GeocodeKind;
}

interface ScoredName {
  entry: GeocodeName;
  kindScore: number;
  matchScore: number;
}

function formatBlockAddress(block: GeocodeBlock): string {
  const chome = block.chome === 0 ? "" : `${arabicNumberToKanji(block.chome) ?? block.chome}丁目`;
  return `千代田区${block.town}${chome}${block.block}番`;
}

function distanceSquared(
  lat: number,
  lng: number,
  targetLat: number,
  targetLng: number,
): number {
  const lngScale = Math.cos((lat * Math.PI) / 180);
  return (targetLat - lat) ** 2 + ((targetLng - lng) * lngScale) ** 2;
}

function isInsideRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];
    const crossesLatitude = currentLat > lat !== previousLat > lat;
    if (!crossesLatitude) {
      continue;
    }
    const boundaryLng =
      ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) +
      currentLng;
    if (lng < boundaryLng) {
      inside = !inside;
    }
  }
  return inside;
}

function isInsideBoundary(lat: number, lng: number, index: GeocodeIndex): boolean {
  return index.boundary.some((feature) =>
    feature.polygons.some((polygon) => {
      const [outer, ...holes] = polygon;
      if (outer === undefined || !isInsideRing(lat, lng, outer)) {
        return false;
      }
      return holes.every((hole) => !isInsideRing(lat, lng, hole));
    }),
  );
}

function matchScore(term: string, candidate: string): number | null {
  if (candidate === term) {
    return MATCH_EXACT;
  }
  if (candidate.startsWith(term)) {
    return MATCH_PREFIX;
  }
  if (candidate.includes(term)) {
    return MATCH_PARTIAL;
  }
  return null;
}

function compareScored(first: ScoredName, second: ScoredName): number {
  return (
    first.kindScore - second.kindScore ||
    first.matchScore - second.matchScore ||
    first.entry.name.length - second.entry.name.length ||
    first.entry.name.localeCompare(second.entry.name, "ja") ||
    first.entry.lat - second.entry.lat ||
    first.entry.lng - second.entry.lng
  );
}

export class GeocodeSearcher {
  private readonly blocksByTown: Map<string, GeocodeBlock[]>;
  private readonly townsWithChome: Set<string>;
  private readonly names: Array<{ entry: GeocodeName; terms: string[] }>;

  constructor(private readonly index: GeocodeIndex) {
    this.blocksByTown = new Map();
    this.townsWithChome = new Set();
    for (const block of index.blocks) {
      const list = this.blocksByTown.get(block.town);
      if (list === undefined) {
        this.blocksByTown.set(block.town, [block]);
      } else {
        list.push(block);
      }
      if (block.chome !== 0) {
        this.townsWithChome.add(block.town);
      }
    }
    this.names = index.names.map((entry) => ({
      entry,
      terms: [entry.name, ...entry.aliases]
        .map(normalizeSearchTerm)
        .filter((term) => term.length > 0),
    }));
  }

  /**
   * 番地として解決できれば住所候補を1件だけ返す。数字を含まない語、または
   * 町名が索引に無い語では null を返し、呼び出し側が名前検索へ切り替える。
   */
  findAddress(query: string): GeocodeCandidate | null {
    if (this.index.blocks.length === 0) {
      return null;
    }
    const normalized = normalizeAddressQuery(query);
    if (!/[0-9]/u.test(normalized)) {
      return null;
    }
    const parts = parseAddressQuery(normalized);
    if (parts === null) {
      return null;
    }
    const blocks = this.blocksByTown.get(parts.town);
    if (blocks === undefined || blocks.length === 0) {
      return null;
    }
    if (!this.townsWithChome.has(parts.town)) {
      return this.candidateForBlocks(blocks, 0, parts.block);
    }
    if (parts.chome !== 0) {
      return this.candidateForBlocks(blocks, parts.chome, parts.block);
    }
    if (parts.block === null) {
      return this.candidateForBlocks(blocks, 0, null);
    }
    return this.candidateForBlocks(blocks, Number(parts.block), null);
  }

  private candidateForBlocks(
    blocks: GeocodeBlock[],
    chome: number,
    block: string | null,
  ): GeocodeCandidate {
    const sameChome = blocks.filter((entry) => entry.chome === chome);
    const pool = sameChome.length > 0 ? sameChome : blocks;
    if (block !== null) {
      const matched = pool.filter((entry) => entry.block === block);
      if (matched.length > 0) {
        return this.toAddressCandidate(this.pickRepresentative(matched));
      }
    }
    return this.toAddressCandidate(this.pickRepresentative(pool));
  }

  private pickRepresentative(blocks: GeocodeBlock[]): GeocodeBlock {
    return blocks.find((entry) => entry.representative) ?? blocks[0];
  }

  private toAddressCandidate(block: GeocodeBlock): GeocodeCandidate {
    return {
      name: formatBlockAddress(block),
      address: formatBlockAddress(block),
      lat: block.lat,
      lng: block.lng,
      kind: "other",
    };
  }

  search(query: string): GeocodeCandidate[] {
    const term = normalizeSearchTerm(query);
    if (term.length === 0) {
      return [];
    }
    const address = this.findAddress(query);
    if (address !== null) {
      return [address];
    }
    const queries = [term];
    if (term.endsWith(STATION_SUFFIX) && term.length > STATION_SUFFIX.length) {
      queries.push(term.slice(0, -STATION_SUFFIX.length));
    }
    return this.searchByTerms(queries);
  }

  private searchByTerms(queries: string[]): GeocodeCandidate[] {
    const scored: ScoredName[] = [];
    for (const { entry, terms } of this.names) {
      let best: number | null = null;
      for (const query of queries) {
        for (const candidate of terms) {
          const score = matchScore(query, candidate);
          if (score !== null && (best === null || score < best)) {
            best = score;
          }
        }
      }
      if (best !== null) {
        scored.push({
          entry,
          kindScore: KIND_PRIORITY[entry.kind],
          matchScore: best,
        });
      }
    }
    scored.sort(compareScored);
    return scored.slice(0, MAX_CANDIDATES).map(({ entry }) => ({
      name: entry.name,
      address: this.addressForPoint(entry.lat, entry.lng),
      lat: entry.lat,
      lng: entry.lng,
      kind: entry.kind,
    }));
  }

  addressForPoint(lat: number, lng: number): string {
    const block = this.nearestBlock(lat, lng);
    return block === null ? "" : formatBlockAddress(block);
  }

  reverse(lat: number, lng: number): string | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    if (!isInsideBoundary(lat, lng, this.index)) {
      return null;
    }
    const block = this.nearestBlock(lat, lng);
    return block === null ? null : formatBlockAddress(block);
  }

  private nearestBlock(lat: number, lng: number): GeocodeBlock | null {
    if (this.index.blocks.length === 0) {
      return null;
    }
    let best: GeocodeBlock | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const block of this.index.blocks) {
      const distance = distanceSquared(lat, lng, block.lat, block.lng);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = block;
      }
    }
    return best;
  }
}

export function townHasChome(index: GeocodeIndex, town: string): boolean {
  return index.blocks.some((block) => block.chome !== 0 && block.town === town);
}

export { MAX_CANDIDATES };
