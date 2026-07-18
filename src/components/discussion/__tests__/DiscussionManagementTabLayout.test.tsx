import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiscussionManagementTabLayout } from "../DiscussionManagementTabLayout";

const usePathname = jest.fn(() => "/discussions/manage");
const mockUseDiscussionMeta = jest.fn();
let mockUserPubkey: string | null = null;

jest.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: mockUserPubkey, isLoggedIn: Boolean(mockUserPubkey) },
  }),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => {
  const queryWithCompletion = jest.fn();
  return {
    createDiscussionNdkGateway: () => ({ queryWithCompletion }),
    queryWithCompletion,
  };
});

const { queryWithCompletion: mockQueryWithCompletion } = jest.requireMock(
  "@/lib/nostr/discussion-ndk-gateway",
);

describe("DiscussionManagementTabLayout", () => {
  beforeEach(() => {
    mockUserPubkey = null;
    mockUseDiscussionMeta.mockReturnValue(undefined);
    mockQueryWithCompletion.mockReset().mockResolvedValue({ events: [] });
  });

  it("renders the shared management tabs as a tabs-box", () => {
    render(
      <DiscussionManagementTabLayout role="user">
        <div>content</div>
      </DiscussionManagementTabLayout>,
    );

    expect(screen.getByRole("tablist")).toHaveClass("tabs", "tabs-box");
    expect(screen.getByRole("tab", { name: "会話一覧" })).toHaveAttribute(
      "href",
      "/discussions",
    );
    expect(screen.getByRole("tab", { name: "会話一覧" })).toHaveAttribute(
      "aria-controls",
      "discussion-management-panel",
    );
    expect(screen.getByRole("tab", { name: "掲載依頼" })).toHaveAttribute(
      "href",
      "/discussions/manage",
    );
    expect(screen.getByRole("tab", { name: "モデレーター" })).toHaveAttribute(
      "href",
      "/discussions/moderator",
    );
    expect(screen.getByRole("heading", { level: 1, name: "意見交換" })).toBeInTheDocument();
    expect(
      screen.getByText("意見交換を行うために自由に利用していい場所です。誰でも新しい会話を作成できます。"),
    ).toBeInTheDocument();
    expect(screen.getByText("あなたはユーザーです。"))
      .toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "discussion-management-1-tab",
    );
  });

  it("marks the current management route active", () => {
    usePathname.mockReturnValue("/discussions/moderator");
    render(<DiscussionManagementTabLayout><div /></DiscussionManagementTabLayout>);

    expect(screen.getByRole("tab", { name: "モデレーター" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("uses metadata from the discussion layout without starting another read", () => {
    mockUserPubkey = "moderator-pubkey";
    mockUseDiscussionMeta.mockReturnValue({
      discussion: {
        authorPubkey: "creator-pubkey",
        moderators: [{ pubkey: "moderator-pubkey" }],
      },
      isLoading: false,
      error: null,
      completionReason: "eose",
      reload: jest.fn(),
    });

    render(
      <DiscussionManagementTabLayout>
        <div>content</div>
      </DiscussionManagementTabLayout>,
    );

    expect(screen.getByText("あなたはモデレーターです。")).toBeInTheDocument();
    expect(mockQueryWithCompletion).not.toHaveBeenCalled();
  });
});
