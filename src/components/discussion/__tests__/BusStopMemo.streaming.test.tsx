import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BusStopMemo } from "../BusStopMemo";
import type { StreamEventsOptions } from "@/lib/nostr/nostr-service";

jest.mock("@/lib/config/discussion-config", () => ({
  getDiscussionConfig: () => ({
    busStopDiscussionId: "discussion-1",
    relays: [],
  }),
  isDiscussionsEnabled: () => true,
}));

const serviceMock = {
  streamEventsOnEvent: jest.fn<() => void, [unknown, StreamEventsOptions]>(
    () => () => {}
  ),
  streamApprovals: jest.fn(() => () => {}),
  streamApprovalsForPosts: jest.fn(() => () => {}),
  getDiscussionPosts: jest.fn(),
  getEvaluationsForPosts: jest.fn(),
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
  sortPostsByScore: () => [],
}));

describe("BusStopMemo streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the same scoped completion-aware read as discussion", async () => {
    render(<BusStopMemo busStops={["A"]} />);

    await waitFor(() =>
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalled()
    );
  });

  it("does not use the legacy unscoped post fetch", async () => {
    render(<BusStopMemo busStops={["A"]} />);

    await waitFor(() =>
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalled()
    );
    expect(serviceMock.getDiscussionPosts).not.toHaveBeenCalled();
  });
});
