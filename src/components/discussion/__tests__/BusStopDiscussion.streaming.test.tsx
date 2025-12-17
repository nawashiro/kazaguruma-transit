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

  it("starts streaming posts/approvals without waiting for EOSE fetch", async () => {
    render(<BusStopDiscussion busStops={["A"]} />);

    await waitFor(() =>
      expect(serviceMock.streamEventsOnEvent).toHaveBeenCalled()
    );
    expect(serviceMock.getDiscussionPosts).not.toHaveBeenCalled();
  });
});
