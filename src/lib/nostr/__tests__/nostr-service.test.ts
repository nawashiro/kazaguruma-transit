import { NostrService, NostrServiceConfig } from "../nostr-service";

// Mocks for nostr-tools
const mockQuerySync = jest.fn();
const mockSubscribeMany = jest.fn();
const mockClose = jest.fn();

jest.mock("nostr-tools", () => ({
  SimplePool: jest.fn().mockImplementation(() => ({
    querySync: mockQuerySync,
    subscribeMany: mockSubscribeMany,
    publish: jest.fn(),
    close: jest.fn(),
  })),
  finalizeEvent: jest.fn(),
}));

describe("NostrService event retrieval", () => {
  const config: NostrServiceConfig = {
    relays: [{ url: "wss://example", read: true, write: false }],
    defaultTimeout: 2000,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockQuerySync.mockReset();
    mockSubscribeMany.mockReset();
    mockClose.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("getEventsOnEose deduplicates and sorts events by created_at desc", async () => {
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

    // Duplicate of olderEvent should be removed
    mockQuerySync
      .mockResolvedValueOnce([olderEvent, newerEvent])
      .mockResolvedValueOnce([olderEvent]);

    const service = new NostrService(config);
    const result = await service.getEventsOnEose([
      { kinds: [1] },
      { authors: ["pk1"] },
    ]);

    expect(mockQuerySync).toHaveBeenCalledTimes(2);
    expect(result.map((event) => event.id)).toEqual([
      newerEvent.id,
      olderEvent.id,
    ]);
  });

  it("streamEventsOnEvent emits on each arrival and stops on EOSE", () => {
    let callbacks: { onevent?: (event: any) => void; oneose?: () => void } = {};

    mockSubscribeMany.mockImplementation((_, __, handlers) => {
      callbacks = handlers;
      return { close: mockClose };
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

    callbacks.onevent?.(firstEvent);
    callbacks.onevent?.(firstEvent); // duplicate should be ignored
    callbacks.onevent?.(secondEvent);

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith(
      [secondEvent, firstEvent],
      secondEvent
    );

    callbacks.oneose?.();

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(onEose).toHaveBeenCalledWith([secondEvent, firstEvent]);
  });

  it("streamEventsOnEvent enforces timeout cleanup", () => {
    mockSubscribeMany.mockReturnValue({ close: mockClose });

    const service = new NostrService(config);
    const onEose = jest.fn();

    service.streamEventsOnEvent([{ kinds: [1] }], {
      onEvent: jest.fn(),
      onEose,
      timeoutMs: 100,
    });

    jest.advanceTimersByTime(150);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(onEose).toHaveBeenCalledTimes(1);
  });

  it("streamApprovals delegates to streaming with expected filters", () => {
    const service = new NostrService(config);
    const spy = jest
      .spyOn(service, "streamEventsOnEvent")
      .mockReturnValue(() => {});

    const onEvent = jest.fn();
    service.streamApprovals("discussion-1", { onEvent });

    expect(spy).toHaveBeenCalledWith(
      [
        {
          kinds: [4550],
          "#a": ["discussion-1"],
        },
      ],
      expect.objectContaining({ onEvent })
    );
  });

  it("streamApprovalsForPosts resolves immediately when no posts", () => {
    const service = new NostrService(config);
    const onEvent = jest.fn();
    const onEose = jest.fn();

    const cleanup = service.streamApprovalsForPosts(
      [],
      "discussion-1",
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
