import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
  findOsmElementKey,
  validateDestinationCatalog,
  type DestinationCatalog,
} from "../src/lib/location/destination-catalog";

const LOCATION_PREFIX = "東京都千代田区";
const INVALID_URI_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f]/;

export interface LocationArtifactSourceUris {
  placesJsonLdUri: string;
  osmMirrorUri: string;
  townGeoJsonUri: string;
  categoryNamesUri: string;
  wikidataMirrorUri: string;
}

export interface LocationArtifactTransportResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type LocationArtifactTransport = (
  uri: string,
) => Promise<LocationArtifactTransportResponse>;

export type LocationArtifactWriter = (
  artifact: LocationArtifact,
) => Promise<void> | void;

export interface GenerateLocationArtifactOptions {
  appConfig: unknown;
  destinationCatalog: unknown;
  transport: LocationArtifactTransport;
  writeArtifact: LocationArtifactWriter;
}

type JsonRecord = Record<string, unknown>;

export interface RouteDestinationLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteDestinationCategory {
  category: string;
  categoryId: string;
  locations: RouteDestinationLocation[];
}

interface CategoryName {
  code: string;
  name: string;
}

const CATEGORY_CODE_PATTERN = /^[0-9]{4}$/u;

function parseCategoryNames(value: unknown): CategoryName[] {
  if (!isRecord(value) || value["@type"] !== "schema:DefinedTermSet") {
    fail("カテゴリ名辞書は schema:DefinedTermSet である必要があります");
  }

  const terms = value["schema:hasDefinedTerm"];
  if (!Array.isArray(terms) || terms.length === 0) {
    fail("カテゴリ名辞書の schema:hasDefinedTerm は空でない配列である必要があります");
  }

  const categories: CategoryName[] = [];
  const codes = new Set<string>();
  terms.forEach((term, index) => {
    const termPath = `カテゴリ名辞書の schema:hasDefinedTerm[${index}]`;
    if (!isRecord(term)) {
      fail(`${termPath} はオブジェクトである必要があります`);
    }

    const id = term["@id"];
    if (typeof id !== "string") {
      fail(`${termPath}.@id は文字列である必要があります`);
    }
    const fragmentIndex = id.lastIndexOf("#");
    const code =
      fragmentIndex === -1 ? "" : id.slice(fragmentIndex + 1);
    if (!CATEGORY_CODE_PATTERN.test(code)) {
      fail(`${termPath}.@id のfragmentは4桁コードである必要があります`);
    }
    if (codes.has(code)) {
      fail(`カテゴリ名辞書に重複したコードがあります: ${code}`);
    }
    codes.add(code);

    const name = term["schema:name"];
    if (!isNonEmptyString(name)) {
      fail(`${termPath}.schema:name は空でない文字列である必要があります`);
    }

    categories.push({ code, name });
  });

  return categories;
}

function parsePlacesJsonLd(value: unknown): Map<string, JsonRecord> {
  if (!isRecord(value) || !Array.isArray(value["@graph"])) {
    fail("places JSON-LD must contain an @graph array");
  }

  const records = new Map<string, JsonRecord>();
  for (const record of value["@graph"]) {
    if (!isRecord(record)) {
      continue;
    }
    const id = record["@id"];
    if (typeof id === "string" && id.startsWith("urn:uuid:")) {
      records.set(id, record);
    }
  }
  return records;
}

function parseOsmNames(value: unknown): Map<string, string | null> {
  if (!isRecord(value) || !Array.isArray(value.elements)) {
    fail("OSM tag mirror must contain an elements array");
  }

  const names = new Map<string, string | null>();
  for (const element of value.elements) {
    if (!isRecord(element)) {
      continue;
    }
    const type = element.type;
    const id = element.id;
    if (
      typeof type !== "string" ||
      (typeof id !== "number" && typeof id !== "string")
    ) {
      continue;
    }
    const tags = element.tags;
    const name = isRecord(tags) ? tags.name : undefined;
    names.set(`${type}/${id}`, isNonEmptyString(name) ? name.trim() : null);
  }
  return names;
}

type OsmElementDetail = {
  name: string | null;
  wheelchair: string | null;
  phone: unknown;
  contactPhone: unknown;
  website: unknown;
  contactWebsite: unknown;
  wikipedia: unknown;
  wikidata: unknown;
  openingHours: unknown;
};

function parseOsmDetails(value: unknown): Map<string, OsmElementDetail> {
  if (!isRecord(value) || !Array.isArray(value.elements)) {
    fail("OSM tag mirror must contain an elements array");
  }
  const details = new Map<string, OsmElementDetail>();
  for (const element of value.elements) {
    if (!isRecord(element)) {
      continue;
    }
    const type = element.type;
    const id = element.id;
    if (
      typeof type !== "string" ||
      (typeof id !== "number" && typeof id !== "string")
    ) {
      continue;
    }
    const tags = isRecord(element.tags) ? element.tags : {};
    const name = tags["name"];
    const wheelchair = tags["wheelchair"];
    details.set(`${type}/${id}`, {
      name: isNonEmptyString(name) ? (name as string).trim() : null,
      wheelchair: typeof wheelchair === "string" ? wheelchair : null,
      phone: tags["phone"],
      contactPhone: tags["contact:phone"],
      website: tags["website"],
      contactWebsite: tags["contact:website"],
      wikipedia: tags["wikipedia"],
      wikidata: tags["wikidata"],
      openingHours: tags["opening_hours"],
    });
  }
  return details;
}

function parsePlacesList(value: unknown): Array<{ id: string; record: JsonRecord }> {
  if (!isRecord(value) || !Array.isArray(value["@graph"])) {
    fail("places JSON-LD must contain an @graph array");
  }
  const seen = new Set<string>();
  const list: Array<{ id: string; record: JsonRecord }> = [];
  for (const record of value["@graph"]) {
    if (!isRecord(record)) {
      continue;
    }
    const id = record["@id"];
    if (typeof id !== "string" || !id.startsWith("urn:uuid:")) {
      continue;
    }
    if (seen.has(id)) {
      fail(`公開JSON-LDに重複したIDがあります: ${id}`);
    }
    seen.add(id);
    list.push({ id, record });
  }
  return list;
}

function parseOsmElementRef(key: string): { type: "node" | "way" | "relation"; id: number } | null {
  const slash = key.indexOf("/");
  if (slash === -1) {
    return null;
  }
  const type = key.slice(0, slash);
  const id = Number(key.slice(slash + 1));
  if ((type !== "node" && type !== "way" && type !== "relation") || !Number.isInteger(id)) {
    return null;
  }
  return { type, id };
}

function mapWheelchair(raw: string | null): "yes" | "limited" | "no" | null {
  if (raw === "yes" || raw === "limited" || raw === "no") {
    return raw;
  }
  return null;
}

function parseLocationImage(record: JsonRecord): { imageUri: string; imageCreator: string; imageLicense: string } | null {
  const rawImage = record["schema:image"];
  if (rawImage === undefined || rawImage === null) {
    return null;
  }
  const candidate = Array.isArray(rawImage) ? rawImage[0] : rawImage;
  if (!isRecord(candidate)) {
    return null;
  }
  const contentUrl = candidate["schema:contentUrl"];
  const license = candidate["schema:license"];
  const creator = candidate["schema:creator"];
  const creatorName = isRecord(creator) ? creator["schema:name"] : undefined;
  if (!isAbsoluteHttpUri(contentUrl) || !isAbsoluteHttpUri(license) || !isNonEmptyString(creatorName)) {
    return null;
  }
  return {
    imageUri: contentUrl as string,
    imageCreator: (creatorName as string).trim(),
    imageLicense: license as string,
  };
}

function parseRelatedPages(record: JsonRecord): Array<{ name: string; url: string }> {
  const raw = record["schema:subjectOf"];
  const items = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const pages: Array<{ name: string; url: string }> = [];
  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const name = item["schema:name"];
    const url = item["schema:url"];
    if (isNonEmptyString(name) && isAbsoluteHttpUri(url)) {
      pages.push({ name: (name as string).trim(), url: url as string });
    }
  }
  return pages;
}

function normalizePhone(raw: unknown): { display: string; tel: string } | null {
  if (typeof raw !== "string") {
    return null;
  }
  const digits = raw.replace(/[^0-9]/g, "");
  let normalized = digits;
  if (normalized.startsWith("81")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("3") && normalized.length === 9) {
    normalized = `0${normalized}`;
  }
  if (!normalized.startsWith("03")) {
    return null;
  }
  if (normalized.length === 10) {
    return {
      display: `${normalized.slice(0, 2)}-${normalized.slice(2, 6)}-${normalized.slice(6)}`,
      tel: `tel:${normalized}`,
    };
  }
  if (normalized.length === 9) {
    return {
      display: `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`,
      tel: `tel:${normalized}`,
    };
  }
  return null;
}

function resolveWebsite(detail: OsmElementDetail): string | undefined {
  const candidates = [detail.website, detail.contactWebsite];
  for (const candidate of candidates) {
    if (isAbsoluteHttpUri(candidate)) {
      return candidate as string;
    }
  }
  return undefined;
}

function parseWikipediaTag(raw: unknown): { lang: string; title: string } | null {
  if (typeof raw !== "string") {
    return null;
  }
  const colon = raw.indexOf(":");
  if (colon <= 0 || colon === raw.length - 1) {
    return null;
  }
  const lang = raw.slice(0, colon).trim();
  const title = raw.slice(colon + 1).trim();
  if (!/^[a-z-]{2,}$/i.test(lang) || title.length === 0) {
    return null;
  }
  return { lang: lang.toLowerCase(), title };
}

function toWikipediaUrl(lang: string, title: string): string {
  const underscored = title.replace(/ /g, "_");
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(underscored)}`;
}

type WikidataSitelinks = Map<string, Map<string, string>>;

function parseWikidataMirror(value: unknown): WikidataSitelinks {
  if (!isRecord(value) || !isRecord(value["entities"])) {
    fail("Wikidata mirror must contain an entities object");
  }
  const entities = value["entities"] as Record<string, unknown>;
  const result = new Map<string, Map<string, string>>();
  for (const [qid, rawEntity] of Object.entries(entities)) {
    if (!isRecord(rawEntity)) {
      fail(`Wikidata entity ${qid} must be an object`);
    }
    if (typeof rawEntity["id"] !== "string") {
      fail(`Wikidata entity ${qid} must have a string id`);
    }
    const sitelinks = rawEntity["sitelinks"];
    if (sitelinks === undefined) {
      result.set(qid, new Map());
      continue;
    }
    if (!isRecord(sitelinks)) {
      fail(`Wikidata entity ${qid} sitelinks must be an object`);
    }
    const titles = new Map<string, string>();
    for (const [key, rawLink] of Object.entries(sitelinks)) {
      if (!isRecord(rawLink)) {
        fail(`Wikidata entity ${qid} sitelink ${key} must be an object`);
      }
      const title = rawLink["title"];
      if (typeof title !== "string" || title.trim().length === 0) {
        fail(`Wikidata entity ${qid} sitelink ${key} must have a title`);
      }
      // key is like "jawiki", "enwiki" - derive lang by stripping "wiki"
      const lang = key.endsWith("wiki") ? key.slice(0, -4) : key;
      titles.set(lang, title as string);
    }
    result.set(qid, titles);
  }
  return result;
}

function resolveWikipediaUri(
  detail: OsmElementDetail,
  wikidata: WikidataSitelinks,
): string | undefined {
  const osmParsed = parseWikipediaTag(detail.wikipedia);
  const qid = typeof detail.wikidata === "string" ? (detail.wikidata as string).trim() : null;
  const wikiTitles = qid !== null ? wikidata.get(qid) : undefined;
  // 1. OSM ja
  if (osmParsed !== null && osmParsed.lang === "ja") {
    return toWikipediaUrl("ja", osmParsed.title);
  }
  // 2. Wikidata jawiki
  const jaTitle = wikiTitles?.get("ja");
  if (typeof jaTitle === "string" && jaTitle.trim().length > 0) {
    return toWikipediaUrl("ja", jaTitle.trim());
  }
  // 3. OSM other lang
  if (osmParsed !== null) {
    return toWikipediaUrl(osmParsed.lang, osmParsed.title);
  }
  // 4. Wikidata enwiki
  const enTitle = wikiTitles?.get("en");
  if (typeof enTitle === "string" && enTitle.trim().length > 0) {
    return toWikipediaUrl("en", enTitle.trim());
  }
  return undefined;
}

function buildOsmEditUrl(osmElement: { type: "node" | "way" | "relation"; id: number }): string {
  return `https://www.openstreetmap.org/edit?${osmElement.type}=${osmElement.id}`;
}

function readRouteDestinationCoordinates(
  record: JsonRecord,
  id: string,
): { lat: number; lng: number } {
  const geo = record["schema:geo"];
  if (!isRecord(geo)) {
    fail(`掲載recordの座標が不正です: ${id}`);
  }
  const lat = geo["schema:latitude"];
  const lng = geo["schema:longitude"];
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    fail(`掲載recordの座標が不正です: ${id}`);
  }
  return { lat, lng };
}

function readGifPoiCode(record: JsonRecord, id: string): string {
  const identifiers = record["schema:identifier"];
  const codes = Array.isArray(identifiers)
    ? identifiers
        .filter(isRecord)
        .filter((identifier) => identifier["schema:propertyID"] === "gif-poi")
        .map((identifier) => identifier["schema:value"])
        .filter((value): value is string => isNonEmptyString(value))
    : [];

  if (codes.length !== 1) {
    fail(
      `掲載recordのgif-poi分類コードは1件である必要があります: ${id} (${codes.length}件)`,
    );
  }
  return codes[0];
}

export interface LocationEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  imageUri?: string;
  imageCreator?: string;
  imageLicense?: string;
  relatedPages: Array<{ name: string; url: string }>;
  osmElement: { type: "node" | "way" | "relation"; id: number };
  wheelchair: "yes" | "limited" | "no" | null;
  phone?: { display: string; tel: string };
  websiteUri?: string;
  wikipediaUri?: string;
  osmEditUrl: string;
  openingHours?: string;
}

export interface LocationCategory {
  category: string;
  categoryId: string;
  locations: LocationEntry[];
}

function buildLocations(
  categoryNames: CategoryName[],
  placesPayload: unknown,
  osmPayload: unknown,
  wikidataPayload: unknown,
): LocationCategory[] {
  const entries = parsePlacesList(placesPayload);
  const osmDetails = parseOsmDetails(osmPayload);
  const wikidata = parseWikidataMirror(wikidataPayload);
  const knownCodes = new Set(categoryNames.map((category) => category.code));
  const locationsByCode = new Map<string, LocationEntry[]>();

  for (const { id, record } of entries) {
    const coordinates = readRouteDestinationCoordinates(record, id);
    const code = readGifPoiCode(record, id);
    if (!knownCodes.has(code)) {
      fail(`gif-poiコードがカテゴリ名辞書にありません: ${code} (${id})`);
    }

    const osmElementKey = findOsmElementKey(record["rdfs:seeAlso"]);
    if (osmElementKey === null) {
      continue;
    }
    const detail = osmDetails.get(osmElementKey);
    if (detail === undefined || detail.name === null) {
      continue;
    }
    const osmElement = parseOsmElementRef(osmElementKey);
    if (osmElement === null) {
      continue;
    }

    const image = parseLocationImage(record);
    const relatedPages = parseRelatedPages(record);
    const entry: LocationEntry = {
      id,
      name: detail.name,
      lat: coordinates.lat,
      lng: coordinates.lng,
      relatedPages,
      osmElement,
      wheelchair: mapWheelchair(detail.wheelchair),
      osmEditUrl: buildOsmEditUrl(osmElement),
    };
    if (image !== null) {
      entry.imageUri = image.imageUri;
      entry.imageCreator = image.imageCreator;
      entry.imageLicense = image.imageLicense;
    }
    const phone = normalizePhone(detail.phone ?? detail.contactPhone);
    if (phone !== null) {
      entry.phone = phone;
    } else if (detail.phone !== undefined || detail.contactPhone !== undefined) {
      try {
        process.stderr.write(`電話番号を正規化できません: ${id}\n`);
      } catch {
        // ignore logging failure
      }
    }
    const websiteUri = resolveWebsite(detail);
    if (websiteUri !== undefined) {
      entry.websiteUri = websiteUri;
    }
    const wikipediaUri = resolveWikipediaUri(detail, wikidata);
    if (wikipediaUri !== undefined) {
      entry.wikipediaUri = wikipediaUri;
    }
    if (typeof detail.openingHours === "string" && detail.openingHours.trim().length > 0) {
      entry.openingHours = detail.openingHours as string;
    }
    const bucket = locationsByCode.get(code) ?? [];
    bucket.push(entry);
    locationsByCode.set(code, bucket);
  }

  return categoryNames.flatMap((category): LocationCategory[] => {
    const locations = locationsByCode.get(category.code);
    if (locations === undefined || locations.length === 0) {
      return [];
    }
    return [{ category: category.name, categoryId: category.code, locations }];
  });
}

function buildRouteDestinations(
  catalog: DestinationCatalog,
  categoryNames: CategoryName[],
  placesPayload: unknown,
  osmPayload: unknown,
): RouteDestinationCategory[] {
  const records = parsePlacesJsonLd(placesPayload);
  const osmNames = parseOsmNames(osmPayload);
  const knownCodes = new Set(categoryNames.map((category) => category.code));
  const locationsByCode = new Map<string, RouteDestinationLocation[]>();

  for (const entry of catalog.places) {
    if (!entry.includeInRouteForm) {
      continue;
    }

    const record = records.get(entry.id);
    if (record === undefined) {
      fail(`公開JSON-LDに掲載IDがありません: ${entry.id}`);
    }

    const coordinates = readRouteDestinationCoordinates(record, entry.id);
    const code = readGifPoiCode(record, entry.id);
    if (!knownCodes.has(code)) {
      fail(
        `gif-poiコードがカテゴリ名辞書にありません: ${code} (${entry.id})`,
      );
    }

    const osmElementKey = findOsmElementKey(record["rdfs:seeAlso"]);
    const name =
      osmElementKey === null ? undefined : osmNames.get(osmElementKey);
    if (name === null || name === undefined) {
      continue;
    }

    const locations = locationsByCode.get(code) ?? [];
    locations.push({ name, lat: coordinates.lat, lng: coordinates.lng });
    locationsByCode.set(code, locations);
  }

  return categoryNames.flatMap((category): RouteDestinationCategory[] => {
    const locations = locationsByCode.get(category.code);
    if (locations === undefined || locations.length === 0) {
      return [];
    }
    return [
      {
        category: category.name,
        categoryId: category.code,
        locations,
      },
    ];
  });
}

type PolygonCoordinates = number[][][];
type MultiPolygonCoordinates = number[][][][];
type GeoJsonGeometry = JsonRecord &
  (
    | { type: "Polygon"; coordinates: PolygonCoordinates }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates }
  );

type GeoJsonFeature = JsonRecord & {
  type: "Feature";
  properties: JsonRecord & { name: string };
  geometry: GeoJsonGeometry;
};

type TownGeoJson = JsonRecord & {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export interface LocationArtifact {
  status: "validated";
  sourceUris: LocationArtifactSourceUris;
  sources: {
    routeDestinations: RouteDestinationCategory[];
    locations: LocationCategory[];
    townGeoJson: TownGeoJson;
  };
  derivedRegions: Record<string, string>;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function fail(message: string): never {
  throw new Error(`Location artifact validation failed: ${message}`);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAbsoluteHttpUri(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    INVALID_URI_CHARACTER_PATTERN.test(value)
  ) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function requireAbsoluteHttpUri(value: unknown, fieldPath: string): string {
  if (!isAbsoluteHttpUri(value)) {
    fail(`${fieldPath} must be an absolute http(s) URI`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, fieldPath: string): string {
  if (!isNonEmptyString(value)) {
    fail(`${fieldPath} must be a non-empty string`);
  }
  return value;
}

function validateOptionalUri(
  record: JsonRecord,
  fieldName: string,
  fieldPath: string,
): void {
  if (
    !(fieldName in record) ||
    record[fieldName] === undefined ||
    record[fieldName] === null
  ) {
    return;
  }
  requireAbsoluteHttpUri(record[fieldName], fieldPath);
}

function validatePosition(value: unknown, fieldPath: string): number[] {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !value.every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  ) {
    fail(`${fieldPath} must contain only finite coordinate numbers`);
  }
  return value as number[];
}

function validatePolygonCoordinates(
  value: unknown,
  fieldPath: string,
): PolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${fieldPath} must contain at least one ring`);
  }

  return value.map((ring, ringIndex) => {
    const ringPath = `${fieldPath}[${ringIndex}]`;
    if (!Array.isArray(ring) || ring.length === 0) {
      fail(`${ringPath} must contain at least one position`);
    }
    return ring.map((position, positionIndex) =>
      validatePosition(position, `${ringPath}[${positionIndex}]`),
    );
  });
}

function validateMultiPolygonCoordinates(
  value: unknown,
  fieldPath: string,
): MultiPolygonCoordinates {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${fieldPath} must contain at least one polygon`);
  }

  return value.map((polygon, polygonIndex) =>
    validatePolygonCoordinates(polygon, `${fieldPath}[${polygonIndex}]`),
  );
}

function validateTownGeoJson(value: unknown): TownGeoJson {
  if (!isRecord(value) || value.type !== "FeatureCollection") {
    fail("townGeoJson must be a FeatureCollection");
  }
  if (!Array.isArray(value.features) || value.features.length === 0) {
    fail("townGeoJson.features must be a non-empty array");
  }

  const features: GeoJsonFeature[] = value.features.map((rawFeature, featureIndex) => {
    const featurePath = `townGeoJson.features[${featureIndex}]`;
    if (!isRecord(rawFeature) || rawFeature.type !== "Feature") {
      fail(`${featurePath}.type must be Feature`);
    }
    if (!isRecord(rawFeature.properties)) {
      fail(`${featurePath}.properties must be an object`);
    }
    requireNonEmptyString(
      rawFeature.properties.name,
      `${featurePath}.properties.name`,
    );
    validateOptionalUri(
      rawFeature.properties,
      "uri",
      `${featurePath}.properties.uri`,
    );

    if (!isRecord(rawFeature.geometry)) {
      fail(`${featurePath}.geometry must be an object`);
    }

    let coordinates: PolygonCoordinates | MultiPolygonCoordinates;
    if (rawFeature.geometry.type === "Polygon") {
      coordinates = validatePolygonCoordinates(
        rawFeature.geometry.coordinates,
        `${featurePath}.geometry.coordinates`,
      );
    } else if (rawFeature.geometry.type === "MultiPolygon") {
      coordinates = validateMultiPolygonCoordinates(
        rawFeature.geometry.coordinates,
        `${featurePath}.geometry.coordinates`,
      );
    } else {
      fail(`${featurePath}.geometry.type must be Polygon or MultiPolygon`);
    }

    return {
      ...rawFeature,
      geometry: {
        ...rawFeature.geometry,
        coordinates,
      },
    } as GeoJsonFeature;
  });

  return {
    ...value,
    features,
  } as TownGeoJson;
}

function validateSourceUris(value: unknown): LocationArtifactSourceUris {
  if (!isRecord(value)) {
    fail("appConfig must be an object");
  }

  return {
    placesJsonLdUri: requireAbsoluteHttpUri(
      value.placesJsonLdUri,
      "appConfig.placesJsonLdUri",
    ),
    osmMirrorUri: requireAbsoluteHttpUri(
      value.osmMirrorUri,
      "appConfig.osmMirrorUri",
    ),
    townGeoJsonUri: requireAbsoluteHttpUri(
      value.townGeoJsonUri,
      "appConfig.townGeoJsonUri",
    ),
    categoryNamesUri: requireAbsoluteHttpUri(
      value.categoryNamesUri,
      "appConfig.categoryNamesUri",
    ),
    wikidataMirrorUri: requireAbsoluteHttpUri(
      value.wikidataMirrorUri,
      "appConfig.wikidataMirrorUri",
    ),
  };
}

function pointOnSegment(
  point: [number, number],
  start: number[],
  end: number[],
): boolean {
  const [x, y] = point;
  const [startX, startY] = start;
  const [endX, endY] = end;
  const cross = (x - startX) * (endY - startY) - (y - startY) * (endX - startX);
  if (Math.abs(cross) > Number.EPSILON) {
    return false;
  }
  return (
    x >= Math.min(startX, endX) &&
    x <= Math.max(startX, endX) &&
    y >= Math.min(startY, endY) &&
    y <= Math.max(startY, endY)
  );
}

function isPointInRing(point: [number, number], ring: PolygonCoordinates[number]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (pointOnSegment(point, currentPoint, previousPoint)) {
      return true;
    }

    const intersects =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0];
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function isPointInPolygon(
  point: [number, number],
  polygon: PolygonCoordinates,
): boolean {
  if (!isPointInRing(point, polygon[0])) {
    return false;
  }
  return polygon.slice(1).every((hole) => !isPointInRing(point, hole));
}

function isPointInGeometry(
  point: [number, number],
  geometry: GeoJsonFeature["geometry"],
): boolean {
  if (geometry.type === "Polygon") {
    return isPointInPolygon(point, geometry.coordinates);
  }
  return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon));
}

function displayRegionName(name: string): string {
  return name.startsWith(LOCATION_PREFIX)
    ? name.slice(LOCATION_PREFIX.length)
    : name;
}

function regionForPoint(
  lat: number,
  lng: number,
  townGeoJson: TownGeoJson,
): string {
  const point: [number, number] = [lng, lat];
  for (const feature of townGeoJson.features) {
    if (isPointInGeometry(point, feature.geometry)) {
      return displayRegionName(feature.properties.name);
    }
  }
  return "その他";
}

function deriveRegions(
  locations: LocationCategory[],
  townGeoJson: TownGeoJson,
): Record<string, string> {
  const derivedRegions: Record<string, string> = {};

  for (const category of locations) {
    for (const location of category.locations) {
      derivedRegions[location.id] = regionForPoint(location.lat, location.lng, townGeoJson);
    }
  }

  return derivedRegions;
}

async function fetchJson(
  sourceName: string,
  uri: string,
  transport: LocationArtifactTransport,
): Promise<unknown> {
  const response = await transport(uri);
  if (!response || typeof response !== "object") {
    fail(`${sourceName} transport returned an invalid response`);
  }
  if (!response.ok || response.status < 200 || response.status >= 300) {
    throw new Error(`${sourceName} request failed with HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Acquires, validates, and atomically publishes every location data source.
 * The writer is called exactly once, after every source and derived region has
 * passed validation.
 */
export async function generateLocationArtifact(
  options: GenerateLocationArtifactOptions,
): Promise<LocationArtifact> {
  if (!isRecord(options)) {
    throw new Error("Location artifact generator options must be an object");
  }
  if (typeof options.transport !== "function") {
    throw new Error("Location artifact generator requires a transport function");
  }
  if (typeof options.writeArtifact !== "function") {
    throw new Error("Location artifact generator requires a writer function");
  }

  const sourceUris = validateSourceUris(options.appConfig);
  const catalog = validateDestinationCatalog(options.destinationCatalog);
  if (catalog.source.placesUri !== sourceUris.placesJsonLdUri) {
    fail(
      "目録のsource.placesUriとappConfig.placesJsonLdUriが一致しません。目録を再生成してください",
    );
  }
  if (catalog.source.osmMirrorUri !== sourceUris.osmMirrorUri) {
    fail(
      "目録のsource.osmMirrorUriとappConfig.osmMirrorUriが一致しません。目録を再生成してください",
    );
  }

  const [
    placesPayload,
    osmPayload,
    townPayload,
    categoryNamesPayload,
    wikidataPayload,
  ] = await Promise.all([
    fetchJson("placesJsonLd", sourceUris.placesJsonLdUri, options.transport),
    fetchJson("osmMirror", sourceUris.osmMirrorUri, options.transport),
    fetchJson("townGeoJson", sourceUris.townGeoJsonUri, options.transport),
    fetchJson("categoryNames", sourceUris.categoryNamesUri, options.transport),
    fetchJson("wikidataMirror", sourceUris.wikidataMirrorUri, options.transport),
  ]);

  const categoryNames = parseCategoryNames(categoryNamesPayload);
  const routeDestinations = buildRouteDestinations(
    catalog,
    categoryNames,
    placesPayload,
    osmPayload,
  );
  const locations = buildLocations(categoryNames, placesPayload, osmPayload, wikidataPayload);
  const townGeoJson = validateTownGeoJson(townPayload);
  const artifact: LocationArtifact = {
    status: "validated",
    sourceUris,
    sources: {
      routeDestinations,
      locations,
      townGeoJson,
    },
    derivedRegions: deriveRegions(locations, townGeoJson),
  };

  await options.writeArtifact(artifact);
  return artifact;
}

async function fetchFromNetwork(
  uri: string,
): Promise<LocationArtifactTransportResponse> {
  const response = await fetch(uri);
  return {
    ok: response.ok,
    status: response.status,
    json: async () => {
      try {
        return await response.json();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`JSON decode failed for ${uri}: ${detail}`, {
          cause: error,
        });
      }
    },
  };
}

async function writeArtifactAtomically(
  artifact: LocationArtifact,
  artifactPath: string,
): Promise<void> {
  const artifactDirectory = dirname(artifactPath);
  let temporaryPath: string | null = null;

  try {
    await mkdir(artifactDirectory, { recursive: true });
    temporaryPath = resolve(
      artifactDirectory,
      `.location-data.json.${process.pid}.${randomUUID()}.tmp`,
    );
    await writeFile(
      temporaryPath,
      `${JSON.stringify(artifact)}\n`,
      "utf8",
    );
    await rename(temporaryPath, artifactPath);
    temporaryPath = null;
  } finally {
    if (temporaryPath !== null) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function runCli(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const appConfigPath = resolve(projectRoot, "app-config.json");
    const artifactPath = resolve(
      projectRoot,
      "public",
      "generated",
      "location-data.json",
    );
    const appConfig = JSON.parse(await readFile(appConfigPath, "utf8")) as unknown;
    const catalogPath = resolve(projectRoot, "data", "destinations.json");
    const destinationCatalog = JSON.parse(
      await readFile(catalogPath, "utf8"),
    ) as unknown;

    await generateLocationArtifact({
      appConfig,
      destinationCatalog,
      transport: fetchFromNetwork,
      writeArtifact: (artifact) => writeArtifactAtomically(artifact, artifactPath),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${detail}\n`);
    process.exitCode = 1;
  }
}

function isDirectCliInvocation(): boolean {
  const entrypoint = process.argv[1];
  return (
    typeof entrypoint === "string" &&
    basename(entrypoint) === "generate-location-artifact.ts"
  );
}

if (isDirectCliInvocation()) {
  void runCli();
}
