import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockExecuteNostrRead = jest.fn();
const authorPubkey = "a".repeat(64);

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: discussionNaddr }),
  usePathname: () => `/discussions/${discussionNaddr}`,
}));

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({
    relays: [{ url: "wss://relay.example", read: true, write: false }],
    defaultTimeout: 100,
  }),
  getDiscussionReadStrategyConfig: () => ({
    idleTimeoutMs: 100,
    hardTimeoutMs: 300,
    dedupWindowMs: 0,
  }),
}));

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({ queryWithCompletion: jest.fn() }),
}));

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: (...args: unknown[]) => mockExecuteNostrRead(...args),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ user: { pubkey: null, isLoggedIn: false } }),
}));

import { DiscussionDetailProvider } from "../DiscussionDetailProvider";
import { DiscussionTabLayout } from "../DiscussionTabLayout";
import {
  extractDiscussionFromNaddr,
  naddrEncode,
} from "@/lib/nostr/naddr-utils";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

const discussionNaddr = naddrEncode({
  identifier: "topic",
  pubkey: authorPubkey,
  kind: 34550,
});

const metadataEvent = (tags: string[][]): NostrEventDTO => ({
  id: "metadata-1",
  kind: 34550,
  pubkey: authorPubkey,
  content: "説明",
  tags,
  created_at: 1,
  sig: "signature",
});

const readResult = (events: NostrEventDTO[] = []) => ({
  events,
  completionReason: "eose" as const,
  duplicateCount: 0,
  elapsedMs: 1,
  attemptedRelayUrls: ["wss://relay.example"],
  successfulEventRelayUrls: events.length > 0 ? ["wss://relay.example"] : [],
  sourceRelayUrlsByEventId: Object.fromEntries(
    events.map((event) => [event.id, ["wss://relay.example"]]),
  ),
  attempts: [],
});

const setupReadFixture = (event: NostrEventDTO): void => {
  mockExecuteNostrRead
    .mockResolvedValueOnce(readResult([event]))
    .mockResolvedValueOnce(readResult())
    .mockResolvedValueOnce(readResult())
    .mockResolvedValueOnce(readResult());
};

const expectDecodedDiscussionNaddr = (): void => {
  expect(extractDiscussionFromNaddr(discussionNaddr)).toMatchObject({
    dTag: "topic",
    authorPubkey,
    discussionId: `34550:${authorPubkey}:topic`,
  });
};

const expectMetadataRead = (): void => {
  expect(mockExecuteNostrRead).toHaveBeenNthCalledWith(
    1,
    expect.any(Object),
    expect.objectContaining({
      plan: expect.objectContaining({
        target: "discussion-meta",
        filters: [
          expect.objectContaining({
            kinds: [34550],
            authors: [authorPubkey],
            "#d": ["topic"],
            limit: 1,
          }),
        ],
      }),
      relayUrls: ["wss://relay.example"],
    }),
  );
};

describe("Issue #101 actual metadata-to-heading path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("decodes the naddr, parses the NIP-72 name tag, and renders it as the public h1", async () => {
    expectDecodedDiscussionNaddr();
    const event = metadataEvent([
      ["d", "topic"],
      ["name", "NIP-72の会話タイトル"],
      ["description", "説明"],
    ]);
    setupReadFixture(event);

    render(
      <DiscussionDetailProvider>
        <DiscussionTabLayout baseHref={`/discussions/${discussionNaddr}`}>
          <div>content</div>
        </DiscussionTabLayout>
      </DiscussionDetailProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "NIP-72の会話タイトル",
        }),
      ).toBeInTheDocument(),
    );
    expect(mockExecuteNostrRead).toHaveBeenCalledTimes(4);
    expectMetadataRead();
  });

  it("uses the NIP-72 d tag as the title when the optional name tag is absent", async () => {
    expectDecodedDiscussionNaddr();
    const event = metadataEvent([["d", "topic"]]);
    setupReadFixture(event);

    render(
      <DiscussionDetailProvider>
        <DiscussionTabLayout baseHref={`/discussions/${discussionNaddr}`}>
          <div>content</div>
        </DiscussionTabLayout>
      </DiscussionDetailProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "topic" }),
      ).toBeInTheDocument(),
    );
    expect(mockExecuteNostrRead).toHaveBeenCalledTimes(4);
    expectMetadataRead();
  });
});
