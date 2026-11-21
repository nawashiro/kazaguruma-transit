const UUID_URN_PATTERN =
  /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INVALID_URI_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f]/u;
const OSM_ELEMENT_URI_PATTERN =
  /^https?:\/\/(?:www\.)?openstreetmap\.org\/(node|way|relation)\/(\d+)(?:[/?#].*)?$/u;

export interface DestinationCatalogSourceUris {
  datasetJsonLdUri: string;
  osmMirrorUri: string;
}

export interface DestinationCatalogEntry {
  id: string;
  name: string;
  includeInRouteForm: boolean;
}

export interface DestinationCatalog {
  source: DestinationCatalogSourceUris;
  places: DestinationCatalogEntry[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message: string): never {
  throw new Error(`目的地目録の形式が不正です: ${message}`);
}

export function isAbsoluteHttpUri(value: unknown): value is string {
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

export function requireAbsoluteHttpUri(
  value: unknown,
  fieldPath: string,
): string {
  if (!isAbsoluteHttpUri(value)) {
    fail(`${fieldPath} は絶対 http(s) URI である必要があります`);
  }
  return value;
}

/**
 * `rdfs:seeAlso` が示すOSM要素を `node/123` 形式で返す。
 * OSM要素への参照がない場合は null を返す。
 */
export function findOsmElementKey(seeAlso: unknown): string | null {
  const values = Array.isArray(seeAlso) ? seeAlso : [seeAlso];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const match = OSM_ELEMENT_URI_PATTERN.exec(value);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

function validateSource(value: unknown): DestinationCatalogSourceUris {
  if (!isRecord(value)) {
    fail("source はオブジェクトである必要があります");
  }
  return {
    datasetJsonLdUri: requireAbsoluteHttpUri(
      value.datasetJsonLdUri,
      "source.datasetJsonLdUri",
    ),
    osmMirrorUri: requireAbsoluteHttpUri(
      value.osmMirrorUri,
      "source.osmMirrorUri",
    ),
  };
}

function validatePlaces(value: unknown): DestinationCatalogEntry[] {
  if (!Array.isArray(value)) {
    fail("places は配列である必要があります");
  }

  const ids = new Set<string>();
  return value.map((rawEntry, index) => {
    const entryPath = `places[${index}]`;
    if (!isRecord(rawEntry)) {
      fail(`${entryPath} はオブジェクトである必要があります`);
    }

    const id = rawEntry.id;
    if (typeof id !== "string" || !UUID_URN_PATTERN.test(id)) {
      fail(`${entryPath}.id は urn:uuid 形式である必要があります`);
    }
    if (ids.has(id)) {
      fail(`places に重複したIDがあります: ${id}`);
    }
    ids.add(id);

    if (!isNonEmptyString(rawEntry.name)) {
      fail(`${entryPath}.name は空でない文字列である必要があります`);
    }
    if (typeof rawEntry.includeInRouteForm !== "boolean") {
      fail(`${entryPath}.includeInRouteForm は真偽値である必要があります`);
    }

    const entry: DestinationCatalogEntry = {
      id,
      name: rawEntry.name,
      includeInRouteForm: rawEntry.includeInRouteForm,
    };
    return entry;
  });
}

export function validateDestinationCatalog(value: unknown): DestinationCatalog {
  if (!isRecord(value)) {
    fail("目録はオブジェクトである必要があります");
  }

  return {
    source: validateSource(value.source),
    places: validatePlaces(value.places),
  };
}
