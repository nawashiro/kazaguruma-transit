import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BusStopMemo } from "../BusStopMemo";
import type { StreamEventsOptions } from "@/lib/nostr/nostr-service";

jest.mock("../useBusStopModeration", () => {
  const actual = jest.requireActual("../useBusStopModeration");
  return {
    ...actual,
    useBusStopModeration: jest.fn(actual.useBusStopModeration),
  };
});

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

const actualUseBusStopModeration = jest.requireActual<
  typeof import("../useBusStopModeration")
>("../useBusStopModeration").useBusStopModeration;
const mockUseBusStopModeration = jest.requireMock(
  "../useBusStopModeration",
).useBusStopModeration as jest.MockedFunction<typeof actualUseBusStopModeration>;

describe("BusStopMemo streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBusStopModeration.mockImplementation(actualUseBusStopModeration);
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

  it("does not show the provisional approval warning when no post is associated with a stop", async () => {
    const { queryByText } = render(<BusStopMemo busStops={["A"]} />);

    await waitFor(() => {
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(1);
      expect(queryByText("承認情報を確認中です。表示内容は暫定です。")).not.toBeInTheDocument();
    });
  });

  it("shows the provisional approval warning while associated posts are still being checked", () => {
    serviceMock.getEventsWithCompletion
      .mockResolvedValueOnce({
        events: [{ id: "post-1", kind: 1111, created_at: 1, tags: [], content: "", pubkey: "" }],
        completionReason: "idle-timeout",
        eventCount: 1,
        elapsedMs: 1,
        startedAt: 1,
        lastEventAt: 1,
        eoseReceived: false,
        relayUrls: [],
        duplicateCount: 0,
        sourceRelayUrlsByEventId: {},
      })
      .mockResolvedValueOnce({
        events: [],
        completionReason: "idle-timeout",
        eventCount: 0,
        elapsedMs: 1,
        startedAt: 1,
        lastEventAt: 1,
        eoseReceived: false,
        relayUrls: [],
        duplicateCount: 0,
        sourceRelayUrlsByEventId: {},
      });

    render(<BusStopMemo busStops={["A"]} />);

    return waitFor(() =>
      expect(document.body).toHaveTextContent("承認情報を確認中です。表示内容は暫定です。")
    );
  });

  it("shows moderation read errors as a soft alert", () => {
    const error = "バス停の投稿データを取得できませんでした。";
    mockUseBusStopModeration.mockReturnValue({
      snapshot: null,
      isLoading: false,
      error,
      reload: jest.fn(),
    });

    render(<BusStopMemo busStops={["A"]} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(error);
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
  });
});
