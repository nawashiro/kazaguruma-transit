import {
  executeNostrRead,
  type NostrReadTransport,
} from "@/lib/nostr/nostr-read-executor";
import type { DiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import type {
  NdkQueryCompletion,
  NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";

const plan: DiscussionReadPlan = {
  target: "discussion-list",
  filters: [{ kinds: [34550], limit: 50 }],
  idleTimeoutMs: 100,
  hardTimeoutMs: 300,
};

const providerRelayUrls = [
  "wss://provider-one.example",
  "wss://provider-two.example",
  "wss://provider-three.example",
  "wss://provider-four.example",
  "wss://provider-five.example",
  "wss://provider-six.example",
];

const event = (id: string): NostrEventDTO => ({
  id,
  kind: 34550,
  content: "",
  tags: [],
  created_at: 1,
  pubkey: "a".repeat(64),
  sig: "signature",
});

const completion = (
  events: NostrEventDTO[],
  completionReason: NdkQueryCompletion["completionReason"],
  sourceRelayUrlsByEventId: Record<string, string[]>,
  duplicateCount = 0,
  elapsedMs = 10,
): NdkQueryCompletion => ({
  events,
  completionReason,
  eventCount: events.length,
  elapsedMs,
  startedAt: 1,
  lastEventAt: 2,
  eoseReceived: completionReason === "eose",
  relayUrls: [],
  duplicateCount,
  sourceRelayUrlsByEventId,
});

describe("executeNostrRead", () => {
  it("retries once with the next three relays after a non-EOSE first attempt and merges results", async () => {
    const firstEvent = event("first");
    const retryEvent = event("retry");
    const transport: jest.MockedFunction<NostrReadTransport> = jest
      .fn<ReturnType<NostrReadTransport>, Parameters<NostrReadTransport>>()
      .mockResolvedValueOnce(completion([firstEvent], "idle-timeout", { first: ["wss://provider-one.example"] }, 2, 11))
      .mockResolvedValueOnce(completion([firstEvent, retryEvent], "eose", {
        first: ["wss://provider-four.example"],
        retry: ["wss://provider-six.example"],
      }, 3, 13));
    const onAttemptComplete = jest.fn();

    const result = await executeNostrRead(transport, {
      plan,
      relayUrls: providerRelayUrls,
      onAttemptComplete,
    });

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenNthCalledWith(1, plan.filters, {
      relayUrls: providerRelayUrls.slice(0, 3),
      idleTimeoutMs: 100,
      hardTimeoutMs: 300,
    });
    expect(transport).toHaveBeenNthCalledWith(2, plan.filters, {
      relayUrls: providerRelayUrls.slice(3, 6),
      idleTimeoutMs: 100,
      hardTimeoutMs: 300,
    });
    expect(onAttemptComplete).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      events: [firstEvent, retryEvent],
      completionReason: "eose",
      duplicateCount: 5,
      elapsedMs: 24,
      attemptedRelayUrls: providerRelayUrls,
      successfulEventRelayUrls: [
        "wss://provider-one.example",
        "wss://provider-four.example",
        "wss://provider-six.example",
      ],
      sourceRelayUrlsByEventId: {
        first: ["wss://provider-one.example", "wss://provider-four.example"],
        retry: ["wss://provider-six.example"],
      },
    });
    expect(result.attempts).toHaveLength(2);
  });

  it("passes an empty provider relay list as one attempt", async () => {
    const transport: jest.MockedFunction<NostrReadTransport> = jest
      .fn<ReturnType<NostrReadTransport>, Parameters<NostrReadTransport>>()
      .mockResolvedValue(completion([], "eose", {}));

    const result = await executeNostrRead(transport, {
      plan,
      relayUrls: [],
    });

    expect(transport).toHaveBeenCalledWith(plan.filters, {
      relayUrls: [], idleTimeoutMs: 100, hardTimeoutMs: 300,
    });
    expect(result.completionReason).toBe("eose");
  });

  it("does not retry after an EOSE first attempt", async () => {
    const transport: jest.MockedFunction<NostrReadTransport> = jest
      .fn<ReturnType<NostrReadTransport>, Parameters<NostrReadTransport>>()
      .mockResolvedValue(completion([], "eose", {}));

    const result = await executeNostrRead(transport, {
      plan,
      relayUrls: providerRelayUrls.slice(0, 3),
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.completionReason).toBe("eose");
    expect(result.attemptedRelayUrls).toEqual(providerRelayUrls.slice(0, 3));
  });

  it("retains first-attempt partial events when the one retry rejects", async () => {
    const firstEvent = event("first");
    const transport: jest.MockedFunction<NostrReadTransport> = jest
      .fn<ReturnType<NostrReadTransport>, Parameters<NostrReadTransport>>()
      .mockResolvedValueOnce(completion([firstEvent], "idle-timeout", { first: ["wss://provider-one.example"] }))
      .mockRejectedValueOnce(new Error("retry relay failed"));

    const result = await executeNostrRead(transport, {
      plan,
      relayUrls: providerRelayUrls.slice(0, 4),
    });

    expect(transport).toHaveBeenCalledTimes(2);
    expect(result.events).toEqual([firstEvent]);
    expect(result.completionReason).toBe("idle-timeout");
    expect(result.attemptedRelayUrls).toEqual([
      ...providerRelayUrls.slice(0, 4),
    ]);
  });

  it("keeps only the newer addressable discussion event across a retry boundary", async () => {
    const pubkey = "b".repeat(64);
    const olderEvent: NostrEventDTO = {
      ...event("older-discussion"),
      pubkey,
      created_at: 100,
      content: "older",
      tags: [["d", "community"]],
    };
    const newerEvent: NostrEventDTO = {
      ...olderEvent,
      id: "newer-discussion",
      created_at: 200,
      content: "newer",
    };
    const transport: jest.MockedFunction<NostrReadTransport> = jest
      .fn<ReturnType<NostrReadTransport>, Parameters<NostrReadTransport>>()
      .mockResolvedValueOnce(completion([olderEvent], "idle-timeout", {
        [olderEvent.id]: ["wss://old.example"],
      }))
      .mockResolvedValueOnce(completion([newerEvent], "eose", {
        [newerEvent.id]: ["wss://new.example"],
      }));

    const result = await executeNostrRead(transport, {
      plan,
      relayUrls: providerRelayUrls.slice(0, 4),
    });

    expect(result.completionReason).toBe("eose");
    expect(result.events).toEqual([newerEvent]);
    expect(result.events).toHaveLength(1);
    expect(result.sourceRelayUrlsByEventId[newerEvent.id]).toEqual(["wss://new.example"]);
    expect(result.successfulEventRelayUrls).toContain("wss://new.example");
  });
});
