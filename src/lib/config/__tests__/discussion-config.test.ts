const canonicalDiscussionPubkey =
  "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8";
const canonicalBusStopNaddr =
  "naddr1qvzqqqyx7cpzpjvzz5zkjenkd5a2ldp5w8x894v6nh7j3pd26far8k33dp0helhcqqrj6wfc8yer2vq94g3w9";
const canonicalDiscussionListNaddr =
  "naddr1qvzqqqyx7cpzpjvzz5zkjenkd5a2ldp5w8x894v6nh7j3pd26far8k33dp0helhcqq8hgetnwskkg6tnvd6hxumfdahq9reds2";

interface DiscussionOverrides {
  enabled?: boolean;
  adminPubkey?: string;
  busStopDiscussionId?: string;
  discussionListNaddr?: string;
  nostrRelays?: string[];
  nostrTimeoutMs?: number;
  readStrategy?: {
    idleTimeoutMs?: number;
    hardTimeoutMs?: number;
    dedupWindowMs?: number;
  };
}

function makeAppConfig(overrides: DiscussionOverrides = {}) {
  return {
    appUrl: "http://localhost:3000",
    gaMeasurementId: "",
    locationsDataVersion: "1.0.0",
    discussion: {
      enabled: overrides.enabled ?? false,
      adminPubkey: overrides.adminPubkey ?? "",
      busStopDiscussionId: overrides.busStopDiscussionId ?? "",
      discussionListNaddr: overrides.discussionListNaddr ?? "",
      nostrRelays: overrides.nostrRelays ?? ["wss://relay.example"],
      nostrTimeoutMs: overrides.nostrTimeoutMs ?? 5000,
      readStrategy: {
        idleTimeoutMs: overrides.readStrategy?.idleTimeoutMs ?? 5000,
        hardTimeoutMs: overrides.readStrategy?.hardTimeoutMs ?? 15000,
        dedupWindowMs: overrides.readStrategy?.dedupWindowMs ?? 250,
      },
    },
    support: {
      enabled: false,
      koFiUsername: "",
      heading: "支援",
      message: "支援メッセージ",
    },
  };
}

async function loadDiscussionConfig(overrides: DiscussionOverrides = {}) {
  jest.resetModules();
  jest.doMock("../app-config", () => ({
    appConfig: makeAppConfig(overrides),
  }));
  return import("../discussion-config");
}

describe("getDiscussionConfig", () => {
  it("reads public discussion settings from app config", async () => {
    const { getDiscussionConfig, getDiscussionListConfig } =
      await loadDiscussionConfig({
        enabled: true,
        adminPubkey: canonicalDiscussionPubkey,
        busStopDiscussionId: canonicalBusStopNaddr,
        discussionListNaddr: canonicalDiscussionListNaddr,
      });
    const config = getDiscussionConfig();
    const listConfig = getDiscussionListConfig();

    expect(config.busStopDiscussionId).toBe(
      `34550:${canonicalDiscussionPubkey}:-989250`,
    );
    expect(listConfig).toEqual({
      naddr: canonicalDiscussionListNaddr,
      kind: 34550,
      enabled: true,
    });
  });

  it("rejects invalid discussion id formats", async () => {
    const { getDiscussionConfig } = await loadDiscussionConfig({
      enabled: true,
      adminPubkey: canonicalDiscussionPubkey,
      busStopDiscussionId: `34550:${canonicalDiscussionPubkey}:naddr1invalid`,
    });

    expect(() => getDiscussionConfig()).toThrow("Invalid discussion id format");
  });
});

describe("getDiscussionReadStrategyConfig", () => {
  it("uses the configured timeout values", async () => {
    const { getDiscussionReadStrategyConfig } = await loadDiscussionConfig({
      readStrategy: {
        idleTimeoutMs: 1500,
        hardTimeoutMs: 5000,
        dedupWindowMs: 400,
      },
    });
    const config = getDiscussionReadStrategyConfig();

    expect(config).toEqual({
      idleTimeoutMs: 1500,
      hardTimeoutMs: 5000,
      dedupWindowMs: 400,
    });
  });

  it("clamps invalid configured timeout values", async () => {
    const { getDiscussionReadStrategyConfig } = await loadDiscussionConfig({
      readStrategy: {
        idleTimeoutMs: Number.NaN,
        hardTimeoutMs: 1,
        dedupWindowMs: 20_000,
      },
    });
    const config = getDiscussionReadStrategyConfig();

    expect(config.idleTimeoutMs).toBe(5000);
    expect(config.hardTimeoutMs).toBeGreaterThan(config.idleTimeoutMs);
    expect(config.dedupWindowMs).toBe(10_000);
  });
});
