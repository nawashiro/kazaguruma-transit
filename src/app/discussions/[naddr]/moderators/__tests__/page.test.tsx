import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModeratorsPage from "../page";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

const createDiscussion = () => ({
  id: "34550:creator:topic",
  dTag: "topic",
  title: "テスト会話",
  description: "説明",
  moderators: [{ pubkey: "moderator" }],
  authorPubkey: "creator",
  createdAt: 10,
  event: {
    id: "discussion-1",
    kind: 34550,
    pubkey: "creator",
    created_at: 10,
    content: "",
    tags: [],
    sig: "signature",
  },
});
const mockReload = jest.fn();
const mockUseDiscussionMeta = jest.fn();
const mockUseDiscussionDetail = jest.fn();
const mockModeratorManagementSection = jest.fn();
const mockModeratorAuthUser = { pubkey: "creator", isLoggedIn: true };
const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useParams: () => ({ naddr: "naddr-real-route" }),
}));

jest.mock(
  "../../../../../components/discussion/DiscussionDetailProvider",
  () => ({ useDiscussionDetail: () => mockUseDiscussionDetail() }),
  { virtual: true },
);

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: mockModeratorAuthUser,
    signEvent: jest.fn(),
  }),
}));
jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));
jest.mock("@/components/discussion/ModeratorManagementSection", () => ({
  ModeratorManagementSection: (props: {
    applications: Array<{
      id: string;
      applicantPubkey: string;
      reason?: string;
    }>;
    moderators: Array<{ pubkey: string }>;
    onToggleApproval: (pubkey: string) => void;
    onToggleRemoval: (pubkey: string) => void;
  }) => {
    mockModeratorManagementSection(props);
    return (
      <section data-testid="moderator-management-section">
        {props.applications.map((application) => (
          <div
            key={application.id}
            data-testid={`moderator-application-${application.id}`}
          >
            <span>{application.reason ?? application.id}</span>
            <button onClick={() => props.onToggleApproval(application.applicantPubkey)}>
              許可を選択
            </button>
          </div>
        ))}
        {props.moderators.map((moderator) => (
          <button
            key={moderator.pubkey}
            onClick={() => props.onToggleRemoval(moderator.pubkey)}
          >
            削除を選択
          </button>
        ))}
      </section>
    );
  },
}));
jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 1000 }),
}));
jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    streamEventsOnEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
  };
  return { createNostrService: () => serviceMock, __mock: serviceMock };
});
const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");
jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({
    queryWithCompletion: jest.fn(),
    createModeratorUpdateDraft: jest.fn(),
  }),
}));
jest.mock("@/lib/nostr/nostr-read-executor", () => {
  const executeNostrRead = jest.fn();
  return { executeNostrRead, __mock: { executeNostrRead } };
});
const { __mock: discussionReadExecutorMock } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor",
);
jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: (pubkey: string) => `npub-${pubkey}`,
  isValidNpub: () => true,
  npubToHex: (npub: string) => npub,
}));
jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () =>
    "とんかつ やたい うごかす",
}));

const moderatorRequestEvent: NostrEventDTO = {
  id: "moderator-request-1",
  kind: 1111,
  pubkey: "applicant",
  created_at: 20,
  content: "モデレーターになりたいです",
  tags: [
    ["a", "34550:creator:topic"],
    ["t", "moderator-request"],
  ],
  sig: "request-signature",
};
const detailSnapshotFixture = {
  discussion: createDiscussion(),
  posts: [],
  approvals: [],
  moderatorRequests: [
    {
      id: moderatorRequestEvent.id,
      applicantPubkey: moderatorRequestEvent.pubkey,
      createdAt: moderatorRequestEvent.created_at,
      reason: moderatorRequestEvent.content,
      event: moderatorRequestEvent,
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
  reload: mockReload,
  addPost: jest.fn(),
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
  ...overrides,
});

describe("ModeratorsPage direct moderator management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDiscussionDetail.mockReturnValue(createDetailModel());
    mockModeratorAuthUser.pubkey = "creator";
    mockModeratorAuthUser.isLoggedIn = true;
    mockReload.mockReset();
    discussionReadExecutorMock.executeNostrRead.mockResolvedValue({
      events: [moderatorRequestEvent],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 0,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    });
    mockUseDiscussionMeta.mockReturnValue({
      discussion: createDiscussion(),
      isLoading: false,
      error: null,
      reload: mockReload,
    });
  });

  it("reads moderator applications from the detail snapshot without a page-owned read", async () => {
    render(<ModeratorsPage />);

    expect(discussionReadExecutorMock.executeNostrRead).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("moderator-application-moderator-request-1"),
    ).toHaveTextContent("モデレーターになりたいです");
    expect(mockModeratorManagementSection).toHaveBeenCalledWith(
      expect.objectContaining({
        applications: [
          expect.objectContaining({
            id: "moderator-request-1",
            applicantPubkey: "applicant",
          }),
        ],
      }),
    );
    expect(await screen.findByRole("button", { name: "許可を選択" })).toBeInTheDocument();
    expect(serviceMock.streamEventsOnEvent).not.toHaveBeenCalled();
  });

  it("shows the detail loading boundary before any moderator state is finalized", () => {
    mockUseDiscussionMeta.mockReturnValue(undefined);
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ state: "loading", snapshot: null }),
    );

    render(<ModeratorsPage />);

    expect(screen.getByText("会話情報を読み込み中...")).toBeInTheDocument();
    expect(
      screen.queryByText(/会話データの取得に時間がかかっています/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("会話情報が見つかりませんでした。")).not.toBeInTheDocument();
    expect(screen.queryByText("申請中のユーザーはいません。")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "モデレーターになる" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "申請する" })).not.toBeInTheDocument();
  });

  it("keeps a partial detail snapshot provisional without a local moderator-request retry", async () => {
    mockUseDiscussionDetail.mockReturnValue(
      createDetailModel({ state: "partial" }),
    );
    discussionReadExecutorMock.executeNostrRead.mockReset();

    render(<ModeratorsPage />);

    expect(discussionReadExecutorMock.executeNostrRead).not.toHaveBeenCalled();
    const applicationStatus = await screen.findByRole("status", {
      name: "モデレーター申請の取得は完了していません",
    });
    expect(applicationStatus).toBeInTheDocument();
    expect(applicationStatus).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(applicationStatus).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByText("申請中のユーザーはいません。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "モデレーター申請を再取得" })).not.toBeInTheDocument();
    expect(discussionReadExecutorMock.executeNostrRead).not.toHaveBeenCalled();
  });

  it("keeps Rubyful mutations inside the removable loading text", () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: true,
      error: null,
      reload: mockReload,
    });

    render(<ModeratorsPage />);

    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).not.toHaveClass("ruby-text");
    expect(screen.getByText("会話情報を読み込み中...")).toHaveClass(
      "ruby-text",
    );
  });

  it("shows incomplete discussion retrieval as partial instead of not found", () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: false,
      error: null,
      completionReason: "hard-timeout",
      reload: mockReload,
    });

    render(<ModeratorsPage />);

    const partialStatus = screen.getByRole("status");
    expect(partialStatus).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(partialStatus).toHaveAttribute("aria-live", "polite");
    expect(partialStatus).toHaveTextContent(
      "会話データの取得に時間がかかっています",
    );
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
    expect(screen.queryByText("会話情報が見つかりませんでした。")).not.toBeInTheDocument();
  });

  it("取得完了後に会話がなければ読み込み表示を続けない", () => {
    mockUseDiscussionMeta.mockReturnValue({
      discussion: null,
      isLoading: false,
      error: "会話情報が見つかりませんでした。",
      reload: mockReload,
    });

    render(<ModeratorsPage />);

    expect(screen.queryByText("会話情報を読み込み中...")).not.toBeInTheDocument();
    const notFoundStatus = screen.getByRole("status");
    expect(notFoundStatus).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(notFoundStatus).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(notFoundStatus).toHaveTextContent(
      "会話情報が見つかりませんでした。",
    );
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("enables confirmation when approval and removal selections change", async () => {
    render(<ModeratorsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "許可を選択" }));
    fireEvent.click(screen.getByRole("button", { name: "削除を選択" }));

    expect(screen.getByRole("button", { name: "変更を確定" })).not.toBeDisabled();
    expect(screen.queryByText(/許可予定|削除予定/)).not.toBeInTheDocument();
  });

  it("adds multiple direct moderators and allows each one to be cancelled", async () => {
    render(<ModeratorsPage />);

    await screen.findByRole("button", { name: "許可を選択" });
    const input = screen.getByLabelText("ユーザーID");
    const addButton = screen.getByRole("button", { name: "追加" });

    fireEvent.change(input, { target: { value: "npub1first" } });
    fireEvent.click(addButton);
    fireEvent.change(input, { target: { value: "npub1second" } });
    fireEvent.click(addButton);

    expect(screen.getByText("追加予定のユーザー")).toBeVisible();
    expect(screen.getByText("npub1first")).toBeVisible();
    expect(screen.getByText("npub1second")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "取り消す" })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "変更を確定" }),
    ).not.toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "取り消す" })[0]);

    expect(screen.queryByText("npub1first")).not.toBeInTheDocument();
    expect(screen.getByText("npub1second")).toBeVisible();
    expect(screen.getByRole("button", { name: "変更を確定" })).not.toBeDisabled();
  });

  it("keeps the direct moderator button joined to the input", async () => {
    render(<ModeratorsPage />);

    await screen.findByRole("button", { name: "許可を選択" });
    const input = screen.getByLabelText("ユーザーID");
    const addButton = screen.getByRole("button", { name: "追加" });

    expect(addButton).toHaveClass("join-item");
    expect(addButton).not.toHaveClass("rounded-full");
    expect(input.closest(".join")).toContainElement(addButton);
  });

  it("associates duplicate-user errors with the direct moderator input", async () => {
    render(<ModeratorsPage />);

    await screen.findByRole("button", { name: "許可を選択" });
    const input = screen.getByLabelText("ユーザーID");
    const addButton = screen.getByRole("button", { name: "追加" });
    fireEvent.change(input, { target: { value: "npub1duplicate" } });
    fireEvent.click(addButton);
    fireEvent.change(input, { target: { value: "npub1duplicate" } });
    fireEvent.click(addButton);

    const error = screen.getByRole("alert");
    expect(error).toBeVisible();
    expect(error).toHaveTextContent("そのユーザーはすでに追加予定です。");
    expect(error).toHaveClass("text-base-content");
    expect(input).toHaveAttribute("aria-describedby", "direct-moderator-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("navigates an unauthenticated moderator request to login without opening LoginModal or auto-publishing", async () => {
    mockModeratorAuthUser.pubkey = "";
    mockModeratorAuthUser.isLoggedIn = false;
    const view = render(<ModeratorsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "ログイン" }));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const target = mockRouterPush.mock.calls[0][0] as string;
    const targetUrl = new URL(target, "https://kazaguruma.invalid");
    expect(targetUrl.pathname).toBe("/login");
    expect(targetUrl.searchParams.get("returnTo")).toBe(
      "/discussions/naddr-real-route/moderators",
    );
    expect(targetUrl.searchParams.has("action")).toBe(false);
    expect(targetUrl.searchParams.has("payload")).toBe(false);
    expect(targetUrl.searchParams.has("draft")).toBe(false);
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(serviceMock.publishSignedEvent).not.toHaveBeenCalled();

    mockModeratorAuthUser.pubkey = "creator";
    mockModeratorAuthUser.isLoggedIn = true;
    view.rerender(<ModeratorsPage />);
    await screen.findByRole("button", { name: "許可を選択" });
    expect(serviceMock.publishSignedEvent).not.toHaveBeenCalled();
  });
});
