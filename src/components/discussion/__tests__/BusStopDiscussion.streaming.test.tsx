import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BusStopDiscussion } from "../BusStopDiscussion";

const mockBusStopUser: { pubkey: string | null; isLoggedIn: boolean } = {
  pubkey: "user",
  isLoggedIn: true,
};
const mockSignEvent = jest.fn();
const mockRouterPush = jest.fn();
const mockCreatePostEvent = jest.fn();
const mockCreateEvaluationEvent = jest.fn();
const mockPublishSignedEvent = jest.fn();
const mockBusStopEvent = {
  id: "post-event",
  pubkey: "post-author",
  created_at: 1,
  kind: 1111,
  tags: [["a", "discussion-1"], ["t", "A"]],
  content: "既存の投稿",
  sig: "post-signature",
};
const mockBusStopPost = {
  id: "post-1",
  content: "既存の投稿",
  authorPubkey: "post-author",
  discussionId: "discussion-1",
  busStopTag: "A",
  createdAt: 1,
  approved: true,
  approvalState: "approved" as const,
  approvedBy: [],
  event: mockBusStopEvent,
};
const mockBusStopSnapshot = {
  primaryEvents: [mockBusStopEvent],
  approvalEvents: [],
  relayUrls: [],
  initialRelayUrls: [],
  attemptedRelayUrls: [],
  nextRelayUrls: [],
  successfulRelayUrls: [],
  completionReason: "eose" as const,
  approvalState: "approved" as const,
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: mockBusStopUser,
    signEvent: mockSignEvent,
  }),
}));

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

jest.mock("@/components/discussion/PostPreview", () => ({
  PostPreview: ({ onConfirm }: { onConfirm: () => void }) => (
    <button type="button" onClick={() => void onConfirm()}>
      投稿を確定
    </button>
  ),
}));

const serviceMock = {
  streamEventsOnEvent: jest.fn(() => () => {}),
  streamApprovals: jest.fn(() => () => {}),
  streamApprovalsForPosts: jest.fn(() => () => {}),
  getDiscussionPosts: jest.fn(),
  getEvaluationsForPosts: jest.fn().mockResolvedValue([]),
  getEvaluations: jest.fn().mockResolvedValue([]),
  createPostEvent: mockCreatePostEvent,
  createEvaluationEvent: mockCreateEvaluationEvent,
  publishSignedEvent: mockPublishSignedEvent,
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
  parsePostEvent: (event: { id: string }) =>
    event.id === "post-event" ? mockBusStopPost : null,
  parseApprovalEvent: () => null,
  parseEvaluationEvent: () => null,
  combinePostsWithStats: (posts: Array<Record<string, unknown>>) =>
    posts.map((post) => ({
      ...post,
      evaluationStats: { positive: 0, negative: 0, total: 0, score: 0 },
    })),
  filterUnevaluatedPosts: (posts: unknown[]) => posts,
  shuffleArray: (posts: unknown[]) => posts,
  validatePostForm: jest.fn(() => []),
}));

const mockUseBusStopModeration = jest.requireMock(
  "../useBusStopModeration",
).useBusStopModeration as jest.Mock;
const mockValidatePostForm = jest.requireMock(
  "@/lib/nostr/nostr-utils",
).validatePostForm as jest.Mock;
const actualUseBusStopModeration = jest.requireActual<
  typeof import("../useBusStopModeration")
>("../useBusStopModeration").useBusStopModeration;

describe("BusStopDiscussion streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidatePostForm.mockReset();
    mockValidatePostForm.mockReturnValue([]);
    mockUseBusStopModeration.mockImplementation(actualUseBusStopModeration);
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

  it("does not show the provisional approval warning when no post is associated with a stop", async () => {
    const { queryByText } = render(<BusStopDiscussion busStops={["A"]} />);

    await waitFor(() => {
      expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(1);
      expect(queryByText("承認情報を確認中です。表示内容は暫定です。")).not.toBeInTheDocument();
    });
  });

  it("shows stream errors as a soft alert", async () => {
    const error = "バス停の投稿データを取得できませんでした。";
    mockUseBusStopModeration.mockReturnValue({
      snapshot: null,
      isLoading: false,
      error,
      reload: jest.fn(),
    });

    render(<BusStopDiscussion busStops={["A"]} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(error);
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
  });

  it("shows validation errors as an assertive soft alert after confirming a post", async () => {
    const validationError = "本文を入力してください";
    mockValidatePostForm.mockReturnValueOnce([validationError]);

    render(<BusStopDiscussion busStops={["A"]} />);

    fireEvent.change(screen.getByRole("textbox", { name: /投稿内容/ }), {
      target: { value: "投稿本文" },
    });
    fireEvent.click(screen.getByRole("button", { name: "プレビュー" }));
    fireEvent.click(screen.getByRole("button", { name: "投稿を確定" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent(validationError);
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.getByRole("list")).toHaveTextContent(validationError);
  });
});

describe("BusStopDiscussion unauthenticated actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBusStopUser.pubkey = null;
    mockBusStopUser.isLoggedIn = false;
    mockUseBusStopModeration.mockReturnValue({
      snapshot: mockBusStopSnapshot,
      isLoading: false,
      error: null,
      reload: jest.fn(),
    });
  });

  afterEach(() => {
    mockBusStopUser.pubkey = "user";
    mockBusStopUser.isLoggedIn = true;
  });

  it("routes an unauthenticated post action to login without a modal or publish side effects", async () => {
    const view = render(<BusStopDiscussion busStops={["A"]} />);

    fireEvent.change(screen.getByRole("textbox", { name: /投稿内容/ }), {
      target: { value: "投稿本文" },
    });
    fireEvent.click(screen.getByRole("button", { name: "プレビュー" }));
    fireEvent.click(screen.getByRole("button", { name: "投稿を確定" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
    });
    const target = new URL(
      mockRouterPush.mock.calls[0][0] as string,
      "https://kazaguruma.invalid",
    );
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("returnTo")).toBe("/");
    expect(target.searchParams.get("reason")).toBe("投稿するにはログインが必要です。");
    expect(target.searchParams.has("action")).toBe(false);
    expect(target.searchParams.has("payload")).toBe(false);
    expect(target.searchParams.has("draft")).toBe(false);
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(mockCreatePostEvent).not.toHaveBeenCalled();
    expect(mockPublishSignedEvent).not.toHaveBeenCalled();

    mockBusStopUser.pubkey = "authenticated-user";
    mockBusStopUser.isLoggedIn = true;
    view.rerender(<BusStopDiscussion busStops={["A"]} />);
    await waitFor(() => {
      expect(mockSignEvent).not.toHaveBeenCalled();
      expect(mockCreatePostEvent).not.toHaveBeenCalled();
      expect(mockPublishSignedEvent).not.toHaveBeenCalled();
    });
  });

  it("routes an unauthenticated evaluation action to login without evaluation side effects", async () => {
    const view = render(<BusStopDiscussion busStops={["A"]} />);

    fireEvent.click(await screen.findByRole("button", { name: "はい" }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
    });
    const target = new URL(
      mockRouterPush.mock.calls[0][0] as string,
      "https://kazaguruma.invalid",
    );
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("returnTo")).toBe("/");
    expect(target.searchParams.get("reason")).toBe(
      "投稿を評価するにはログインが必要です。",
    );
    expect(target.searchParams.has("action")).toBe(false);
    expect(target.searchParams.has("payload")).toBe(false);
    expect(target.searchParams.has("draft")).toBe(false);
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(mockCreateEvaluationEvent).not.toHaveBeenCalled();
    expect(mockPublishSignedEvent).not.toHaveBeenCalled();

    mockBusStopUser.pubkey = "authenticated-user";
    mockBusStopUser.isLoggedIn = true;
    view.rerender(<BusStopDiscussion busStops={["A"]} />);
    await waitFor(() => {
      expect(mockSignEvent).not.toHaveBeenCalled();
      expect(mockCreateEvaluationEvent).not.toHaveBeenCalled();
      expect(mockPublishSignedEvent).not.toHaveBeenCalled();
    });
  });
});
