import { NostrService } from "@/lib/nostr/nostr-service";
import type { Event } from "nostr-tools";

jest.useFakeTimers();

const mockSubscribeMany = jest.fn();
const mockClose = jest.fn();

jest.mock("nostr-tools", () => {
  return {
    SimplePool: jest.fn().mockImplementation(() => ({
      subscribeMany: mockSubscribeMany,
      publish: jest.fn(),
      close: jest.fn(),
    })),
  };
});

describe("NostrService streaming", () => {
  const baseConfig = {
    relays: [
      { url: "wss://relay.test", read: true, write: true },
      { url: "wss://relay.example", read: true, write: false },
    ],
    defaultTimeout: 5000,
  };

  beforeEach(() => {
    mockSubscribeMany.mockReset();
    mockClose.mockReset();
  });

  it("collects and sorts events after EOSE", async () => {
    const events: Event[] = [
      { id: "a", kind: 1, pubkey: "p1", created_at: 1, tags: [], content: "", sig: "", },
      { id: "b", kind: 1, pubkey: "p1", created_at: 3, tags: [], content: "", sig: "", },
      { id: "a", kind: 1, pubkey: "p1", created_at: 2, tags: [], content: "", sig: "", },
    ];

    mockSubscribeMany.mockImplementation((relays, filters, handlers) => {
      setTimeout(() => {
        handlers.onevent?.(events[0]);
        handlers.onevent?.(events[1]);
        handlers.onevent?.(events[2]);
        handlers.oneose?.();
      }, 0);
      return { close: mockClose } as any;
    });

    const service = new NostrService(baseConfig as any);
    const resultPromise = service.getOnEose([{ kinds: [1] }]);

    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.map((e) => e.id)).toEqual(["b", "a"]);
    expect(result[0].created_at).toBe(3);
    expect(result[1].created_at).toBe(2);
  });

  it("streams unique events and cleans up on timeout", async () => {
    const streamedEvents: Event[] = [
      { id: "1", kind: 1, pubkey: "p1", created_at: 2, tags: [], content: "", sig: "", },
      { id: "2", kind: 1, pubkey: "p1", created_at: 4, tags: [], content: "", sig: "", },
      { id: "1", kind: 1, pubkey: "p1", created_at: 3, tags: [], content: "", sig: "", },
    ];

    mockSubscribeMany.mockImplementation((relays, filters, handlers) => {
      setTimeout(() => {
        handlers.onevent?.(streamedEvents[0]);
        handlers.onevent?.(streamedEvents[1]);
        handlers.onevent?.(streamedEvents[2]);
      }, 0);
      return { close: mockClose } as any;
    });

    const service = new NostrService({ ...baseConfig, defaultTimeout: 1000 } as any);
    const onEvent = jest.fn();

    const unsubscribePromise = service.getOnEvent(
      [{ kinds: [1] }],
      onEvent
    );

    await jest.runAllTimersAsync();

    const unsubscribe = await unsubscribePromise;
    unsubscribe();

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenLastCalledWith([
      streamedEvents[1],
      streamedEvents[2],
    ]);
    expect(mockClose).toHaveBeenCalled();
  });
});
