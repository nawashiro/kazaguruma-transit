const makeEvent = (id: string) => ({
  id,
  kind: 1,
  pubkey: "author",
  created_at: 1,
  content: id,
  tags: [],
  sig: "sig",
});

const completion = (
  events: ReturnType<typeof makeEvent>[],
  completionReason: "eose" | "idle-timeout",
  relayUrl = "wss://relay.example",
) => ({
  events,
  completionReason,
  duplicateCount: 0,
  elapsedMs: 1,
  attemptedRelayUrls: [],
  successfulEventRelayUrls: events.length > 0 ? [relayUrl] : [],
  sourceRelayUrlsByEventId: Object.fromEntries(
    events.map((item) => [item.id, [relayUrl]]),
  ),
  attempts: [],
});

describe("executeNostrRead", () => {
  it("keeps the generic Nostr read contract while retrying a non-EOSE attempt once", async () => {
    const { executeNostrRead } = await import("../nostr-read-executor");
    const transport = jest
      .fn()
      .mockResolvedValueOnce(
        completion([makeEvent("first")], "idle-timeout", "wss://one.example"),
      )
      .mockResolvedValueOnce(
        completion([makeEvent("second")], "eose", "wss://four.example"),
      );

    const result = await executeNostrRead(transport, {
      plan: {
        filters: [{ kinds: [1] }],
        idleTimeoutMs: 100,
        hardTimeoutMs: 300,
      },
      relayUrls: [
        "wss://one.example",
        "wss://two.example",
        "wss://three.example",
        "wss://four.example",
      ],
    });

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenNthCalledWith(
      1,
      [{ kinds: [1] }],
      expect.objectContaining({
        relayUrls: [
          "wss://one.example",
          "wss://two.example",
          "wss://three.example",
        ],
      }),
    );
    expect(transport).toHaveBeenNthCalledWith(
      2,
      [{ kinds: [1] }],
      expect.objectContaining({
        relayUrls: ["wss://four.example"],
      }),
    );
    expect(result.completionReason).toBe("eose");
    expect(result.events.map((item) => item.id)).toEqual(["first", "second"]);
    expect(result.successfulEventRelayUrls).toEqual([
      "wss://one.example",
      "wss://four.example",
    ]);
  });

  it("does not retry an EOSE-completed attempt", async () => {
    const { executeNostrRead } = await import("../nostr-read-executor");
    const transport = jest
      .fn()
      .mockResolvedValue(completion([makeEvent("complete")], "eose", "wss://one.example"));

    const result = await executeNostrRead(transport, {
      plan: {
        filters: [{ kinds: [1] }],
        idleTimeoutMs: 100,
        hardTimeoutMs: 300,
      },
      relayUrls: ["wss://one.example", "wss://two.example"],
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.completionReason).toBe("eose");
  });
});
