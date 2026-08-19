import {
  executeDiscussionRead,
  type DiscussionReadTransport,
} from "@/lib/discussion/discussion-read-executor";
import type { DiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import type {
  NdkQueryCompletion,
  NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";

const plan: DiscussionReadPlan = {
  target: "discussion-list",
  filters: [{ kinds: [34550], limit: 50 }],
  relayHints: ["wss://hint.example"],
  idleTimeoutMs: 100,
  hardTimeoutMs: 300,
};

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
  sourceRelayUrlsByEventId: Record<string, string[]>
): NdkQueryCompletion => ({
  events,
  completionReason,
  eventCount: events.length,
  elapsedMs: 10,
  startedAt: 1,
  lastEventAt: 2,
  eoseReceived: completionReason === "eose",
  relayUrls: [],
  duplicateCount: 0,
  sourceRelayUrlsByEventId,
});

describe("executeDiscussionRead", () => {
  it("retries once with the next three relays after a non-EOSE first attempt and merges results", async () => {
    const firstEvent = event("first");
    const retryEvent = event("retry");
    const transport: jest.MockedFunction<DiscussionReadTransport> = jest
      .fn<ReturnType<DiscussionReadTransport>, Parameters<DiscussionReadTransport>>()
      .mockResolvedValueOnce(completion([firstEvent], "idle-timeout", { first: ["wss://hint.example"] }))
      .mockResolvedValueOnce(completion([firstEvent, retryEvent], "eose", {
        first: ["wss://configured.example"],
        retry: ["wss://default.example"],
      }));
    const onAttemptComplete = jest.fn();

    const result = await executeDiscussionRead(transport, {
      plan,
      candidates: {
        recommended: ["wss://recommended.example"],
        successful: ["wss://successful.example"],
        configured: ["wss://configured.example", "wss://configured-second.example"],
        defaults: ["wss://default.example"],
      },
      onAttemptComplete,
    });

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenNthCalledWith(1, plan.filters, {
      relayUrls: ["wss://hint.example", "wss://recommended.example", "wss://successful.example"],
      idleTimeoutMs: 100,
      hardTimeoutMs: 300,
    });
    expect(transport).toHaveBeenNthCalledWith(2, plan.filters, {
      relayUrls: ["wss://configured.example", "wss://configured-second.example", "wss://default.example"],
      idleTimeoutMs: 100,
      hardTimeoutMs: 300,
    });
    expect(onAttemptComplete).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      events: [firstEvent, retryEvent],
      completionReason: "eose",
      attemptedRelayUrls: [
        "wss://hint.example",
        "wss://recommended.example",
        "wss://successful.example",
        "wss://configured.example",
        "wss://configured-second.example",
        "wss://default.example",
      ],
      successfulEventRelayUrls: [
        "wss://hint.example",
        "wss://configured.example",
        "wss://default.example",
      ],
      sourceRelayUrlsByEventId: {
        first: ["wss://hint.example", "wss://configured.example"],
        retry: ["wss://default.example"],
      },
    });
    expect(result.attempts).toHaveLength(2);
  });

  it("uses the configured default read set when no relay candidate is available", async () => {
    const transport: jest.MockedFunction<DiscussionReadTransport> = jest
      .fn<ReturnType<DiscussionReadTransport>, Parameters<DiscussionReadTransport>>()
      .mockResolvedValue(completion([], "eose", {}));

    const result = await executeDiscussionRead(transport, {
      plan: { ...plan, relayHints: [] },
      candidates: { configured: [], defaults: [] },
    });

    expect(transport).toHaveBeenCalledWith(plan.filters, {
      relayUrls: [], idleTimeoutMs: 100, hardTimeoutMs: 300,
    });
    expect(result.completionReason).toBe("eose");
  });

  it("does not retry after an EOSE first attempt", async () => {
    const transport: jest.MockedFunction<DiscussionReadTransport> = jest
      .fn<ReturnType<DiscussionReadTransport>, Parameters<DiscussionReadTransport>>()
      .mockResolvedValue(completion([], "eose", {}));

    const result = await executeDiscussionRead(transport, {
      plan,
      candidates: {
        configured: ["wss://configured.example"],
        defaults: ["wss://default.example"],
      },
    });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.completionReason).toBe("eose");
    expect(result.attemptedRelayUrls).toEqual(["wss://hint.example", "wss://configured.example", "wss://default.example"]);
  });

  it("retains first-attempt partial events when the one retry rejects", async () => {
    const firstEvent = event("first");
    const transport: jest.MockedFunction<DiscussionReadTransport> = jest
      .fn<ReturnType<DiscussionReadTransport>, Parameters<DiscussionReadTransport>>()
      .mockResolvedValueOnce(completion([firstEvent], "idle-timeout", { first: ["wss://hint.example"] }))
      .mockRejectedValueOnce(new Error("retry relay failed"));

    const result = await executeDiscussionRead(transport, {
      plan,
      candidates: {
        configured: ["wss://configured.example", "wss://configured-second.example", "wss://configured-third.example"],
        defaults: [],
      },
    });

    expect(transport).toHaveBeenCalledTimes(2);
    expect(result.events).toEqual([firstEvent]);
    expect(result.completionReason).toBe("idle-timeout");
    expect(result.attemptedRelayUrls).toEqual([
      "wss://hint.example",
      "wss://configured.example",
      "wss://configured-second.example",
      "wss://configured-third.example",
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
    const transport: jest.MockedFunction<DiscussionReadTransport> = jest
      .fn<ReturnType<DiscussionReadTransport>, Parameters<DiscussionReadTransport>>()
      .mockResolvedValueOnce(completion([olderEvent], "idle-timeout", {
        [olderEvent.id]: ["wss://old.example"],
      }))
      .mockResolvedValueOnce(completion([newerEvent], "eose", {
        [newerEvent.id]: ["wss://new.example"],
      }));

    const result = await executeDiscussionRead(transport, {
      plan,
      candidates: {
        configured: ["wss://configured.example", "wss://configured-second.example"],
        defaults: ["wss://default.example"],
      },
    });

    expect(result.completionReason).toBe("eose");
    expect(result.events).toEqual([newerEvent]);
    expect(result.events).toHaveLength(1);
    expect(result.sourceRelayUrlsByEventId[newerEvent.id]).toEqual(["wss://new.example"]);
    expect(result.successfulEventRelayUrls).toContain("wss://new.example");
  });
});
