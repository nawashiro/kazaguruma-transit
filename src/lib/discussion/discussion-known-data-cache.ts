const CACHE_PREFIX = "kazaguruma-discussion-read-v1:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface KnownDiscussionData<TMetadata = unknown, TEvent = unknown> {
  version: 1;
  savedAt: number;
  metadata: TMetadata | null;
  eventIds: string[];
  successfulRelays: string[];
  /** Cached event bodies are provisional only; every visit still reads relays. */
  events?: TEvent[];
}

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
    return {
      version: 1,
      savedAt: parsed.savedAt,
      metadata: parsed.metadata ?? null,
      eventIds: parsed.eventIds ?? [],
      successfulRelays: parsed.successfulRelays ?? [],
      events: parsed.events ?? [],
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
    successfulRelays: Array.from(
      new Set([...(current?.successfulRelays ?? []), ...incoming.successfulRelays])
    ),
    events: Array.from(eventsById.values()),
  };
  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}${discussionId}`, JSON.stringify(next));
  } catch {
    // Storage may be unavailable or full; reads must continue without cache.
  }
};
