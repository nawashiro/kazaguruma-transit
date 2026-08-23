import {
  loadKnownDiscussionData,
  saveKnownDiscussionData,
} from "@/lib/discussion/discussion-known-data-cache";

const V1_CACHE_PREFIX = "kazaguruma-discussion-read-v1:";
const V2_CACHE_PREFIX = "kazaguruma-discussion-read-v2:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ReadCachePhase = "metadata" | "content" | "evaluation" | "reference";

type ReadCacheV2Write = {
  metadata: { title: string } | null;
  eventIds: string[];
  relayProvenance: Partial<Record<ReadCachePhase, string[]>>;
};

const saveReadCacheV2 = saveKnownDiscussionData as unknown as (
  discussionId: string,
  incoming: ReadCacheV2Write,
) => void;

const loadReadCacheV2 = loadKnownDiscussionData as unknown as (
  discussionId: string,
) => (ReadCacheV2Write & { version: 2; savedAt: number }) | null;

const legacyCache = (savedAt: number) => ({
  version: 1,
  savedAt,
  metadata: { title: "legacy" },
  eventIds: ["legacy-event"],
  successfulRelays: ["wss://legacy.example"],
});

describe("known discussion data cache", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("stores phase-scoped relay provenance and merges only within each phase", () => {
    const discussionId = "34550:a:phase-provenance";

    saveReadCacheV2(discussionId, {
      metadata: { title: "first" },
      eventIds: ["one"],
      relayProvenance: {
        metadata: ["wss://metadata-one.example"],
        content: ["wss://content-one.example"],
      },
    });
    saveReadCacheV2(discussionId, {
      metadata: { title: "second" },
      eventIds: ["one", "two"],
      relayProvenance: {
        content: ["wss://content-two.example"],
        evaluation: ["wss://evaluation.example"],
      },
    });

    expect(loadReadCacheV2(discussionId)).toMatchObject({
      version: 2,
      metadata: { title: "second" },
      eventIds: ["one", "two"],
      relayProvenance: {
        metadata: ["wss://metadata-one.example"],
        content: ["wss://content-one.example", "wss://content-two.example"],
        evaluation: ["wss://evaluation.example"],
      },
    });
    expect(
      loadReadCacheV2(discussionId)?.relayProvenance.metadata,
    ).not.toContain("wss://content-two.example");
    expect(window.sessionStorage.getItem(`${V1_CACHE_PREFIX}${discussionId}`)).toBeNull();
    expect(window.sessionStorage.getItem(`${V2_CACHE_PREFIX}${discussionId}`)).not.toBeNull();
  });

  it("ignores a valid v1 cache instead of treating legacy relays as v2 provenance", () => {
    const discussionId = "34550:a:legacy-version";
    window.sessionStorage.setItem(
      `${V1_CACHE_PREFIX}${discussionId}`,
      JSON.stringify(legacyCache(Date.now())),
    );

    expect(loadKnownDiscussionData(discussionId)).toBeNull();
  });

  it("ignores an expired v2 cache and does not fall back to a legacy v1 entry", () => {
    const discussionId = "34550:a:expired";
    window.sessionStorage.setItem(
      `${V1_CACHE_PREFIX}${discussionId}`,
      JSON.stringify(legacyCache(Date.now())),
    );
    window.sessionStorage.setItem(
      `${V2_CACHE_PREFIX}${discussionId}`,
      JSON.stringify({
        version: 2,
        savedAt: Date.now() - CACHE_TTL_MS - 1,
        metadata: null,
        eventIds: [],
        relayProvenance: {},
      }),
    );

    expect(loadKnownDiscussionData(discussionId)).toBeNull();
  });

  it("ignores corrupt v2 JSON and does not fall back to a legacy v1 entry", () => {
    const discussionId = "34550:a:corrupt";
    window.sessionStorage.setItem(
      `${V1_CACHE_PREFIX}${discussionId}`,
      JSON.stringify(legacyCache(Date.now())),
    );
    window.sessionStorage.setItem(`${V2_CACHE_PREFIX}${discussionId}`, "{not-json");

    expect(() => loadKnownDiscussionData(discussionId)).not.toThrow();
    expect(loadKnownDiscussionData(discussionId)).toBeNull();
  });

  it("keeps reads fail-soft when sessionStorage is unavailable", () => {
    const originalSessionStorage = window.sessionStorage;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: undefined,
    });

    try {
      expect(() => loadKnownDiscussionData("34550:a:storage-error")).not.toThrow();
      expect(loadKnownDiscussionData("34550:a:storage-error")).toBeNull();
    } finally {
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        value: originalSessionStorage,
      });
    }
  });
});
