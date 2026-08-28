import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { DiscussionManagementModel } from "../DiscussionManagementProvider";
import { DiscussionManagementTabLayout } from "../DiscussionManagementTabLayout";

const usePathname = jest.fn(() => "/discussions/manage");
const mockUseDiscussionManagement = jest.fn<DiscussionManagementModel, []>();
let mockUserPubkey: string | null = null;

jest.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: mockUserPubkey, isLoggedIn: Boolean(mockUserPubkey) },
  }),
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  getAdminPubkeyHex: () => "admin-pubkey",
  npubToHex: (pubkey: string) => pubkey,
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => undefined,
}));

jest.mock("@/components/discussion/DiscussionManagementProvider", () => ({
  useDiscussionManagement: () => mockUseDiscussionManagement(),
}));

const managementDiscussion = {
  id: "34550:author:management-list",
  authorPubkey: "author",
  dTag: "management-list",
  moderators: [{ pubkey: "moderator-pubkey" }],
  createdAt: 1,
  title: "管理モデルの掲載一覧",
  description: "管理モデルから取得した説明",
  event: {
    id: "management-list-event",
    pubkey: "author",
    created_at: 1,
    kind: 34550,
    tags: [["d", "management-list"], ["name", "管理モデルの掲載一覧"]],
    content: "管理モデルから取得した説明",
    sig: "management-list-sig",
  },
};

const createManagementModel = (
  overrides: Partial<DiscussionManagementModel> = {},
): DiscussionManagementModel => ({
  state: "ready",
  snapshot: {
    listDiscussion: managementDiscussion,
    listingPosts: [],
    listingApprovals: [],
    referencedDiscussions: [],
  },
  error: null,
  completionReason: "eose",
  relayProvenance: null,
  reload: jest.fn(async () => undefined),
  ...overrides,
});

describe("DiscussionManagementTabLayout", () => {
  beforeEach(() => {
    mockUserPubkey = null;
    usePathname.mockReturnValue("/discussions/manage");
    mockUseDiscussionManagement.mockReset();
    mockUseDiscussionManagement.mockReturnValue(createManagementModel());
  });

  it("renders title and role from the management snapshot when legacy metadata is undefined", () => {
    mockUserPubkey = "moderator-pubkey";

    render(
      <DiscussionManagementTabLayout>
        <div>content</div>
      </DiscussionManagementTabLayout>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "管理モデルの掲載一覧" }),
    ).toBeInTheDocument();
    expect(screen.getByText("管理モデルから取得した説明")).toBeInTheDocument();
    expect(screen.getByText("あなたはモデレーターです。")).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toHaveClass("tabs", "tabs-box");
    expect(screen.getByRole("tab", { name: "会話一覧" })).toHaveAttribute(
      "href",
      "/discussions",
    );
    expect(screen.getByRole("tab", { name: "掲載依頼" })).toHaveAttribute(
      "href",
      "/discussions/manage",
    );
    expect(screen.getByRole("tab", { name: "モデレーター" })).toHaveAttribute(
      "href",
      "/discussions/moderator",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "discussion-management-1-tab",
    );
  });

  it("keeps the current management route active", () => {
    usePathname.mockReturnValue("/discussions/moderator");

    render(<DiscussionManagementTabLayout><div /></DiscussionManagementTabLayout>);

    expect(screen.getByRole("tab", { name: "モデレーター" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders the public loading state without a legacy discussion", () => {
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "loading",
        snapshot: null,
        completionReason: null,
      }),
    );

    render(<DiscussionManagementTabLayout><div>content</div></DiscussionManagementTabLayout>);

    expect(screen.getByRole("status")).toHaveTextContent("会話データを読み込み中...");
    expect(screen.queryByText("あなたはユーザーです。")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("renders partial management state with a public reload action", () => {
    const reload = jest.fn(async () => undefined);
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "partial",
        completionReason: "idle-timeout",
        reload,
      }),
    );

    render(<DiscussionManagementTabLayout><div>content</div></DiscussionManagementTabLayout>);

    expect(
      screen.getByText("一部のrelayからの取得が完了していません。表示内容は暫定です。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("renders management errors and reloads through the public model", () => {
    const reload = jest.fn(async () => undefined);
    mockUseDiscussionManagement.mockReturnValue(
      createManagementModel({
        state: "error",
        snapshot: null,
        error: "管理モデルの取得に失敗しました。",
        completionReason: null,
        reload,
      }),
    );

    render(<DiscussionManagementTabLayout><div>content</div></DiscussionManagementTabLayout>);

    expect(screen.getByRole("status")).toHaveTextContent("管理モデルの取得に失敗しました。");
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
