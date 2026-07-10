const CACHE_PREFIX = "kazaguruma-discussion-read-v1:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface KnownDiscussionData<TMetadata = unknown> {
  version: 1;
  savedAt: number;
  metadata: TMetadata | null;
  eventIds: string[];
  successfulRelays: string[];
}

const canUseStorage = (): boolean => typeof window !== "undefined" && !!window.sessionStorage;

export const loadKnownDiscussionData = <TMetadata>(
  discussionId: string
): KnownDiscussionData<TMetadata> | null => {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}${discussionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KnownDiscussionData<TMetadata>;
    if (parsed.version !== 1 || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveKnownDiscussionData = <TMetadata>(
  discussionId: string,
  incoming: Omit<KnownDiscussionData<TMetadata>, "version" | "savedAt">
): void => {
  if (!canUseStorage()) return;
  const current = loadKnownDiscussionData<TMetadata>(discussionId);
  const next: KnownDiscussionData<TMetadata> = {
    version: 1,
    savedAt: Date.now(),
    metadata: incoming.metadata ?? current?.metadata ?? null,
    eventIds: Array.from(new Set([...(current?.eventIds ?? []), ...incoming.eventIds])),
    successfulRelays: Array.from(
      new Set([...(current?.successfulRelays ?? []), ...incoming.successfulRelays])
    ),
  };
  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}${discussionId}`, JSON.stringify(next));
  } catch {
    // Storage may be unavailable or full; reads must continue without cache.
  }
};
