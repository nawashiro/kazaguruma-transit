const CACHE_PREFIX = "kazaguruma-discussion-read-v1:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface KnownDiscussionData<TMetadata = unknown, TEvent = unknown> {
  version: 1;
  savedAt: number;
  metadata: TMetadata | null;
  eventIds: string[];
  attemptedRelayUrls?: string[];
  successfulEventRelayUrls?: string[];
  successfulRelays: string[];
  /** Cached event bodies are provisional only; every visit still reads relays. */
  events?: TEvent[];
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isObjectOrNull = (value: unknown): boolean =>
  value === null || (typeof value === "object" && !Array.isArray(value));

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

const canUseStorage = (): boolean => typeof window !== "undefined" && !!window.sessionStorage;

export const loadKnownDiscussionData = <TMetadata, TEvent = unknown>(
  discussionId: string
): KnownDiscussionData<TMetadata, TEvent> | null => {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}${discussionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KnownDiscussionData<TMetadata, TEvent>>;
    if (parsed.version !== 1 || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    const eventIds = isStringArray(parsed.eventIds) ? parsed.eventIds : [];
    const attemptedRelayUrls = isStringArray(parsed.attemptedRelayUrls)
      ? parsed.attemptedRelayUrls
      : [];
    const successfulEventRelayUrls = isStringArray(parsed.successfulEventRelayUrls)
      ? parsed.successfulEventRelayUrls
      : isStringArray(parsed.successfulRelays)
        ? parsed.successfulRelays
        : [];
    const successfulRelays = isStringArray(parsed.successfulRelays)
      ? parsed.successfulRelays
      : successfulEventRelayUrls;
    const metadata = isObjectOrNull(parsed.metadata) ? parsed.metadata : null;
    const events = Array.isArray(parsed.events)
      ? parsed.events.filter(isCachedEvent)
      : [];
    return {
      version: 1,
      savedAt: parsed.savedAt,
      metadata: metadata as TMetadata | null,
      eventIds,
      attemptedRelayUrls,
      successfulEventRelayUrls,
      successfulRelays,
      events,
    };
  } catch {
    return null;
  }
};

export const saveKnownDiscussionData = <TMetadata, TEvent extends { id: string } = never>(
  discussionId: string,
  incoming: Omit<KnownDiscussionData<TMetadata, TEvent>, "version" | "savedAt">
): void => {
  if (!canUseStorage()) return;
  const current = loadKnownDiscussionData<TMetadata, TEvent>(discussionId);
  const eventsById = new Map<string, TEvent>();
  [...(current?.events ?? []), ...(incoming.events ?? [])].forEach((event) => {
    eventsById.set(event.id, event);
  });
  const next: KnownDiscussionData<TMetadata, TEvent> = {
    version: 1,
    savedAt: Date.now(),
    metadata: incoming.metadata ?? current?.metadata ?? null,
    eventIds: Array.from(new Set([...(current?.eventIds ?? []), ...incoming.eventIds])),
    attemptedRelayUrls: Array.from(new Set([...(current?.attemptedRelayUrls ?? []), ...(incoming.attemptedRelayUrls ?? [])])),
    successfulEventRelayUrls: Array.from(new Set([...(current?.successfulEventRelayUrls ?? current?.successfulRelays ?? []), ...(incoming.successfulEventRelayUrls ?? incoming.successfulRelays ?? [])])),
    successfulRelays: Array.from(
      new Set([...(current?.successfulRelays ?? current?.successfulEventRelayUrls ?? []), ...(incoming.successfulRelays ?? incoming.successfulEventRelayUrls ?? [])])
    ),
    events: Array.from(eventsById.values()),
  };
  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}${discussionId}`, JSON.stringify(next));
  } catch {
    // Storage may be unavailable or full; reads must continue without cache.
  }
};
