import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BusStopDiscussion } from "../BusStopDiscussion";

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "user", isLoggedIn: true },
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  getDiscussionConfig: () => ({
    busStopDiscussionId: "discussion-1",
    relays: [],
  }),
  isDiscussionsEnabled: () => true,
}));

const serviceMock = {
  streamEventsOnEvent: jest.fn(() => () => {}),
  streamApprovals: jest.fn(() => () => {}),
  streamApprovalsForPosts: jest.fn(() => () => {}),
  getDiscussionPosts: jest.fn(),
  getEvaluationsForPosts: jest.fn(),
  getEvaluations: jest.fn(),
  getEventsWithCompletion: jest.fn().mockResolvedValue({
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
  }),
};

jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => serviceMock,
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parsePostEvent: () => null,
  parseApprovalEvent: () => null,
  parseEvaluationEvent: () => null,
  combinePostsWithStats: () => [],
  validatePostForm: () => [],
}));

describe("BusStopDiscussion streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a scoped completion-aware read for bus-stop posts and approvals", async () => {
    render(<BusStopDiscussion busStops={["A"]} />);

    await waitFor(() =>
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalled()
    );
    expect(serviceMock.getEventsWithCompletion).toHaveBeenNthCalledWith(
      1,
      [{ kinds: [1111, 1], "#a": ["discussion-1"], "#t": ["A"], limit: 10, until: undefined }],
      expect.objectContaining({ relayUrls: expect.any(Array) }),
    );
  });
});
