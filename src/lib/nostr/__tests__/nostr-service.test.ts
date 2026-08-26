import {
  NostrService,
  NostrServiceConfig,
  createNostrService,
} from "../nostr-service";
import { naddrEncode } from "../naddr-utils";
import { createDiscussionListingRequest } from "@/lib/discussion/user-creation-flow";
import fs from "fs";
import path from "path";

const mockFetchEvents = jest.fn();
const mockSubscribe = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn();

const createNdkEvent = (raw: Record<string, unknown>, relayUrl?: string) => ({
  rawEvent: () => raw,
  ...(relayUrl ? { relay: { url: relayUrl } } : {}),
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
    NDKRelaySet: { fromRelayUrls: jest.fn((urls: string[]) => ({ urls })) },
    nip19: {
      naddrEncode: encodeNaddr,
      decode: decodeNaddr,
    },
  };
});

const { NDKRelaySet: mockNDKRelaySet } = jest.requireMock("@nostr-dev-kit/ndk") as {
  NDKRelaySet: { fromRelayUrls: jest.Mock };
};

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
  const metadataFilter = {
    kinds: [34550],
    authors: [discussionPointer.pubkey],
    "#d": [discussionPointer.identifier],
  };
  const metadataEvent = {
    id: "1".repeat(64),
    created_at: 1756166400,
    kind: 34550,
    pubkey: discussionPointer.pubkey,
    content: "",
    tags: [
      ["d", discussionPointer.identifier],
      ["name", "Issue 101 discussion"],
      ["description", "Metadata returned by a responsive relay"],
    ],
    sig: "2".repeat(128),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchEvents.mockReset();
    mockSubscribe.mockReset();
    mockConnect.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset();
    mockNDKRelaySet.fromRelayUrls.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts a read subscription while connection is pending", async () => {
    let resolveConnect: (() => void) | undefined;
    mockConnect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const service = new NostrService(config);
    const resultPromise = service.getEventsWithCompletion(
      [{ kinds: [1] }],
      { idleTimeoutMs: 1000, hardTimeoutMs: 2000 },
    );

    await flushMicrotasks();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    const handlers = mockSubscribe.mock.calls[0]?.[1] as {
      onEose?: () => void;
    };
    resolveConnect?.();
    handlers.onEose?.();
    await resultPromise;
  });

  it("starts the completion-aware metadata read before all relays connect and keeps the responsive relay event", async () => {
    const relayUrls = [
      "wss://slow.example",
      "wss://responsive.example",
      "wss://unavailable.example",
    ];
    const responsiveRelayUrl = relayUrls[1];
    let resolveConnect: (() => void) | undefined;
    let handlers: {
      onEvent?: (event: unknown) => void;
      onEose?: () => void;
    } = {};

    mockConnect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    mockSubscribe.mockImplementation((_filters, options) => {
      handlers = options;
      return { stop: mockStop };
    });

    const service = new NostrService({
      relays: relayUrls.map((url) => ({ url, read: true, write: false })),
      defaultTimeout: 2000,
    });
    const resultPromise = service.getEventsWithCompletion(
      [metadataFilter],
      {
        relayUrls,
        idleTimeoutMs: 1000,
        hardTimeoutMs: 2000,
      },
    );

    await flushMicrotasks();

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockNDKRelaySet.fromRelayUrls).toHaveBeenCalledWith(
      relayUrls,
      expect.anything(),
    );
    expect(mockSubscribe).toHaveBeenCalledWith(
      [metadataFilter],
      expect.objectContaining({
        closeOnEose: true,
        relaySet: { urls: relayUrls },
      }),
    );

    resolveConnect?.();
    await flushMicrotasks();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    handlers.onEvent?.(createNdkEvent(metadataEvent, responsiveRelayUrl));
    handlers.onEose?.();

    const result = await resultPromise;
    expect(result.events).toEqual([metadataEvent]);
    expect(result.eventCount).toBe(1);
    expect(result.relayUrls).toEqual(relayUrls);
    expect(result.sourceRelayUrlsByEventId).toEqual({
      [metadataEvent.id]: [responsiveRelayUrl],
    });
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

    expect(mockSubscribe).toHaveBeenCalledWith(
      [{ kinds: [1] }, { authors: ["pk1"] }],
      expect.any(Object)
    );
    handlersList[0]?.onEvent?.(createNdkEvent(olderEvent));
    handlersList[0]?.onEvent?.(createNdkEvent(newerEvent));
    handlersList[0]?.onEvent?.(createNdkEvent(olderEvent));
    handlersList[0]?.onEose?.();

    const result = await resultPromise;
    expect(result.map((event) => event.id)).toEqual([
      newerEvent.id,
      olderEvent.id,
    ]);
  });

  it("getEventsWithCompletion keeps only the newest address version from subscribe", async () => {
    let handlers: {
      onEvent?: (event: unknown) => void;
      onEose?: () => void;
    } = {};
    mockSubscribe.mockImplementation((_filter, options) => {
      handlers = options;
      return { stop: mockStop };
    });

    const olderEvent = {
      id: "f".repeat(64),
      created_at: 100,
      kind: 34550,
      pubkey: "a".repeat(64),
      content: "older",
      tags: [["d", "community"]],
      sig: "sig",
    };
    const newerEvent = {
      ...olderEvent,
      id: "0".repeat(64),
      created_at: 200,
      content: "newer",
    };
    const service = new NostrService(config);

    const resultPromise = service.getEventsWithCompletion([{ kinds: [34550] }]);
    await flushMicrotasks();
    handlers.onEvent?.(createNdkEvent(olderEvent, "wss://old"));
    handlers.onEvent?.(createNdkEvent(newerEvent, "wss://new"));
    handlers.onEose?.();

    const result = await resultPromise;

    expect(result.events).toEqual([newerEvent]);
    expect(result.eventCount).toBe(1);
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

  it("getEventsWithCompletion enforces a completion timeout while connection is pending", async () => {
    mockConnect.mockImplementation(() => new Promise<void>(() => undefined));
    mockSubscribe.mockReturnValue({ stop: mockStop });
    const service = new NostrService(config);
    let completionReason: string | undefined;

    void service
      .getEventsWithCompletion([{ kinds: [34550] }], {
        idleTimeoutMs: 100,
        hardTimeoutMs: 300,
      })
      .then((result) => {
        completionReason = result.completionReason;
      });

    await jest.advanceTimersByTimeAsync(101);

    expect(completionReason).toBe("idle-timeout");
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("limits a selected read with NDKRelaySet and preserves duplicate source relays", async () => {
    let handlers: { onEvent?: (event: unknown) => void; onEose?: () => void } = {};
    mockSubscribe.mockImplementation((_filter, options) => {
      handlers = options;
      return { stop: mockStop };
    });
    const service = new NostrService(config);
    const resultPromise = service.getEventsWithCompletion([{ kinds: [1] }], {
      relayUrls: ["wss://first", "wss://second"],
    });
    await flushMicrotasks();

    const event = { id: "shared", created_at: 100, kind: 1, pubkey: "pk", content: "", tags: [], sig: "sig" };
    handlers.onEvent?.(createNdkEvent(event, "wss://second"));
    handlers.onEvent?.(createNdkEvent(event, "wss://first"));
    handlers.onEose?.();
    const result = await resultPromise;

    expect(mockNDKRelaySet.fromRelayUrls).toHaveBeenCalledWith(
      ["wss://first", "wss://second"],
      expect.anything()
    );
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(
      [{ kinds: [1] }],
      expect.objectContaining({
        relaySet: { urls: ["wss://first", "wss://second"] },
      })
    );
    expect(result.events).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.sourceRelayUrlsByEventId).toEqual({
      shared: ["wss://first", "wss://second"],
    });
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

  it("waits for connection before starting streamEventsOnEvent subscriptions", async () => {
    let resolveConnect: (() => void) | undefined;
    mockConnect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const service = new NostrService(config);
    mockSubscribe.mockReturnValue({ stop: mockStop });
    const cleanup = service.streamEventsOnEvent(
      [{ kinds: [1] }],
      { onEvent: jest.fn() },
    );

    await flushMicrotasks();
    expect(mockSubscribe).not.toHaveBeenCalled();
    resolveConnect?.();
    await flushMicrotasks();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("waits for connection before starting subscribeToEvents subscriptions", async () => {
    let resolveConnect: (() => void) | undefined;
    mockConnect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const service = new NostrService(config);
    mockSubscribe.mockReturnValue({ stop: mockStop });
    const cleanupPromise = service.subscribeToEvents(
      [{ kinds: [1] }],
      jest.fn(),
    );

    await flushMicrotasks();
    expect(mockSubscribe).not.toHaveBeenCalled();
    resolveConnect?.();
    const cleanup = await cleanupPromise;
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("streamEventsOnEvent emits on each arrival and stops on EOSE", async () => {
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
    await flushMicrotasks();

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

  it("streamEventsOnEvent enforces timeout cleanup", async () => {
    mockSubscribe.mockReturnValue({ stop: mockStop });

    const service = new NostrService(config);
    const onEose = jest.fn();

    service.streamEventsOnEvent([{ kinds: [1] }], {
      onEvent: jest.fn(),
      onEose,
      timeoutMs: 100,
    });
    await flushMicrotasks();

    jest.advanceTimersByTime(150);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onEose).toHaveBeenCalledTimes(1);
  });

  it("streamEventsOnEvent survives synchronous EOSE", async () => {
    mockSubscribe.mockImplementation((_filter, opts) => {
      opts.onEose?.();
      return { stop: mockStop };
    });

    const service = new NostrService(config);
    const onEose = jest.fn();

    service.streamEventsOnEvent([{ kinds: [1] }], {
      onEvent: jest.fn(),
      onEose,
    });
    await flushMicrotasks();

    expect(onEose).toHaveBeenCalledWith([]);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("getApprovalsOnEose normalizes naddr before querying", async () => {
    let receivedFilter: Record<string, unknown> | null = null;
    mockSubscribe.mockImplementation((filters, opts) => {
      receivedFilter = (Array.isArray(filters) ? filters[0] : filters) as Record<string, unknown>;
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

  it("createNostrService reuses singleton for equivalent configs", () => {
    const serviceA = createNostrService(config);
    const serviceB = createNostrService({
      relays: [{ url: "wss://example", read: true, write: false }],
      defaultTimeout: 2000,
    });

    expect(serviceA).toBe(serviceB);
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
