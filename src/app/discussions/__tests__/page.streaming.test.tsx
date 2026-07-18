import { render, screen } from "@testing-library/react";
import DiscussionsPage from "../page";

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "viewer", isLoggedIn: true },
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
}));

jest.mock("@/components/discussion/DiscussionListTabLayout", () => ({
  DiscussionListTabLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/components/discussion/DiscussionManagementDataProvider", () => ({
  useDiscussionManagementData: () => ({
    posts: [
      {
        id: "listing-post",
        approved: true,
        approvalState: "approved",
        event: { tags: [["q", "34550:author:demo"]] },
      },
    ],
    referencedDiscussions: [
      {
        id: "34550:author:demo",
        authorPubkey: "author",
        dTag: "demo",
        title: "共有取得された会話",
        description: "説明",
        moderators: [],
        createdAt: 100,
      },
    ],
    isModerationLoading: false,
    isReferencedDiscussionsLoading: false,
    moderationError: null,
  }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  buildNaddrFromDiscussion: () => "naddr1test",
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  formatRelativeTime: () => "たった今",
}));

describe("DiscussionsPage shared data", () => {
  it("renders a discussion supplied by the persistent management provider", () => {
    render(<DiscussionsPage />);

    expect(screen.getByText("共有取得された会話")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /共有取得された会話/ })).toHaveAttribute(
      "href",
      "/discussions/naddr1test",
    );
  });
});
