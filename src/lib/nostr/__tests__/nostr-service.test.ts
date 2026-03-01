import { NostrService, NostrServiceConfig } from "../nostr-service";
import { naddrEncode } from "../naddr-utils";
import { createDiscussionListingRequest } from "@/lib/discussion/user-creation-flow";
import fs from "fs";
import path from "path";

const mockFetchEvents = jest.fn();
const mockSubscribe = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn();

const createNdkEvent = (raw: Record<string, unknown>) => ({
  rawEvent: () => raw,
});

jest.mock("@nostr-dev-kit/ndk", () => {
  const encodeNaddr = ({
    kind,
    pubkey,
    identifier,
  }: {
    kind: number;
    pubkey: string;
    identifier: string;
  }) => `naddr1${kind}:${pubkey}:${identifier}`;

  const decodeNaddr = (value: string) => {
    const payload = value.slice("naddr1".length);
    const [kind, pubkey, identifier] = payload.split(":");
    return {
      type: "naddr",
      data: {
        kind: Number(kind),
        pubkey,
        identifier,
        relays: [],
      },
    };
  };

  class MockNDK {
    pool: { relays: Map<string, { disconnect: jest.Mock }> };

    constructor() {
      this.pool = {
        relays: new Map([["wss://example", { disconnect: jest.fn() }]]),
      };
    }

    connect = mockConnect;

    fetchEvents = mockFetchEvents;

    subscribe = mockSubscribe;
  }

  class MockNDKEvent {
    constructor(private _ndk: unknown, private event: Record<string, unknown>) {}

    rawEvent() {
      return this.event;
    }

    async publish() {
      return new Set(["wss://example"]);
    }

    async sign() {
      return "signature";
    }
  }

  class MockNDKPrivateKeySigner {
    pubkey = "f".repeat(64);
    constructor(private _key: string) {}
  }

  return {
    __esModule: true,
    default: MockNDK,
    NDKEvent: MockNDKEvent,
    NDKPrivateKeySigner: MockNDKPrivateKeySigner,
    nip19: {
      naddrEncode: encodeNaddr,
      decode: decodeNaddr,
    },
  };
});

describe("NostrService event retrieval", () => {
  const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  const config: NostrServiceConfig = {
    relays: [{ url: "wss://example", read: true, write: false }],
    defaultTimeout: 2000,
  };
  const discussionPointer = {
    kind: 34550,
    pubkey:
      "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8",
    identifier: "-989250",
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchEvents.mockReset();
    mockSubscribe.mockReset();
    mockConnect.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("getEventsOnEose deduplicates and sorts events by created_at desc", async () => {
    const handlersList: Array<{
      onEvent?: (event: unknown) => void;
      onEose?: () => void;
    }> = [];
    mockSubscribe.mockImplementation((_filter, opts) => {
      handlersList.push(opts);
      return { stop: mockStop };
    });

    const olderEvent = {
      id: "1",
      created_at: 100,
      kind: 1,
      pubkey: "pk1",
      content: "old",
      tags: [],
      sig: "sig",
    };

    const newerEvent = {
      ...olderEvent,
      id: "2",
      created_at: 200,
      content: "new",
    };

    const service = new NostrService(config);
    const resultPromise = service.getEventsOnEose([
      { kinds: [1] },
      { authors: ["pk1"] },
    ]);
    await flushMicrotasks();

    handlersList[0]?.onEvent?.(createNdkEvent(olderEvent));
    handlersList[0]?.onEvent?.(createNdkEvent(newerEvent));
    handlersList[1]?.onEvent?.(createNdkEvent(olderEvent));
    handlersList[0]?.onEose?.();
    handlersList[1]?.onEose?.();

    const result = await resultPromise;
    expect(result.map((event) => event.id)).toEqual([
      newerEvent.id,
      olderEvent.id,
    ]);
  });

  it("getEventsWithCompletion returns idle-timeout when no events arrive", async () => {
    mockSubscribe.mockReturnValue({ stop: mockStop });
    const service = new NostrService(config);

    const resultPromise = service.getEventsWithCompletion(
      [{ kinds: [1] }],
      { idleTimeoutMs: 100, hardTimeoutMs: 500 }
    );
    await flushMicrotasks();
    await jest.advanceTimersByTimeAsync(120);
    const result = await resultPromise;

    expect(result.completionReason).toBe("idle-timeout");
    expect(result.eventCount).toBe(0);
  });

  it("getEventsWithCompletion returns hard-timeout when events keep arriving without EOSE", async () => {
    let handlers: { onEvent?: (event: unknown) => void; onEose?: () => void } = {};
    mockSubscribe.mockImplementation((_filter, opts) => {
      handlers = opts;
      return { stop: mockStop };
    });
    const service = new NostrService(config);

    const resultPromise = service.getEventsWithCompletion(
      [{ kinds: [1] }],
      { idleTimeoutMs: 100, hardTimeoutMs: 320 }
    );
    await flushMicrotasks();

    const baseEvent = {
      id: "evt",
      created_at: 10,
      kind: 1,
      pubkey: "pk",
      content: "",
      tags: [],
      sig: "sig",
    };
    await jest.advanceTimersByTimeAsync(90);
    handlers.onEvent?.(createNdkEvent({ ...baseEvent, id: "evt-1" }));
    await jest.advanceTimersByTimeAsync(90);
    handlers.onEvent?.(createNdkEvent({ ...baseEvent, id: "evt-2" }));
    await jest.advanceTimersByTimeAsync(90);
    handlers.onEvent?.(createNdkEvent({ ...baseEvent, id: "evt-3" }));
    await jest.advanceTimersByTimeAsync(60);

    const result = await resultPromise;
    expect(result.completionReason).toBe("hard-timeout");
    expect(result.eventCount).toBe(3);
  });

  it("streamEventsOnEvent emits on each arrival and stops on EOSE", () => {
    let handlers: { onEvent?: (event: unknown) => void; onEose?: () => void } = {};

    mockSubscribe.mockImplementation((_filter, opts) => {
      handlers = opts;
      return { stop: mockStop };
    });

    const service = new NostrService(config);
    const onEvent = jest.fn();
    const onEose = jest.fn();

    service.streamEventsOnEvent([{ kinds: [1] }], {
      onEvent,
      onEose,
      timeoutMs: 5000,
    });

    const firstEvent = {
      id: "a",
      created_at: 10,
      kind: 1,
      pubkey: "pk",
      content: "",
      tags: [],
      sig: "sig",
    };
    const secondEvent = {
      ...firstEvent,
      id: "b",
      created_at: 20,
    };

    handlers.onEvent?.(createNdkEvent(firstEvent));
    handlers.onEvent?.(createNdkEvent(firstEvent)); // duplicate should be ignored
    handlers.onEvent?.(createNdkEvent(secondEvent));

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith(
      [secondEvent, firstEvent],
      secondEvent
    );

    handlers.onEose?.();

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onEose).toHaveBeenCalledWith([secondEvent, firstEvent]);
  });

  it("streamEventsOnEvent enforces timeout cleanup", () => {
    mockSubscribe.mockReturnValue({ stop: mockStop });

    const service = new NostrService(config);
    const onEose = jest.fn();

    service.streamEventsOnEvent([{ kinds: [1] }], {
      onEvent: jest.fn(),
      onEose,
      timeoutMs: 100,
    });

    jest.advanceTimersByTime(150);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onEose).toHaveBeenCalledTimes(1);
  });

  it("streamEventsOnEvent survives synchronous EOSE", () => {
    mockSubscribe.mockImplementation((_filter, opts) => {
      opts.onEose?.();
      return { stop: mockStop };
    });

    const service = new NostrService(config);
    const onEose = jest.fn();

    expect(() =>
      service.streamEventsOnEvent([{ kinds: [1] }], {
        onEvent: jest.fn(),
        onEose,
      })
    ).not.toThrow();

    expect(onEose).toHaveBeenCalledWith([]);
  });

  it("getApprovalsOnEose normalizes naddr before querying", async () => {
    let receivedFilter: Record<string, unknown> | null = null;
    mockSubscribe.mockImplementation((filter, opts) => {
      receivedFilter = filter as Record<string, unknown>;
      opts.onEose?.();
      return { stop: mockStop };
    });
    const service = new NostrService(config);
    const discussionNaddr = naddrEncode(discussionPointer);

    await service.getApprovalsOnEose(discussionNaddr);

    expect(receivedFilter?.["#a"]).toEqual([
      `34550:${discussionPointer.pubkey}:${discussionPointer.identifier}`,
    ]);
  });

  it("getApprovalsOnEose rejects invalid discussion id without querying", async () => {
    const service = new NostrService(config);
    const invalidDiscussionId = `34550:${discussionPointer.pubkey}:naddr1invalid`;

    const result = await service.getApprovalsOnEose(invalidDiscussionId);

    expect(result).toEqual([]);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("streamApprovals delegates to streaming with expected filters", () => {
    const service = new NostrService(config);
    const spy = jest
      .spyOn(service, "streamEventsOnEvent")
      .mockReturnValue(() => {});
    const discussionNaddr = naddrEncode(discussionPointer);

    const onEvent = jest.fn();
    service.streamApprovals(discussionNaddr, { onEvent });

    expect(spy).toHaveBeenCalledWith(
      [
        {
          kinds: [4550],
          "#a": [
            `34550:${discussionPointer.pubkey}:${discussionPointer.identifier}`,
          ],
        },
      ],
      expect.objectContaining({ onEvent })
    );
  });

  it("streamApprovalsForPosts resolves immediately when no posts", () => {
    const service = new NostrService(config);
    const onEvent = jest.fn();
    const onEose = jest.fn();
    const discussionId = `34550:${discussionPointer.pubkey}:${discussionPointer.identifier}`;

    const cleanup = service.streamApprovalsForPosts(
      [],
      discussionId,
      {
        onEvent,
        onEose,
      }
    );

    expect(onEvent).not.toHaveBeenCalled();
    expect(onEose).toHaveBeenCalledWith([]);
    expect(typeof cleanup).toBe("function");
  });
});

describe("Foundation regression checks", () => {
  it("does not import legacy sdk in foundational targets", () => {
    const projectRoot = process.cwd();
    const targets = [
      "src/lib/auth/auth-context.tsx",
      "src/lib/discussion/user-creation-flow.ts",
      "src/types/discussion.ts",
    ];

    for (const target of targets) {
      const absolutePath = path.join(projectRoot, target);
      const content = fs.readFileSync(absolutePath, "utf-8");
      const legacySdkPattern = new RegExp(["nostr", "tools"].join("-"));
      expect(content).not.toMatch(legacySdkPattern);
    }
  });
});

describe("US2 listing request contract", () => {
  it("creates listing request event as kind:1111 with a/q tags", () => {
    const adminPubkey = "a".repeat(64);
    const userPubkey = "b".repeat(64);
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = naddrEncode({
      kind: 34550,
      pubkey: adminPubkey,
      identifier: "discussion-list",
    });
    const discussionNaddr = naddrEncode({
      kind: 34550,
      pubkey: userPubkey,
      identifier: "created-discussion",
    });

    const event = createDiscussionListingRequest(
      {
        title: "title",
        description: "description",
        moderators: [],
        dTag: "created-discussion",
      },
      discussionNaddr,
      adminPubkey,
      userPubkey
    );

    expect(event.kind).toBe(1111);
    expect(event.tags).toEqual(
      expect.arrayContaining([
        ["a", `34550:${adminPubkey}:discussion-list`],
        ["q", `34550:${userPubkey}:created-discussion`],
      ])
    );
  });
});
