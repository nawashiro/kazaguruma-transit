import {
  dedupeAndSortEvents,
  type Event,
} from "../nostr-service";

const addressPubkey = "a".repeat(64);
const anotherAddressPubkey = "b".repeat(64);

const createEvent = (overrides: Partial<Event> = {}): Event => ({
  id: "1".repeat(64),
  pubkey: addressPubkey,
  created_at: 100,
  kind: 1,
  tags: [],
  content: "content",
  sig: "signature",
  ...overrides,
});

describe("NIP-01/NIP-72 event identity integration", () => {
  it("keeps only the newest kind:34550 event for the same address", () => {
    const olderEvent = createEvent({
      id: "f".repeat(64),
      kind: 34550,
      created_at: 100,
      tags: [["d", "community"]],
      content: "older",
    });
    const newerEvent = createEvent({
      id: "0".repeat(64),
      kind: 34550,
      created_at: 200,
      tags: [["d", "community"]],
      content: "newer",
    });

    expect(dedupeAndSortEvents([olderEvent, newerEvent])).toEqual([newerEvent]);
  });

  it("keeps same-kind addressable events with different d-tags distinct", () => {
    const firstEvent = createEvent({
      id: "9".repeat(64),
      kind: 34550,
      pubkey: addressPubkey,
      created_at: 100,
      tags: [["d", "community-a"]],
    });
    const secondEvent = createEvent({
      id: "8".repeat(64),
      kind: 34550,
      pubkey: addressPubkey,
      created_at: 200,
      tags: [["d", "community-b"]],
    });

    expect(dedupeAndSortEvents([firstEvent, secondEvent])).toEqual([
      secondEvent,
      firstEvent,
    ]);
  });

  it("keeps same-kind addressable events with different pubkeys distinct", () => {
    const firstEvent = createEvent({
      id: "7".repeat(64),
      kind: 34550,
      pubkey: addressPubkey,
      created_at: 100,
      tags: [["d", "shared-community"]],
    });
    const secondEvent = createEvent({
      id: "6".repeat(64),
      kind: 34550,
      pubkey: anotherAddressPubkey,
      created_at: 200,
      tags: [["d", "shared-community"]],
    });

    expect(dedupeAndSortEvents([firstEvent, secondEvent])).toEqual([
      secondEvent,
      firstEvent,
    ]);
  });

  it("keeps the lexicographically smallest event id when address versions share created_at", () => {
    const largerIdEvent = createEvent({
      id: "f".repeat(64),
      kind: 34550,
      created_at: 200,
      tags: [["d", "community"]],
    });
    const smallerIdEvent = createEvent({
      id: "0".repeat(64),
      kind: 34550,
      created_at: 200,
      tags: [["d", "community"]],
    });

    expect(dedupeAndSortEvents([largerIdEvent, smallerIdEvent])).toEqual([
      smallerIdEvent,
    ]);
  });

  it.each([0, 3, 10000, 15000, 19999])(
    "deduplicates kind %i by kind and pubkey",
    (kind) => {
      const olderEvent = createEvent({
        id: "e".repeat(64),
        kind,
        created_at: 100,
        tags: [["d", "older"]],
      });
      const newerEvent = createEvent({
        id: "0".repeat(64),
        kind,
        created_at: 200,
        tags: [["d", "newer"]],
      });

      expect(dedupeAndSortEvents([olderEvent, newerEvent])).toEqual([
        newerEvent,
      ]);
    }
  );

  it("keeps regular events with different ids distinct even when kind and pubkey match", () => {
    const firstEvent = createEvent({
      id: "5".repeat(64),
      kind: 1,
      created_at: 100,
      tags: [["d", "same-tag"]],
    });
    const secondEvent = createEvent({
      id: "6".repeat(64),
      kind: 1,
      created_at: 200,
      tags: [["d", "same-tag"]],
    });

    expect(dedupeAndSortEvents([firstEvent, secondEvent])).toEqual([
      secondEvent,
      firstEvent,
    ]);
  });

  it("falls back to event id for addressable events without a d-tag", () => {
    const malformedOlderEvent = createEvent({
      id: "7".repeat(64),
      kind: 34550,
      created_at: 100,
      tags: [],
    });
    const malformedNewerEvent = createEvent({
      id: "8".repeat(64),
      kind: 34550,
      created_at: 200,
      tags: [],
    });

    expect(
      dedupeAndSortEvents([malformedOlderEvent, malformedNewerEvent])
    ).toEqual([malformedNewerEvent, malformedOlderEvent]);
  });
});
