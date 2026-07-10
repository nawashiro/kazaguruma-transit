import { naddrEncode } from "@/lib/nostr/naddr-utils";

describe("getDiscussionConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("decodes bus stop discussion naddr to hex discussion id", async () => {
    const discussionPointer = {
      kind: 34550,
      pubkey: "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8",
      identifier: "-989250",
    };
    const busStopNaddr = naddrEncode(discussionPointer);

    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_DISCUSSIONS_ENABLED: "true",
      NEXT_PUBLIC_ADMIN_PUBKEY: discussionPointer.pubkey,
      NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID: busStopNaddr,
      NEXT_PUBLIC_NOSTR_RELAYS: "wss://relay.example",
    };

    const { getDiscussionConfig } = await import("../discussion-config");
    const config = getDiscussionConfig();

    expect(config.busStopDiscussionId).toBe(
      `34550:${discussionPointer.pubkey}:${discussionPointer.identifier}`
    );
  });

  it("rejects invalid discussion id formats", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_DISCUSSIONS_ENABLED: "true",
      NEXT_PUBLIC_ADMIN_PUBKEY:
        "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8",
      NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID:
        "34550:c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8:naddr1invalid",
      NEXT_PUBLIC_NOSTR_RELAYS: "wss://relay.example",
    };

    const { getDiscussionConfig } = await import("../discussion-config");

    expect(() => getDiscussionConfig()).toThrow(
      "Invalid discussion id format"
    );
  });
});

describe("getDiscussionReadStrategyConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

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
});
