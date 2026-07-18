import { render, screen, waitFor } from "@testing-library/react";
import {
  DiscussionContentDataProvider,
  useDiscussionContentData,
} from "../DiscussionContentDataProvider";

let pathname = "/discussions/naddr-test";

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useParams: () => ({ naddr: "naddr-test" }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
  getDiscussionReadStrategyConfig: () => ({
    relayLimit: 3,
    idleTimeoutMs: 500,
    hardTimeoutMs: 1500,
    dedupWindowMs: 250,
  }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    discussionId: "34550:author:topic",
    authorPubkey: "author",
    dTag: "topic",
    relays: [],
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const service = { getEventsWithCompletion: jest.fn() };
  return { createNostrService: () => service, __mock: service };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseApprovalEvent: () => null,
  parsePostEvent: () => null,
}));

jest.mock("@/lib/discussion/discussion-known-data-cache", () => ({
  loadKnownDiscussionData: () => null,
  saveKnownDiscussionData: jest.fn(),
}));

jest.mock("@/lib/test/test-data-loader", () => ({
  isTestMode: () => false,
  loadTestData: jest.fn(),
}));

function Probe() {
  const data = useDiscussionContentData();
  return <div>{data.isLoading ? "loading" : `posts:${data.posts.length}`}</div>;
}

const completion = {
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
};

describe("DiscussionContentDataProvider", () => {
  beforeEach(() => {
    pathname = "/discussions/naddr-test";
    serviceMock.getEventsWithCompletion.mockReset().mockResolvedValue(completion);
  });

  it("reuses the moderation snapshot when navigating to all posts", async () => {
    const { rerender } = render(
      <DiscussionContentDataProvider>
        <Probe />
      </DiscussionContentDataProvider>,
    );

    await screen.findByText("posts:0");
    expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(1);

    pathname = "/discussions/naddr-test/approve";
    rerender(
      <DiscussionContentDataProvider>
        <Probe />
      </DiscussionContentDataProvider>,
    );

    await waitFor(() =>
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(1),
    );
  });

  it.each(["moderators", "edit"])(
    "does not read posts on a direct %s-tab visit",
    async (tab) => {
      pathname = `/discussions/naddr-test/${tab}`;

      render(
        <DiscussionContentDataProvider>
          <Probe />
        </DiscussionContentDataProvider>,
      );

      await screen.findByText("posts:0");
      expect(serviceMock.getEventsWithCompletion).not.toHaveBeenCalled();
    },
  );
});
