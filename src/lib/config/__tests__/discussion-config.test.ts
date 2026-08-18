const originalEnv = process.env;
const canonicalDiscussionPubkey =
  "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8";
const canonicalBusStopNaddr =
  "naddr1qvzqqqyx7cpzpjvzz5zkjenkd5a2ldp5w8x894v6nh7j3pd26far8k33dp0helhcqqrj6wfc8yer2vq94g3w9";
const canonicalDiscussionListNaddr =
  "naddr1qvzqqqyx7cpzpjvzz5zkjenkd5a2ldp5w8x894v6nh7j3pd26far8k33dp0helhcqq8hgetnwskkg6tnvd6hxumfdahq9reds2";
const discussionEnvKeys = [
  "NEXT_PUBLIC_DISCUSSIONS_ENABLED",
  "NEXT_PUBLIC_ADMIN_PUBKEY",
  "NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID",
  "NEXT_PUBLIC_DISCUSSION_LIST_NADDR",
  "NEXT_PUBLIC_NOSTR_RELAYS",
  "NEXT_PUBLIC_NOSTR_TIMEOUT_MS",
  "NEXT_PUBLIC_DISCUSSION_READ_RELAY_LIMIT",
  "NEXT_PUBLIC_DISCUSSION_READ_IDLE_TIMEOUT_MS",
  "NEXT_PUBLIC_DISCUSSION_READ_HARD_TIMEOUT_MS",
  "NEXT_PUBLIC_DISCUSSION_READ_DEDUP_WINDOW_MS",
] as const;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  for (const key of discussionEnvKeys) {
    delete process.env[key];
  }
});

afterAll(() => {
  process.env = originalEnv;
});

describe("getDiscussionConfig", () => {
  it("decodes Issue #89 discussion naddrs from environment", async () => {
    process.env.NEXT_PUBLIC_DISCUSSIONS_ENABLED = "true";
    process.env.NEXT_PUBLIC_ADMIN_PUBKEY = canonicalDiscussionPubkey;
    process.env.NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID = canonicalBusStopNaddr;
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = canonicalDiscussionListNaddr;
    process.env.NEXT_PUBLIC_NOSTR_RELAYS = "wss://relay.example";

    const { getDiscussionConfig, getDiscussionListConfig } = await import(
      "../discussion-config"
    );
    const config = getDiscussionConfig();
    const listConfig = getDiscussionListConfig();

    expect(config.busStopDiscussionId).toBe(
      `34550:${canonicalDiscussionPubkey}:-989250`
    );
    expect(listConfig).toEqual({
      naddr: canonicalDiscussionListNaddr,
      kind: 34550,
      enabled: true,
    });
  });

  it("rejects invalid discussion id formats", async () => {
    process.env.NEXT_PUBLIC_DISCUSSIONS_ENABLED = "true";
    process.env.NEXT_PUBLIC_ADMIN_PUBKEY =
      "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8";
    process.env.NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID =
      "34550:c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8:naddr1invalid";
    process.env.NEXT_PUBLIC_NOSTR_RELAYS = "wss://relay.example";

    const { getDiscussionConfig } = await import("../discussion-config");

    expect(() => getDiscussionConfig()).toThrow(
      "Invalid discussion id format"
    );
  });
});

describe("getDiscussionReadStrategyConfig", () => {
  it("bounds relay limits and falls back from invalid timeout values", async () => {
    process.env.NEXT_PUBLIC_DISCUSSION_READ_RELAY_LIMIT = "99";
    process.env.NEXT_PUBLIC_DISCUSSION_READ_IDLE_TIMEOUT_MS = "invalid";
    process.env.NEXT_PUBLIC_DISCUSSION_READ_HARD_TIMEOUT_MS = "1";
    const { getDiscussionReadStrategyConfig } = await import("../discussion-config");
    const config = getDiscussionReadStrategyConfig();

    expect(config.relayLimit).toBe(3);
    expect(config.idleTimeoutMs).toBe(5000);
    expect(config.hardTimeoutMs).toBeGreaterThan(config.idleTimeoutMs);
  });

  it("calculates read strategy without decoding an invalid bus stop naddr", async () => {
    process.env.NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID = "naddr1invalid";
    process.env.NEXT_PUBLIC_DISCUSSION_READ_RELAY_LIMIT = "2";
    process.env.NEXT_PUBLIC_DISCUSSION_READ_IDLE_TIMEOUT_MS = "1500";
    process.env.NEXT_PUBLIC_DISCUSSION_READ_HARD_TIMEOUT_MS = "5000";
    process.env.NEXT_PUBLIC_DISCUSSION_READ_DEDUP_WINDOW_MS = "400";

    const { getDiscussionReadStrategyConfig } = await import("../discussion-config");
    const config = getDiscussionReadStrategyConfig();

    expect(config).toEqual({
      relayLimit: 2,
      idleTimeoutMs: 1500,
      hardTimeoutMs: 5000,
      dedupWindowMs: 400,
    });
  });
});
