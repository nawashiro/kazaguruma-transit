import {
  arabicNumberToKanji,
  normalizeAddressQuery,
  normalizeSearchTerm,
  parseAddressQuery,
  PREFECTURE_PREFIX,
} from "./geocode-address";
import type {
  GeocodeBlock,
  GeocodeIndex,
  GeocodeKind,
  GeocodeName,
} from "./geocode-index";

const MAX_CANDIDATES = 5;
const STATION_SUFFIX = "駅";
const METROPOLIS_PREFIX = "東京都";

/**
 * 種別の優先度。駅・公園・公共施設・文化施設・医療機関・住所を上位に、
 * 物販・飲食・駐車場を下位に置く。同じ優先度の中では一致の種別で並べ、
 * それでも決まらない場合は丁目・街区・名前の短さと座標で決める。
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

const ADDRESS_PRIORITY = 1;

/** これより短い語に区名を落とすと、無関係な名前へ部分一致する。 */
const MIN_STRIPPED_LENGTH = 2;

const MATCH_EXACT = 0;
const MATCH_PREFIX = 1;
const MATCH_PARTIAL = 2;

export type GeocodeCandidateKind = GeocodeKind | "address";

export interface GeocodeCandidate {
  name: string;
  /** `千代田区◯◯◯丁目N番` 形式の住所。解決できない場合は空文字。 */
  address: string;
  lat: number;
  lng: number;
  kind: GeocodeCandidateKind;
}

interface ScoredCandidate {
  name: string;
  lat: number;
  lng: number;
  kind: GeocodeCandidateKind;
  /** 住所候補の住所。名前索引の候補は null とし、採用が決まってから引く。 */
  address: string | null;
  kindScore: number;
  matchScore: number;
  /** 区名を落とした語で一致した候補は 1。元の語の一致を先に並べる。 */
  tier: number;
  chome: number;
  block: number;
}

interface AddressCandidate extends GeocodeCandidate {
  chome: number;
  block: number;
}

interface AddressKey {
  key: string;
  block: GeocodeBlock;
}

interface TownChome {
  chome: number;
  blocks: GeocodeBlock[];
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

function compareScored(first: ScoredCandidate, second: ScoredCandidate): number {
  return (
    first.kindScore - second.kindScore ||
    first.tier - second.tier ||
    first.matchScore - second.matchScore ||
    first.chome - second.chome ||
    first.block - second.block ||
    first.name.length - second.name.length ||
    first.name.localeCompare(second.name, "ja") ||
    first.lat - second.lat ||
    first.lng - second.lng
  );
}

function blockNumberOf(block: GeocodeBlock): number {
  return Number(block.block);
}

function compareStrings(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

/**
 * 検索語の先頭の都名・区名を落とす。索引の名前は区名を持たないため、
 * 区名付きの入力でも名前索引へ当たるようにする。
 */
function stripAdministrativePrefix(term: string): string {
  const withoutMetropolis = term.startsWith(METROPOLIS_PREFIX)
    ? term.slice(METROPOLIS_PREFIX.length)
    : term;
  return withoutMetropolis.startsWith(PREFECTURE_PREFIX)
    ? withoutMetropolis.slice(PREFECTURE_PREFIX.length)
    : withoutMetropolis;
}

function addressKeyOf(block: GeocodeBlock): string {
  return block.chome === 0
    ? `${block.town}-${block.block}`
    : `${block.town}-${block.chome}-${block.block}`;
}

export class GeocodeSearcher {
  private readonly townsWithChome: Set<string>;
  private readonly townChome: Map<string, TownChome[]>;
  private readonly addressKeys: AddressKey[];
  private readonly names: Array<{ entry: GeocodeName; terms: string[] }>;

  constructor(private readonly index: GeocodeIndex) {
    this.townsWithChome = new Set();
    this.townChome = new Map();
    this.addressKeys = [];
    for (const block of index.blocks) {
      this.addressKeys.push({ key: addressKeyOf(block), block });
      this.collectBlock(block);
    }
    this.addressKeys.sort((first, second) => compareStrings(first.key, second.key));
    for (const groups of this.townChome.values()) {
      groups.sort((first, second) => first.chome - second.chome);
      for (const group of groups) {
        group.blocks.sort((first, second) => blockNumberOf(first) - blockNumberOf(second));
      }
    }
    this.names = index.names.map((entry) => ({
      entry,
      terms: [entry.name, ...entry.aliases]
        .map(normalizeSearchTerm)
        .filter((term) => term.length > 0),
    }));
  }

  private collectBlock(block: GeocodeBlock): void {
    let groups = this.townChome.get(block.town);
    if (groups === undefined) {
      groups = [];
      this.townChome.set(block.town, groups);
    }
    let group = groups.find((entry) => entry.chome === block.chome);
    if (group === undefined) {
      group = { chome: block.chome, blocks: [] };
      groups.push(group);
    }
    group.blocks.push(block);
    if (block.chome !== 0) {
      this.townsWithChome.add(block.town);
    }
  }

  /**
   * 番地として解決できれば住所候補を1件だけ返す。数字を含まない語、または
   * 町名が一意に決まらない語では null を返し、呼び出し側が名前検索へ切り替える。
   */
  findAddress(query: string): GeocodeCandidate | null {
    const parts = this.parseQuery(query);
    if (parts === null || parts.numbers.length === 0) {
      return null;
    }
    const [first] = this.addressCandidates(parts, this.matchingTowns(parts.town));
    return first === undefined ? null : first;
  }

  private parseQuery(query: string): { town: string; numbers: string[] } | null {
    if (this.index.blocks.length === 0) {
      return null;
    }
    const normalized = normalizeAddressQuery(query);
    if (normalized.length === 0) {
      return null;
    }
    return parseAddressQuery(normalized);
  }

  /**
   * 段階的な住所候補。入力が町名の途中なら町名を一意に決め、町名なら
   * 丁目、丁目なら街区と、入力が示す段階の一つ下を返す。町名が複数に
   * 割れる語では候補を返さない。
   */
  private addressCandidates(
    parts: { town: string; numbers: string[] },
    towns: string[],
  ): AddressCandidate[] {
    if (towns.length !== 1) {
      return [];
    }
    const town = towns[0];
    const groups = this.townChome.get(town);
    if (groups === undefined || groups.length === 0) {
      return [];
    }
    if (!this.townsWithChome.has(town)) {
      return this.blockCandidates(groups[0].blocks, parts.numbers);
    }
    const { chome, block } = this.readDigits(parts.numbers);
    if (chome === null) {
      return groups
        .slice(0, MAX_CANDIDATES)
        .map((group) => this.toAddressCandidate(this.pickRepresentative(group.blocks), group.chome));
    }
    const group = groups.find((entry) => entry.chome === chome);
    if (group === undefined) {
      const fallback = this.pickRepresentative(this.flatten(groups));
      return [this.toAddressCandidate(fallback, fallback.chome)];
    }
    return this.blockCandidates(group.blocks, block === null ? [] : [block]);
  }

  private blockCandidates(blocks: GeocodeBlock[], wanted: string[]): AddressCandidate[] {
    if (wanted.length > 0) {
      const matched = blocks.filter((block) => block.block === wanted[0]);
      if (matched.length > 0) {
        return matched
          .slice(0, MAX_CANDIDATES)
          .map((block) => this.toAddressCandidate(block, block.chome));
      }
      return [this.toAddressCandidate(this.pickRepresentative(blocks), blocks[0].chome)];
    }
    return blocks
      .slice(0, MAX_CANDIDATES)
      .map((block) => this.toAddressCandidate(block, block.chome));
  }

  /**
   * 丁目を持つ町で、数字の並びを丁目と街区に読む。街区より後ろの数字は
   * 住所の解決に使わない。丁目を持たない町は blockCandidates が読む。
   */
  private readDigits(numbers: string[]): { chome: number | null; block: string | null } {
    return {
      chome: numbers.length === 0 ? null : Number(numbers[0]),
      block: numbers[1] ?? null,
    };
  }

  private flatten(groups: TownChome[]): GeocodeBlock[] {
    return groups.flatMap((group) => group.blocks);
  }

  private pickRepresentative(blocks: GeocodeBlock[]): GeocodeBlock {
    let lat = 0;
    let lng = 0;
    for (const block of blocks) {
      lat += block.lat;
      lng += block.lng;
    }
    lat /= blocks.length;
    lng /= blocks.length;
    let best = blocks[0];
    let bestDistance = distanceSquared(lat, lng, best.lat, best.lng);
    for (const block of blocks) {
      const distance = distanceSquared(lat, lng, block.lat, block.lng);
      if (distance < bestDistance) {
        best = block;
        bestDistance = distance;
      }
    }
    return best;
  }

  private toAddressCandidate(block: GeocodeBlock, chome: number): AddressCandidate {
    const name = formatBlockAddress(block);
    return {
      name,
      address: name,
      lat: block.lat,
      lng: block.lng,
      kind: "address",
      chome,
      block: blockNumberOf(block),
    };
  }

  /**
   * 町名の接頭辞に一致する町を、街区キーの整列索引から二分探索で取り出す。
   * 町名は `-` を含まないため、キーの最初の区切りまでが町名になる。
   */
  private matchingTowns(prefix: string): string[] {
    if (prefix.length === 0) {
      return [];
    }
    const towns: string[] = [];
    for (const entry of this.keysWithPrefix(prefix)) {
      const separator = entry.key.indexOf("-");
      const town = separator === -1 ? entry.key : entry.key.slice(0, separator);
      if (towns[towns.length - 1] !== town && !towns.includes(town)) {
        towns.push(town);
      }
    }
    return towns;
  }

  private keysWithPrefix(prefix: string): AddressKey[] {
    let low = 0;
    let high = this.addressKeys.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (compareStrings(this.addressKeys[middle].key, prefix) < 0) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    const matched: AddressKey[] = [];
    for (let index = low; index < this.addressKeys.length; index += 1) {
      if (!this.addressKeys[index].key.startsWith(prefix)) {
        break;
      }
      matched.push(this.addressKeys[index]);
    }
    return matched;
  }

  search(query: string): GeocodeCandidate[] {
    const term = normalizeSearchTerm(query);
    if (term.length === 0) {
      return [];
    }
    const parts = this.parseQuery(query);
    const towns = parts === null ? [] : this.matchingTowns(parts.town);
    const addresses = parts === null ? [] : this.addressCandidates(parts, towns);
    const addressMatch =
      towns.length === 1 && parts !== null && towns[0] === parts.town ? MATCH_EXACT : MATCH_PREFIX;
    const scored = [
      ...addresses.map(({ chome, block, ...candidate }) => ({
        ...candidate,
        kindScore: ADDRESS_PRIORITY,
        matchScore: addressMatch,
        tier: 0,
        chome,
        block,
      })),
      ...this.searchByTerms(this.nameQueries(term)),
    ];
    scored.sort(compareScored);
    const seen = new Set<string>();
    const merged: GeocodeCandidate[] = [];
    for (const entry of scored) {
      if (seen.has(entry.name)) {
        continue;
      }
      seen.add(entry.name);
      merged.push({
        name: entry.name,
        address: entry.address ?? this.addressForPoint(entry.lat, entry.lng),
        lat: entry.lat,
        lng: entry.lng,
        kind: entry.kind,
      });
      if (merged.length >= MAX_CANDIDATES) {
        break;
      }
    }
    return merged;
  }

  private nameQueries(term: string): { terms: string[]; tier: number }[] {
    const tiers: { terms: string[]; tier: number }[] = [];
    const stripped = stripAdministrativePrefix(term);
    const primary = this.queriesFor(term);
    tiers.push({ terms: primary, tier: 0 });
    if (stripped.length >= MIN_STRIPPED_LENGTH && stripped !== term) {
      tiers.push({ terms: this.queriesFor(stripped), tier: 1 });
    }
    return tiers;
  }

  private queriesFor(term: string): string[] {
    if (term.endsWith(STATION_SUFFIX) && term.length > STATION_SUFFIX.length) {
      return [term, term.slice(0, -STATION_SUFFIX.length)];
    }
    return [term];
  }

  private searchByTerms(tiers: { terms: string[]; tier: number }[]): ScoredCandidate[] {
    const scored: ScoredCandidate[] = [];
    for (const { entry, terms } of this.names) {
      let best: number | null = null;
      let bestTier = 0;
      for (const { terms: queries, tier } of tiers) {
        let tierBest: number | null = null;
        for (const query of queries) {
          for (const candidate of terms) {
            const score = matchScore(query, candidate);
            if (score !== null && (tierBest === null || score < tierBest)) {
              tierBest = score;
            }
          }
        }
        if (tierBest !== null) {
          best = tierBest;
          bestTier = tier;
          break;
        }
      }
      if (best === null) {
        continue;
      }
      scored.push({
        name: entry.name,
        lat: entry.lat,
        lng: entry.lng,
        kind: entry.kind,
        address: null,
        kindScore: KIND_PRIORITY[entry.kind],
        matchScore: best,
        tier: bestTier,
        chome: 0,
        block: 0,
      });
    }
    return scored;
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
