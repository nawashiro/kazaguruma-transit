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
});
