import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionEditPage from "../page";
import type { Discussion } from "@/types/discussion";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

const mockUseDiscussionMeta = jest.fn();
const mockUseDiscussionDetail = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock(
  "@/components/discussion/DiscussionDetailProvider",
  () => ({ useDiscussionDetail: () => mockUseDiscussionDetail() }),
);

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      pubkey: "author",
      isLoggedIn: true,
    },
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "demo",
    authorPubkey: "author",
    discussionId: "34550:author:demo",
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    streamEventsOnEvent: jest.fn(),
    getDiscussions: jest.fn(),
    publishSignedEvent: jest.fn(),
  };

  return {
    createNostrService: () => serviceMock,
    getNostrServiceConfigKey: () => "test-config",
    __mock: serviceMock,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: jest.fn((event) => ({
    id: `34550:${event.pubkey}:${event.tags?.find((t: string[]) => t[0] === "d")?.[1] || ""}`,
    title: event.tags?.find((t: string[]) => t[0] === "name")?.[1] || "Untitled",
    description: event.content,
    authorPubkey: event.pubkey,
    dTag: event.tags?.find((t: string[]) => t[0] === "d")?.[1] || "",
    moderators: [],
    createdAt: event.created_at,
    event,
  })),
  isValidNpub: () => true,
  npubToHex: (npub: string) => npub,
  getAdminPubkeyHex: () => "a".repeat(64),
}));

jest.mock("@/components/ui/Button", () => {
  return function MockButton({
    children,
    disabled,
    loading,
    ...props
  }: any) {
    return (
      <button disabled={disabled || loading} {...props}>
        {loading ? "Loading..." : children}
      </button>
    );
  };
});

const promotionRequestEvent: NostrEventDTO = {
  id: "promotion-request-1",
  kind: 1111,
  pubkey: "applicant",
  created_at: 124,
  content: "昇格を希望します",
  tags: [
    ["a", "34550:author:demo"],
    ["t", "moderator-request"],
  ],
  sig: "promotion-signature",
};
const detailDiscussion: Discussion = {
  id: "34550:author:demo",
  title: "Edit Me",
  description: "Updated description",
  authorPubkey: "author",
  dTag: "demo",
  moderators: [],
  createdAt: 123,
  event: {
    id: "event-1",
    pubkey: "author",
    kind: 34550,
    created_at: 123,
    tags: [
      ["d", "demo"],
      ["name", "Edit Me"],
      ["description", "desc"],
    ],
    content: "Updated description",
    sig: "sig",
  },
};
const detailSnapshotFixture = {
  discussion: detailDiscussion,
  posts: [],
  approvals: [],
  moderatorRequests: [
    {
      id: promotionRequestEvent.id,
      applicantPubkey: promotionRequestEvent.pubkey,
      createdAt: promotionRequestEvent.created_at,
      reason: promotionRequestEvent.content,
      event: promotionRequestEvent,
    },
  ],
  evaluations: [],
  userEvaluationIds: new Set<string>(),
};
const createDetailModel = (
  overrides: Partial<{
    state: "loading" | "ready" | "partial" | "error";
    snapshot: typeof detailSnapshotFixture | null;
    error: string | null;
    reload: jest.Mock;
    addPost: jest.Mock;
    addApproval: jest.Mock;
    removeApproval: jest.Mock;
  }> = {},
) => ({
  state: "ready" as const,
  snapshot: detailSnapshotFixture,
  error: null,
  reload: jest.fn(),
  addPost: jest.fn(),
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
  ...overrides,
});

describe("DiscussionEditPage streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    const layoutDiscussion: Discussion = {
      id: "34550:author:demo",
      title: "Edit Me",
      description: "Updated description",
      authorPubkey: "author",
      dTag: "demo",
      moderators: [],
      createdAt: 123,
      event: {
        id: "event-1",
        pubkey: "author",
        kind: 34550,
        created_at: 123,
        tags: [
          ["d", "demo"],
          ["name", "Edit Me"],
          ["description", "desc"],
        ],
        content: "Updated description",
        sig: "sig",
      },
    };
    mockUseDiscussionMeta.mockReturnValue({
      discussion: layoutDiscussion,
      isLoading: false,
      error: null,
      completionReason: "eose",
      reload: jest.fn(),
    });
  });

  it("does not render moderator-management controls from promotion requests", async () => {
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    render(<DiscussionEditPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("タイトル *")).toHaveValue("Edit Me")
    );
    expect(screen.queryByRole("heading", { name: "モデレーター管理" })).not.toBeInTheDocument();
    expect(screen.queryByText("現在のモデレーター（Mnemonic）")).not.toBeInTheDocument();
    expect(screen.queryByText("昇格申請ユーザー一覧")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("申請理由（任意）")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "モデレーター昇格を申請" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "昇格申請を再取得" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "承認" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "却下" })).not.toBeInTheDocument();
    expect(serviceMock.streamEventsOnEvent).not.toHaveBeenCalled();
    expect(serviceMock.getDiscussions).not.toHaveBeenCalled();
  });

  it("renders the basic information form for a partial detail snapshot", async () => {
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ state: "partial" }),
    );

    render(<DiscussionEditPage />);

    expect(await screen.findByLabelText("タイトル *")).toHaveValue("Edit Me");
    expect(screen.getByRole("heading", { name: "危険な操作" })).toBeInTheDocument();
  });

  it("renders discussion timeout as a polite soft status with reload", async () => {
    const reload = jest.fn();
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: false,
      error: null,
      completionReason: "hard-timeout",
      reload,
    });

    render(<DiscussionEditPage />);

    const warningText = await screen.findByText(/会話データの取得に時間がかかっています/);
    const status = warningText.closest<HTMLElement>('[role="status"]');
    expect(status).not.toBeNull();
    if (!status) {
      throw new Error('Expected the edit timeout to be rendered as a status');
    }
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(status).toHaveTextContent(/会話データの取得に時間がかかっています/);
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });

  it("does not show not-found while the layout is still loading", () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: true,
      error: null,
      completionReason: null,
      reload: jest.fn(),
    });

    render(<DiscussionEditPage />);

    expect(screen.queryByText("会話が見つかりません")).not.toBeInTheDocument();
    expect(screen.getByText("会話情報を読み込み中...")).toBeInTheDocument();
  });

  it("shows not-found only after retrieval has completed without data", async () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: false,
      error: null,
      completionReason: "eose",
      reload: jest.fn(),
    });

    render(<DiscussionEditPage />);

    expect(await screen.findByText("会話が見つかりません")).toBeInTheDocument();
  });
});
