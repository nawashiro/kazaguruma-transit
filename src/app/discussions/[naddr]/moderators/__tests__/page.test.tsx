import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModeratorsPage from "../page";

const createDiscussion = () => ({
  id: "34550:creator:topic",
  dTag: "topic",
  title: "テスト会話",
  description: "説明",
  moderators: [],
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
const mockModeratorAuthUser = { pubkey: "creator", isLoggedIn: true };
const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useParams: () => ({ naddr: "naddr-real-route" }),
}));

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
  ModeratorManagementSection: ({
    applications,
    onToggleApproval,
    onToggleRemoval,
  }: {
    applications: unknown[];
    onToggleApproval: (pubkey: string) => void;
    onToggleRemoval: (pubkey: string) => void;
  }) => (
    <>
      {applications.length === 0 && <p>申請中のユーザーはいません。</p>}
      <button onClick={() => onToggleApproval("applicant")}>許可を選択</button>
      <button onClick={() => onToggleRemoval("moderator")}>削除を選択</button>
    </>
  ),
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
jest.mock("@/lib/discussion/discussion-read-executor", () => {
  const executeDiscussionRead = jest.fn();
  return { executeDiscussionRead, __mock: { executeDiscussionRead } };
});
const { __mock: discussionReadExecutorMock } = jest.requireMock(
  "@/lib/discussion/discussion-read-executor",
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

describe("ModeratorsPage direct moderator management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModeratorAuthUser.pubkey = "creator";
    mockModeratorAuthUser.isLoggedIn = true;
    mockReload.mockReset();
    discussionReadExecutorMock.executeDiscussionRead.mockResolvedValue({
      events: [],
      completionReason: "eose",
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

  it("loads moderator applications through a bounded completion-aware read", async () => {
    render(<ModeratorsPage />);

    await waitFor(() =>
      expect(discussionReadExecutorMock.executeDiscussionRead).toHaveBeenCalled(),
    );
    await screen.findByRole("button", { name: "許可を選択" });
    expect(serviceMock.streamEventsOnEvent).not.toHaveBeenCalled();
  });

  it("keeps a rejected moderator-application read provisional and retries it locally", async () => {
    discussionReadExecutorMock.executeDiscussionRead.mockRejectedValue(
      new Error("relay rejected the read"),
    );

    render(<ModeratorsPage />);

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

    discussionReadExecutorMock.executeDiscussionRead.mockResolvedValue({
      events: [],
      completionReason: "eose",
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "モデレーター申請を再取得" }));

    await waitFor(() =>
      expect(discussionReadExecutorMock.executeDiscussionRead).toHaveBeenCalledTimes(2),
    );
    expect(screen.getByText("申請中のユーザーはいません。")).toBeInTheDocument();
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
