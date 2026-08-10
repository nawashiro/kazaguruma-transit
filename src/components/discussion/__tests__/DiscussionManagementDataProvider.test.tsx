import { render, screen, waitFor } from "@testing-library/react";
import { DiscussionManagementDataProvider, useDiscussionManagementData } from "../DiscussionManagementDataProvider";

let pathname = "/discussions";
let mockDiscussion: Record<string, unknown> | null;

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => ({
    discussion: mockDiscussion,
    isLoading: false,
    error: null,
    completionReason: "eose",
    reload: jest.fn(),
  }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    discussionId: "34550:admin:list",
    authorPubkey: "admin",
    dTag: "list",
    relays: [],
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({
    relays: [{ url: "wss://relay.example", read: true }],
    defaultTimeout: 500,
  }),
  getDiscussionReadStrategyConfig: () => ({
    relayLimit: 3,
    idleTimeoutMs: 500,
    hardTimeoutMs: 1500,
    dedupWindowMs: 250,
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const service = {
    getEventsWithCompletion: jest.fn(),
    getReferencedUserDiscussions: jest.fn().mockResolvedValue([]),
  };
  return {
    createNostrService: () => service,
    __mock: service,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseApprovalEvent: () => null,
  parseDiscussionEvent: () => null,
  parsePostEvent: (event: { kind: number; id: string; tags: string[][] }) =>
    event.kind === 1111
      ? {
          id: event.id,
          approved: true,
          createdAt: 1,
          event,
        }
      : null,
}));

jest.mock("@/lib/discussion/discussion-known-data-cache", () => ({
  loadKnownDiscussionData: () => null,
  saveKnownDiscussionData: jest.fn(),
}));

function Probe() {
  const data = useDiscussionManagementData();
  return <div>{data.isModerationLoading ? "loading" : `posts:${data.posts.length}:references:${data.referencedDiscussions.length}`}</div>;
}

describe("DiscussionManagementDataProvider", () => {
  beforeEach(() => {
    pathname = "/discussions";
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1list";
    mockDiscussion = {
      id: "34550:admin:list",
      authorPubkey: "admin",
      dTag: "list",
      moderators: [{ pubkey: "moderator" }],
      createdAt: 1,
      title: "掲載一覧",
      description: "",
    };
    serviceMock.getEventsWithCompletion.mockReset().mockResolvedValue({
      events: [],
      completionReason: "eose",
      eventCount: 0,
      elapsedMs: 1,
      startedAt: 1,
      lastEventAt: 1,
      eoseReceived: true,
      relayUrls: [],
      duplicateCount: 0,
      sourceRelayUrlsByEventId: {},
    });
    serviceMock.getReferencedUserDiscussions.mockClear();
  });

  it("reuses the listing moderation read when navigating to listing requests", async () => {
    const { rerender } = render(
      <DiscussionManagementDataProvider>
        <Probe />
      </DiscussionManagementDataProvider>,
    );

    await screen.findByText("posts:0:references:0");
    expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(1);

    pathname = "/discussions/manage";
    rerender(
      <DiscussionManagementDataProvider>
        <Probe />
      </DiscussionManagementDataProvider>,
    );

    await waitFor(() =>
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(1),
    );
  });

  it("does not read listing posts on a direct moderator-tab visit", async () => {
    pathname = "/discussions/moderator";

    render(
      <DiscussionManagementDataProvider>
        <Probe />
      </DiscussionManagementDataProvider>,
    );

    await screen.findByText("posts:0:references:0");
    expect(serviceMock.getEventsWithCompletion).not.toHaveBeenCalled();
  });

  it("starts the listing read without waiting for community metadata", async () => {
    mockDiscussion = null;

    render(
      <DiscussionManagementDataProvider>
        <Probe />
      </DiscussionManagementDataProvider>,
    );

    await screen.findByText("posts:0:references:0");
    expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(1);
  });

  it("reads canonical published references through a multi-filter reference plan", async () => {
    const referencedAuthor = "a".repeat(64);
    const secondReferencedAuthor = "b".repeat(64);
    serviceMock.getEventsWithCompletion.mockImplementation((filters: Array<{ kinds?: number[] }>) =>
      Promise.resolve({
        events: filters[0]?.kinds?.includes(1111)
          ? [{
              id: "listing-post",
              pubkey: "poster",
              created_at: 1,
              kind: 1111,
              tags: [
                ["q", `34550:${referencedAuthor}:referenced-discussion`],
                ["q", `34550:${secondReferencedAuthor}:second-discussion`],
                ["q", `34550:${referencedAuthor}:referenced-discussion`],
              ],
              content: "",
              sig: "sig",
            }]
          : [],
        completionReason: "eose",
        eventCount: 0,
        elapsedMs: 1,
        startedAt: 1,
        lastEventAt: 1,
        eoseReceived: true,
        relayUrls: [],
        duplicateCount: 0,
        sourceRelayUrlsByEventId: {},
      }),
    );

    render(
      <DiscussionManagementDataProvider>
        <Probe />
      </DiscussionManagementDataProvider>,
    );

    await waitFor(() =>
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(3),
    );

    expect(serviceMock.getEventsWithCompletion).toHaveBeenLastCalledWith(
      [
        {
          kinds: [34550],
          authors: [referencedAuthor],
          "#d": ["referenced-discussion"],
          limit: 1,
        },
        {
          kinds: [34550],
          authors: [secondReferencedAuthor],
          "#d": ["second-discussion"],
          limit: 1,
        },
      ],
      expect.objectContaining({ relayUrls: ["wss://relay.example"] }),
    );
  });
});
