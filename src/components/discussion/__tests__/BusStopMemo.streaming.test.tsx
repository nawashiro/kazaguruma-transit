import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BusStopMemo } from "../BusStopMemo";

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
};

jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => serviceMock,
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parsePostEvent: () => null,
  parseApprovalEvent: () => null,
  parseEvaluationEvent: () => null,
  combinePostsWithStats: () => [],
  sortPostsByScore: () => [],
}));

describe("BusStopMemo streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("streams memo data without blocking on EOSE fetch", async () => {
    render(<BusStopMemo busStops={["A"]} />);

    await waitFor(() =>
      expect(serviceMock.streamEventsOnEvent).toHaveBeenCalled()
    );
    expect(serviceMock.getDiscussionPosts).not.toHaveBeenCalled();
  });
});
