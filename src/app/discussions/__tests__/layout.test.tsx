import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { DiscussionManagementModel } from "@/components/discussion/DiscussionManagementProvider";
import DiscussionsLayout from "../layout";
import DiscussionsPage from "../page";

const mockUseDiscussionManagement = jest.fn<DiscussionManagementModel, []>();
function mockDiscussionManagementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

jest.mock("next/navigation", () => ({
  usePathname: () => "/discussions",
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
    user: { pubkey: null, isLoggedIn: false },
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
  getDiscussionReadStrategyConfig: () => ({
    idleTimeoutMs: 500,
    hardTimeoutMs: 1500,
    dedupWindowMs: 0,
  }),
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  getAdminPubkeyHex: () => "",
  formatRelativeTime: () => "たった今",
}));

jest.unmock("@/components/discussion/DiscussionManagementProvider");
jest.mock("@/components/discussion/DiscussionManagementProvider", () => ({
  __esModule: true,
  DiscussionManagementProvider: mockDiscussionManagementProvider,
  useDiscussionManagement: () => mockUseDiscussionManagement(),
}));

const managementModel = {
  state: "ready",
  snapshot: {
    listDiscussion: null,
    listingPosts: [],
    listingApprovals: [],
    referencedDiscussions: [],
  },
  error: null,
  completionReason: "eose",
  relayProvenance: null,
  reload: jest.fn(async () => undefined),
} satisfies DiscussionManagementModel;

describe("/discussions route composition", () => {
  beforeEach(() => {
    mockUseDiscussionManagement.mockReset();
    mockUseDiscussionManagement.mockImplementation(() => managementModel);
  });

  it("renders the management header and top-level tabs only once", () => {
    render(
      <DiscussionsLayout>
        <DiscussionsPage />
      </DiscussionsLayout>,
    );

    expect(
      screen.getAllByRole("heading", { level: 1, name: "意見交換" }),
    ).toHaveLength(1);
    expect(screen.getAllByRole("tablist")).toHaveLength(1);

    for (const tabLabel of ["会話一覧", "掲載依頼", "モデレーター"]) {
      expect(screen.getAllByRole("tab", { name: tabLabel })).toHaveLength(1);
    }

    expect(
      screen.getByRole("heading", { level: 2, name: "会話一覧" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "新しい会話を作成" }),
    ).toBeInTheDocument();
  });
});
