import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BusStopMemo } from "../BusStopMemo";
import type { Event } from "nostr-tools";
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

  it("starts approvals streaming after posts EOSE", async () => {
    serviceMock.streamEventsOnEvent.mockImplementationOnce(
      (_filters, options) => {
        const postEvents = [{ id: "post-1" }, { id: "post-2" }] as Event[];
        options.onEose?.(postEvents);
        return () => {};
      }
    );

    render(<BusStopMemo busStops={["A"]} />);

    await waitFor(() =>
      expect(serviceMock.streamApprovalsForPosts).toHaveBeenCalled()
    );

    expect(serviceMock.streamApprovalsForPosts).toHaveBeenCalledWith(
      ["post-1", "post-2"],
      "discussion-1",
      expect.any(Object)
    );
    expect(serviceMock.streamApprovals).not.toHaveBeenCalled();
  });

  it("streams memo data without blocking on EOSE fetch", async () => {
    render(<BusStopMemo busStops={["A"]} />);

    await waitFor(() =>
      expect(serviceMock.streamEventsOnEvent).toHaveBeenCalled()
    );
    expect(serviceMock.getDiscussionPosts).not.toHaveBeenCalled();
  });
});
