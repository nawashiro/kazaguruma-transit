const CACHE_PREFIX = "kazaguruma-discussion-read-v2:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const READ_CACHE_PHASES = [
  "metadata",
  "content",
  "evaluation",
  "reference",
] as const;

export type ReadCachePhase = (typeof READ_CACHE_PHASES)[number];
export type ReadCacheRelayProvenance = Partial<
  Record<ReadCachePhase, string[]>
>;

export interface ReadCacheV2<TMetadata = unknown, TEvent = unknown> {
  version: 2;
  savedAt: number;
  metadata: TMetadata | null;
  eventIds: string[];
  relayProvenance: ReadCacheRelayProvenance;
  /** Existing callers use this only to restore provisional event state. */
  attemptedRelayUrls?: string[];
  /** Cached event bodies are provisional only; every visit still reads relays. */
  events?: TEvent[];
}

type LegacyRelayCacheFields = {
  /** @deprecated v1 relay fields are not read or written by v2. */
  successfulEventRelayUrls?: string[];
  /** @deprecated v1 relay fields are not read or written by v2. */
  successfulRelays?: string[];
};

export type KnownDiscussionData<TMetadata = unknown, TEvent = unknown> = ReadCacheV2<
  TMetadata,
  TEvent
> & LegacyRelayCacheFields;

type ReadCacheV2Write<TMetadata, TEvent> = {
  metadata: TMetadata | null;
  eventIds: string[];
  relayProvenance?: ReadCacheRelayProvenance;
  attemptedRelayUrls?: string[];
  events?: TEvent[];
  /** @deprecated Accepted for existing callers, but never migrated to v2. */
  successfulEventRelayUrls?: string[];
  /** @deprecated Accepted for existing callers, but never migrated to v2. */
  successfulRelays?: string[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isObjectOrNull = (value: unknown): boolean =>
  value === null || (typeof value === "object" && !Array.isArray(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCachedEvent = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as {
    id?: unknown;
    kind?: unknown;
    pubkey?: unknown;
    created_at?: unknown;
    content?: unknown;
    sig?: unknown;
    tags?: unknown;
  };
  return typeof event.id === "string" &&
    typeof event.kind === "number" &&
    typeof event.pubkey === "string" &&
    typeof event.created_at === "number" &&
    Number.isFinite(event.created_at) &&
    typeof event.content === "string" &&
    typeof event.sig === "string" &&
    Array.isArray(event.tags) &&
    event.tags.every(
      (tag) => Array.isArray(tag) && tag.every((item) => typeof item === "string"),
    );
};

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const normalizeRelayProvenance = (
  value: unknown,
): ReadCacheRelayProvenance | null => {
  if (!isRecord(value)) return null;

  const normalized: ReadCacheRelayProvenance = {};
  for (const phase of READ_CACHE_PHASES) {
    if (!(phase in value)) continue;
    const relayUrls = value[phase];
    if (!isStringArray(relayUrls)) return null;
    normalized[phase] = Array.from(new Set(relayUrls));
  }
  return normalized;
};

const mergeStringArrays = (...arrays: Array<string[] | undefined>): string[] =>
  Array.from(new Set(arrays.flatMap((items) => items ?? [])));

const mergeRelayProvenance = (
  current: ReadCacheRelayProvenance | undefined,
  incoming: ReadCacheRelayProvenance | undefined,
): ReadCacheRelayProvenance => {
  const merged: ReadCacheRelayProvenance = {};
  for (const phase of READ_CACHE_PHASES) {
    const relayUrls = mergeStringArrays(current?.[phase], incoming?.[phase]);
    if (relayUrls.length > 0) merged[phase] = relayUrls;
  }
  return merged;
};

export const loadKnownDiscussionData = <TMetadata, TEvent = unknown>(
  discussionId: string,
): KnownDiscussionData<TMetadata, TEvent> | null => {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${CACHE_PREFIX}${discussionId}`);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const savedAt = parsed.savedAt;
    if (
      parsed.version !== 2 ||
      typeof savedAt !== "number" ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > CACHE_TTL_MS
    ) {
      return null;
    }

    const relayProvenance = normalizeRelayProvenance(parsed.relayProvenance);
    if (!relayProvenance) return null;

    const eventIds = isStringArray(parsed.eventIds) ? parsed.eventIds : [];
    const attemptedRelayUrls = isStringArray(parsed.attemptedRelayUrls)
      ? parsed.attemptedRelayUrls
      : [];
    const metadata = isObjectOrNull(parsed.metadata) ? parsed.metadata : null;
    const events = Array.isArray(parsed.events)
      ? parsed.events.filter(isCachedEvent) as TEvent[]
      : [];

    return {
      version: 2,
      savedAt,
      metadata: metadata as TMetadata | null,
      eventIds,
      relayProvenance,
      attemptedRelayUrls,
      events,
    };
  } catch {
    return null;
  }
};

export const saveKnownDiscussionData = <
  TMetadata,
  TEvent extends { id: string } = never,
>(
  discussionId: string,
  incoming: ReadCacheV2Write<TMetadata, TEvent>,
): void => {
  const storage = getSessionStorage();
  if (!storage) return;

  const current = loadKnownDiscussionData<TMetadata, TEvent>(discussionId);
  const eventsById = new Map<string, TEvent>();
  [...(current?.events ?? []), ...(incoming.events ?? [])].forEach((event) => {
    eventsById.set(event.id, event);
  });
  const next: KnownDiscussionData<TMetadata, TEvent> = {
    version: 2,
    savedAt: Date.now(),
    metadata: incoming.metadata ?? current?.metadata ?? null,
    eventIds: Array.from(new Set([...(current?.eventIds ?? []), ...incoming.eventIds])),
    relayProvenance: mergeRelayProvenance(
      current?.relayProvenance,
      incoming.relayProvenance,
    ),
    attemptedRelayUrls: mergeStringArrays(
      current?.attemptedRelayUrls,
      incoming.attemptedRelayUrls,
    ),
    events: Array.from(eventsById.values()),
  };

  try {
    storage.setItem(`${CACHE_PREFIX}${discussionId}`, JSON.stringify(next));
  } catch {
    // Storage may be unavailable or full; reads must continue without cache.
  }
};
