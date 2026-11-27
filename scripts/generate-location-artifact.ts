import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
  appConfigFileName,
  resolveAppConfigEnvironment,
} from "../src/lib/config/app-config-environment";
import {
  findOsmElementKey,
  validateDestinationCatalog,
  type DestinationCatalog,
} from "../src/lib/location/destination-catalog";
import {
  LOCATION_IMAGE_DIRECTORY,
  type LocationImageData,
  type LocationImageVariant,
} from "../src/lib/location/location-image";

const LOCATION_PREFIX = "東京都千代田区";
const INVALID_URI_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f]/;

const LOCATION_IMAGE_WIDTHS = [480, 960, 1280] as const;
const LOCATION_IMAGE_MAX_SOURCE_WIDTH = 1280;
const LOCATION_IMAGE_CONCURRENCY = 2;
const LOCATION_IMAGE_REQUEST_INTERVAL_MS = 250;
const LOCATION_IMAGE_RETRY_LIMIT = 3;
const LOCATION_IMAGE_RETRY_BASE_DELAY_MS = 1000;
const LOCATION_IMAGE_SOURCE_HOST = "upload.wikimedia.org";
const LOCATION_IMAGE_COMMONS_PREFIX = "/wikipedia/commons/";
const USER_AGENT =
  "KazagurumaTransit/1.0 (+https://github.com/nawashiro/kazaguruma-transit)";

export interface LocationImageFetchResponse {
  ok: boolean;
  status: number;
  retryAfterSeconds?: number | null;
  bytes: () => Promise<Uint8Array>;
}

export interface EncodedLocationImageVariant {
  width: number;
  height: number;
  bytes: Uint8Array;
}

export interface EncodedLocationImage {
  width: number;
  height: number;
  variants: EncodedLocationImageVariant[];
}

export interface LocationImagePipeline {
  fetch: (uri: string) => Promise<LocationImageFetchResponse>;
  encode: (bytes: Uint8Array) => Promise<EncodedLocationImage>;
  write: (path: string, bytes: Uint8Array) => Promise<void>;
  clean: () => Promise<void>;
  warn: (message: string) => void;
  sleep: (milliseconds: number) => Promise<void>;
}

export function locationImageSourceUrl(imageUri: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(imageUri);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== LOCATION_IMAGE_SOURCE_HOST ||
    !parsed.pathname.startsWith(LOCATION_IMAGE_COMMONS_PREFIX)
  ) {
    return null;
  }
  const fileName = parsed.pathname.slice(parsed.pathname.lastIndexOf("/") + 1);
  if (fileName.length === 0) {
    return null;
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=${LOCATION_IMAGE_MAX_SOURCE_WIDTH}`;
}

export function plannedImageWidths(originalWidth: number): number[] {
  if (!Number.isInteger(originalWidth) || originalWidth <= 0) {
    throw new Error(`画像の幅が不正です: ${originalWidth}`);
  }
  const widths = LOCATION_IMAGE_WIDTHS.map((candidate) =>
    Math.min(candidate, originalWidth),
  );
  return [...new Set(widths)].sort((left, right) => left - right);
}

export function locationImageFileName(
  bytes: Uint8Array,
  width: number,
): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `${hash}-${width}.webp`;
}

export interface LocationArtifactSourceUris {
  datasetJsonLdUri: string;
  osmMirrorUri: string;
  townGeoJsonUri: string;
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
  images: LocationImagePipeline;
}

type JsonRecord = Record<string, unknown>;

import type {
  RouteDestinationCategory,
  RouteDestinationLocation,
} from "@/types/route-destinations";

interface CategoryTerm {
  id: string;
  code: string;
  name: string;
}

interface DatasetGraph {
  places: Array<{ id: string; record: JsonRecord }>;
  placesById: Map<string, JsonRecord>;
  terms: CategoryTerm[];
  codeById: Map<string, string>;
}

const CATEGORY_CODE_PATTERN = /^[0-9]{4}$/u;
const UUID_URN_PATTERN =
  /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function hasSchemaType(value: unknown, type: string): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const raw = value["@type"];
  return raw === type || (Array.isArray(raw) && raw.includes(type));
}

function toNodeArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function shapePathId(property: unknown): string | null {
  if (!isRecord(property)) {
    return null;
  }
  const path = property["sh:path"];
  if (isRecord(path) && typeof path["@id"] === "string") {
    return path["@id"];
  }
  return typeof path === "string" ? path : null;
}

function shapeTargetClass(shape: JsonRecord): string | null {
  const target = shape["sh:targetClass"];
  if (isRecord(target) && typeof target["@id"] === "string") {
    return target["@id"];
  }
  return typeof target === "string" ? target : null;
}

function shapeProperty(shape: JsonRecord, path: string): JsonRecord | null {
  for (const property of toNodeArray(shape["sh:property"])) {
    if (!isRecord(property) || shapePathId(property) !== path) {
      continue;
    }
    return property;
  }
  return null;
}

function assertDatasetShape(graphNodes: unknown[]): void {
  const shapes = graphNodes.filter(
    (node): node is JsonRecord =>
      isRecord(node) && hasSchemaType(node, "sh:NodeShape"),
  );
  const placeShape = shapes.find(
    (shape) => shapeTargetClass(shape) === "schema:Place",
  );
  if (placeShape === undefined) {
    fail("公開グラフに schema:Place の sh:NodeShape がありません");
  }
  for (const required of [
    "schema:geo",
    "schema:image",
    "schema:keywords",
    "rdfs:seeAlso",
  ]) {
    if (shapeProperty(placeShape, required) === null) {
      fail(`公開グラフのPlace形状が ${required} を宣言していません`);
    }
  }

  const termShape = shapes.find(
    (shape) => shapeTargetClass(shape) === "schema:DefinedTerm",
  );
  if (termShape === undefined) {
    fail("公開グラフに schema:DefinedTerm の sh:NodeShape がありません");
  }
  if (shapeProperty(termShape, "schema:name") === null) {
    fail("公開グラフのDefinedTerm形状が schema:name を宣言していません");
  }
  const identifierProperty = shapeProperty(termShape, "schema:identifier");
  if (identifierProperty === null) {
    fail("公開グラフのDefinedTerm形状が schema:identifier を宣言していません");
  }
  const identifierNode = identifierProperty["sh:node"];
  const identifierProperties = isRecord(identifierNode)
    ? toNodeArray(identifierNode["sh:property"])
    : [];
  const hasGifPoi = identifierProperties.some((property) => {
    if (!isRecord(property) || shapePathId(property) !== "schema:propertyID") {
      return false;
    }
    return property["sh:hasValue"] === "gif-poi";
  });
  if (!hasGifPoi) {
    fail("公開グラフのDefinedTerm形状が gif-poi 識別子を宣言していません");
  }
}

function parseCategoryTerm(
  raw: unknown,
  id: string,
  fieldPath: string,
): CategoryTerm {
  if (!isRecord(raw)) {
    fail(`${fieldPath} はオブジェクトである必要があります`);
  }
  if (!hasSchemaType(raw, "schema:DefinedTerm")) {
    fail(`${fieldPath} は schema:DefinedTerm である必要があります`);
  }
  if (!UUID_URN_PATTERN.test(id)) {
    fail(`${fieldPath}.@id は urn:uuid 形式である必要があります`);
  }
  const name = raw["schema:name"];
  if (!isNonEmptyString(name)) {
    fail(`${fieldPath}.schema:name は空でない文字列である必要があります`);
  }

  const identifiers = toNodeArray(raw["schema:identifier"]).filter(
    (identifier): identifier is JsonRecord =>
      isRecord(identifier) && identifier["schema:propertyID"] === "gif-poi",
  );
  if (identifiers.length !== 1) {
    fail(`${fieldPath}.schema:identifier の gif-poi は1件である必要があります`);
  }
  const code = identifiers[0]["schema:value"];
  if (typeof code !== "string" || !CATEGORY_CODE_PATTERN.test(code)) {
    fail(`${fieldPath} の gif-poi コードは4桁である必要があります`);
  }

  return { id, code, name: name.trim() };
}

function parseDatasetGraph(value: unknown): DatasetGraph {
  if (!isRecord(value) || !Array.isArray(value["@graph"])) {
    fail("公開グラフは @graph 配列を持つ必要があります");
  }
  const graphNodes = value["@graph"];
  assertDatasetShape(graphNodes);

  const rawTerms = new Map<string, JsonRecord>();
  for (const node of graphNodes) {
    if (!isRecord(node) || !hasSchemaType(node, "schema:DefinedTerm")) {
      continue;
    }
    const id = node["@id"];
    if (typeof id !== "string") {
      fail("DefinedTerm の @id は文字列である必要があります");
    }
    if (rawTerms.has(id)) {
      fail(`DefinedTerm の @id が重複しています: ${id}`);
    }
    rawTerms.set(id, node);
  }

  const termSets = graphNodes.filter(
    (node): node is JsonRecord =>
      isRecord(node) && hasSchemaType(node, "schema:DefinedTermSet"),
  );
  if (termSets.length !== 1) {
    fail("公開グラフの schema:DefinedTermSet は1件である必要があります");
  }
  const termRefs = termSets[0]["schema:hasDefinedTerm"];
  if (!Array.isArray(termRefs) || termRefs.length === 0) {
    fail("schema:hasDefinedTerm は空でない配列である必要があります");
  }

  const terms: CategoryTerm[] = [];
  const codeById = new Map<string, string>();
  const seenCodes = new Set<string>();
  termRefs.forEach((ref, index) => {
    const refPath = `schema:hasDefinedTerm[${index}]`;
    const id = isRecord(ref) ? ref["@id"] : undefined;
    if (typeof id !== "string") {
      fail(`${refPath} の @id は文字列である必要があります`);
    }
    const rawTerm = rawTerms.get(id);
    if (rawTerm === undefined) {
      fail(`${refPath} が参照する DefinedTerm がありません: ${id}`);
    }
    const term = parseCategoryTerm(rawTerm, id, `DefinedTerm ${id}`);
    if (seenCodes.has(term.code)) {
      fail(`カテゴリコードが重複しています: ${term.code}`);
    }
    seenCodes.add(term.code);
    terms.push(term);
    codeById.set(term.id, term.code);
  });

  const places: Array<{ id: string; record: JsonRecord }> = [];
  const placesById = new Map<string, JsonRecord>();
  for (const node of graphNodes) {
    if (!isRecord(node) || !hasSchemaType(node, "schema:Place")) {
      continue;
    }
    const id = node["@id"];
    if (typeof id !== "string" || !UUID_URN_PATTERN.test(id)) {
      fail("Place の @id は urn:uuid 形式である必要があります");
    }
    if (placesById.has(id)) {
      fail(`公開グラフに重複した場所IDがあります: ${id}`);
    }
    places.push({ id, record: node });
    placesById.set(id, node);
  }

  return { places, placesById, terms, codeById };
}

function readCategoryCodes(record: JsonRecord, dataset: DatasetGraph): string[] {
  const raw = record["schema:keywords"];
  const values = toNodeArray(raw);
  const codes: string[] = [];
  for (const value of values) {
    const id = isRecord(value) ? value["@id"] : undefined;
    if (typeof id !== "string") {
      fail("schema:keywords の値は @id を持つ必要があります");
    }
    const code = dataset.codeById.get(id);
    if (code === undefined) {
      fail(`schema:keywords の参照先termがありません: ${id}`);
    }
    if (!codes.includes(code)) {
      codes.push(code);
    }
  }
  return codes;
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

interface LocationImageAttribution {
  imageUri: string;
  imageCreator?: string;
  imageLicense: string;
}

function parseLocationImage(record: JsonRecord): LocationImageAttribution | null {
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
  if (!isAbsoluteHttpUri(contentUrl) || !isNonEmptyString(license)) {
    return null;
  }
  const attribution: LocationImageAttribution = {
    imageUri: contentUrl,
    imageLicense: license.trim(),
  };
  if (isNonEmptyString(creatorName)) {
    attribution.imageCreator = creatorName.trim();
  }
  return attribution;
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

export interface LocationEntry {
  id: string;
  name: string;
  lat: number;
  lng: number;
  walkMeters?: number;
  imageUri?: string;
  imageCreator?: string;
  imageLicense?: string;
  image?: LocationImageData;
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
  catalog: DestinationCatalog,
  dataset: DatasetGraph,
  osmPayload: unknown,
  wikidataPayload: unknown,
): LocationCategory[] {
  const catalogIds = new Set(catalog.places.map((entry) => entry.id));
  const walkMetersById = new Map(
    catalog.places.map((entry) => [entry.id, entry.walkToStopMeters]),
  );
  const osmDetails = parseOsmDetails(osmPayload);
  const wikidata = parseWikidataMirror(wikidataPayload);
  const locationsByCode = new Map<string, LocationEntry[]>();
  let excludedWithoutCategory = 0;

  for (const { id, record } of dataset.places) {
    if (!catalogIds.has(id)) {
      continue;
    }

    const coordinates = readRouteDestinationCoordinates(record, id);
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

    const codes = readCategoryCodes(record, dataset);
    if (codes.length === 0) {
      excludedWithoutCategory += 1;
      continue;
    }

    const image = parseLocationImage(record);
    const relatedPages = parseRelatedPages(record);
    const entry: LocationEntry = {
      id,
      name: detail.name,
      lat: coordinates.lat,
      lng: coordinates.lng,
      walkMeters: walkMetersById.get(id),
      relatedPages,
      osmElement,
      wheelchair: mapWheelchair(detail.wheelchair),
      osmEditUrl: buildOsmEditUrl(osmElement),
    };
    if (image !== null) {
      entry.imageUri = image.imageUri;
      if (image.imageCreator !== undefined) {
        entry.imageCreator = image.imageCreator;
      }
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
    for (const code of codes) {
      const bucket = locationsByCode.get(code) ?? [];
      bucket.push(entry);
      locationsByCode.set(code, bucket);
    }
  }

  if (excludedWithoutCategory > 0) {
    try {
      process.stderr.write(
        `カテゴリのない場所を除外しました: ${excludedWithoutCategory}件\n`,
      );
    } catch {
      // ignore logging failure
    }
  }

  return dataset.terms.flatMap((term): LocationCategory[] => {
    const locations = locationsByCode.get(term.code);
    if (locations === undefined || locations.length === 0) {
      return [];
    }
    return [{ category: term.name, categoryId: term.code, locations }];
  });
}

function buildRouteDestinations(
  catalog: DestinationCatalog,
  dataset: DatasetGraph,
  osmPayload: unknown,
): RouteDestinationCategory[] {
  const osmNames = parseOsmNames(osmPayload);
  const locationsByCode = new Map<string, RouteDestinationLocation[]>();

  for (const item of catalog.places) {
    if (!item.includeInRouteForm) {
      continue;
    }

    const record = dataset.placesById.get(item.id);
    if (record === undefined) {
      fail(`公開グラフに掲載IDがありません: ${item.id}`);
    }

    const coordinates = readRouteDestinationCoordinates(record, item.id);
    const osmElementKey = findOsmElementKey(record["rdfs:seeAlso"]);
    const name =
      osmElementKey === null ? undefined : osmNames.get(osmElementKey);
    if (name === null || name === undefined) {
      continue;
    }

    const codes = readCategoryCodes(record, dataset);
    for (const code of codes) {
      const locations = locationsByCode.get(code) ?? [];
      locations.push({
        name,
        lat: coordinates.lat,
        lng: coordinates.lng,
        walkMeters: item.walkToStopMeters,
      });
      locationsByCode.set(code, locations);
    }
  }

  return dataset.terms.flatMap((term): RouteDestinationCategory[] => {
    const locations = locationsByCode.get(term.code);
    if (locations === undefined || locations.length === 0) {
      return [];
    }
    return [
      {
        category: term.name,
        categoryId: term.code,
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
    datasetJsonLdUri: requireAbsoluteHttpUri(
      value.datasetJsonLdUri,
      "appConfig.datasetJsonLdUri",
    ),
    osmMirrorUri: requireAbsoluteHttpUri(
      value.osmMirrorUri,
      "appConfig.osmMirrorUri",
    ),
    townGeoJsonUri: requireAbsoluteHttpUri(
      value.townGeoJsonUri,
      "appConfig.townGeoJsonUri",
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

function normalizeImageError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function imageRetryDelay(
  response: LocationImageFetchResponse,
  attempt: number,
): number {
  const retryAfter = response.retryAfterSeconds;
  if (
    typeof retryAfter === "number" &&
    Number.isFinite(retryAfter) &&
    retryAfter >= 0
  ) {
    return Math.round(retryAfter * 1000);
  }
  return LOCATION_IMAGE_RETRY_BASE_DELAY_MS * 2 ** attempt;
}

async function fetchLocationImageBytes(
  uri: string,
  pipeline: LocationImagePipeline,
): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt += 1) {
    let response: LocationImageFetchResponse;
    try {
      response = await pipeline.fetch(uri);
    } catch (error) {
      throw normalizeImageError(error);
    }
    if (response.ok && response.status >= 200 && response.status < 300) {
      return response.bytes();
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= LOCATION_IMAGE_RETRY_LIMIT) {
      throw new Error(`画像の取得に失敗しました: HTTP ${response.status}`);
    }
    await pipeline.sleep(imageRetryDelay(response, attempt));
  }
}

async function attachLocationImages(
  locations: LocationCategory[],
  pipeline: LocationImagePipeline,
): Promise<void> {
  const targets: LocationEntry[] = [];
  const seenIds = new Set<string>();
  for (const category of locations) {
    for (const location of category.locations) {
      if (location.imageUri === undefined || seenIds.has(location.id)) {
        continue;
      }
      seenIds.add(location.id);
      targets.push(location);
    }
  }
  if (targets.length === 0) {
    return;
  }

  await pipeline.clean();
  let failed = 0;
  let nextIndex = 0;

  const processOne = async (location: LocationEntry): Promise<void> => {
    const sourceUrl =
      location.imageUri === undefined
        ? null
        : locationImageSourceUrl(location.imageUri);
    if (sourceUrl === null) {
      failed += 1;
      return;
    }
    try {
      const bytes = await fetchLocationImageBytes(sourceUrl, pipeline);
      const encoded = await pipeline.encode(bytes);
      const encodedVariants = [...encoded.variants].sort(
        (left, right) => left.width - right.width,
      );
      if (
        !Number.isInteger(encoded.width) ||
        encoded.width <= 0 ||
        !Number.isInteger(encoded.height) ||
        encoded.height <= 0 ||
        encodedVariants.length === 0
      ) {
        failed += 1;
        return;
      }
      const variants: LocationImageVariant[] = [];
      for (const variant of encodedVariants) {
        const path = `${LOCATION_IMAGE_DIRECTORY}/${locationImageFileName(variant.bytes, variant.width)}`;
        await pipeline.write(path, variant.bytes);
        variants.push({ width: variant.width, path });
      }
      location.image = {
        width: encoded.width,
        height: encoded.height,
        variants,
      };
    } catch {
      failed += 1;
    }
  };

  const worker = async (): Promise<void> => {
    let started = false;
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= targets.length) {
        return;
      }
      if (started) {
        await pipeline.sleep(LOCATION_IMAGE_REQUEST_INTERVAL_MS);
      }
      started = true;
      await processOne(targets[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(LOCATION_IMAGE_CONCURRENCY, targets.length) },
      worker,
    ),
  );

  if (failed > 0) {
    pipeline.warn(`写真を取得できませんでした: ${failed}件`);
  }
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
  if (!isRecord(options.images)) {
    throw new Error("Location artifact generator requires an image pipeline");
  }
  for (const method of [
    "fetch",
    "encode",
    "write",
    "clean",
    "warn",
    "sleep",
  ] as const) {
    if (typeof options.images[method] !== "function") {
      throw new Error(
        `Location artifact generator image pipeline requires ${method}`,
      );
    }
  }

  const sourceUris = validateSourceUris(options.appConfig);
  const catalog = validateDestinationCatalog(options.destinationCatalog);
  if (catalog.source.datasetJsonLdUri !== sourceUris.datasetJsonLdUri) {
    fail(
      "目録のsource.datasetJsonLdUriとappConfig.datasetJsonLdUriが一致しません。目録を再生成してください",
    );
  }
  if (catalog.source.osmMirrorUri !== sourceUris.osmMirrorUri) {
    fail(
      "目録のsource.osmMirrorUriとappConfig.osmMirrorUriが一致しません。目録を再生成してください",
    );
  }

  const [datasetPayload, osmPayload, townPayload, wikidataPayload] =
    await Promise.all([
      fetchJson("datasetJsonLd", sourceUris.datasetJsonLdUri, options.transport),
      fetchJson("osmMirror", sourceUris.osmMirrorUri, options.transport),
      fetchJson("townGeoJson", sourceUris.townGeoJsonUri, options.transport),
      fetchJson("wikidataMirror", sourceUris.wikidataMirrorUri, options.transport),
    ]);

  const dataset = parseDatasetGraph(datasetPayload);
  const routeDestinations = buildRouteDestinations(catalog, dataset, osmPayload);
  const locations = buildLocations(
    catalog,
    dataset,
    osmPayload,
    wikidataPayload,
  );
  const townGeoJson = validateTownGeoJson(townPayload);
  await attachLocationImages(locations, options.images);
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

function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    return Number(trimmed);
  }
  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

async function fetchImageFromNetwork(
  uri: string,
): Promise<LocationImageFetchResponse> {
  const response = await fetch(uri, {
    headers: { "user-agent": USER_AGENT },
    redirect: "follow",
  });
  return {
    ok: response.ok,
    status: response.status,
    retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
    bytes: async () => new Uint8Array(await response.arrayBuffer()),
  };
}

async function encodeLocationImage(
  bytes: Uint8Array,
): Promise<EncodedLocationImage> {
  const { default: sharp } = await import("sharp");
  const rotated = await sharp(bytes).rotate().toBuffer();
  const metadata = await sharp(rotated).metadata();
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error("画像の寸法を取得できません");
  }

  const variants: EncodedLocationImageVariant[] = [];
  for (const width of plannedImageWidths(metadata.width)) {
    const encoded = await sharp(rotated)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const encodedMetadata = await sharp(encoded).metadata();
    if (
      encodedMetadata.width === undefined ||
      encodedMetadata.height === undefined
    ) {
      throw new Error("派生画像の寸法を取得できません");
    }
    variants.push({
      width: encodedMetadata.width,
      height: encodedMetadata.height,
      bytes: new Uint8Array(encoded),
    });
  }

  return {
    width: metadata.width,
    height: metadata.height,
    variants,
  };
}

function createDefaultImagePipeline(
  publicDirectory: string,
): LocationImagePipeline {
  const imageDirectory = resolve(
    publicDirectory,
    "generated",
    "location-images",
  );
  return {
    fetch: fetchImageFromNetwork,
    encode: encodeLocationImage,
    clean: async () => {
      await rm(imageDirectory, { recursive: true, force: true });
      await mkdir(imageDirectory, { recursive: true });
    },
    write: async (path, bytes) => {
      const targetPath = resolve(publicDirectory, path.replace(/^\//u, ""));
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, bytes);
    },
    warn: (message) => {
      process.stderr.write(`${message}\n`);
    },
    sleep: (milliseconds) =>
      new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
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
    const appConfigPath = resolve(
      projectRoot,
      appConfigFileName(resolveAppConfigEnvironment(process.env)),
    );
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
      images: createDefaultImagePipeline(resolve(projectRoot, "public")),
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
