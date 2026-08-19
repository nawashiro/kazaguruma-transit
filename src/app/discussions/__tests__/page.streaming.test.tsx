import { render, screen } from "@testing-library/react";
import DiscussionsPage from "../page";

const pubkey = "a".repeat(64);
const mockManagementData = {
  posts: [
    {
      id: "listing-post",
      approved: true,
      approvalState: "approved",
      event: { tags: [["q", `34550:${pubkey}:demo`]] },
    },
  ],
  referencedDiscussions: [
    {
      id: `34550:${pubkey}:demo`,
      authorPubkey: pubkey,
      dTag: "demo",
      title: "共有取得された会話",
      description: "説明",
      moderators: [],
      createdAt: 100,
    },
  ],
  isModerationLoading: false,
  isReferencedDiscussionsLoading: false,
  referencedDiscussionCompletionReason: "eose" as "eose" | "idle-timeout",
  moderationError: null as string | null,
};

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ user: { pubkey: "viewer", isLoggedIn: true } }),
}));
jest.mock("@/lib/config/discussion-config", () => ({ isDiscussionsEnabled: () => true }));
jest.mock("@/components/discussion/DiscussionListTabLayout", () => ({
  DiscussionListTabLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/discussion/DiscussionManagementDataProvider", () => ({
  useDiscussionManagementData: () => mockManagementData,
}));
jest.mock("@/lib/nostr/naddr-utils", () => ({ buildNaddrFromDiscussion: () => "naddr1test" }));
jest.mock("@/lib/nostr/nostr-utils", () => ({ formatRelativeTime: () => "たった今" }));

describe("DiscussionsPage shared data", () => {
  beforeEach(() => {
    mockManagementData.referencedDiscussions = [{
      id: `34550:${pubkey}:demo`, authorPubkey: pubkey, dTag: "demo", title: "共有取得された会話",
      description: "説明", moderators: [], createdAt: 100,
    }];
    mockManagementData.referencedDiscussionCompletionReason = "eose";
    mockManagementData.moderationError = null;
  });

  it("renders a discussion supplied by the persistent management provider", () => {
    render(<DiscussionsPage />);
    expect(screen.getByText("共有取得された会話")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /共有取得された会話/ })).toHaveAttribute("href", "/discussions/naddr1test");
  });

  it("does not render an empty-state conclusion after a partial referenced-definition read", () => {
    mockManagementData.referencedDiscussions = [];
    mockManagementData.referencedDiscussionCompletionReason = "idle-timeout";
    render(<DiscussionsPage />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("会話一覧を完全に取得できませんでした");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.queryByText("会話がまだありません。")).not.toBeInTheDocument();
  });

  it("renders a moderation load error as a soft alert with its message", () => {
    mockManagementData.moderationError = "会話一覧の取得に失敗しました。";
    render(<DiscussionsPage />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("会話一覧の取得に失敗しました。");
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
  });
});
