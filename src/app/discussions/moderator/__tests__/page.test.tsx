import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PublicModeratorPage from "../page";
import type { DiscussionManagementModel } from "@/components/discussion/DiscussionManagementProvider";
import type { DiscussionManagementSnapshot } from "@/lib/discussion/discussion-management-read-coordinator";
import type { Discussion } from "@/types/discussion";

const mockRouterPush = jest.fn();
const mockUseDiscussionManagement = jest.fn();
const mockSignEvent = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "", isLoggedIn: false },
    signEvent: mockSignEvent,
  }),
}));

jest.mock("@/components/discussion/DiscussionManagementProvider", () => ({
  useDiscussionManagement: () => mockUseDiscussionManagement(),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const service = {
    publishSignedEvent: jest.fn(),
  };
  return { createNostrService: () => service, __mock: service };
});
const { __mock: nostrServiceMock } = jest.requireMock(
  "@/lib/nostr/nostr-service",
) as { __mock: { publishSignedEvent: jest.Mock } };

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({
    createModeratorUpdateDraft: jest.fn(),
  }),
}));

jest.mock("@/lib/discussion/user-creation-flow", () => ({
  createModeratorPromotionRequestEvent: jest.fn(),
}));

jest.mock("@/lib/discussion/moderator-application-state", () => ({
  calculateModeratorUpdateTimestamp: jest.fn(),
  calculateNextModeratorPubkeys: jest.fn(),
  deriveLatestModeratorApplications: jest.fn(() => new Map()),
  derivePendingModeratorApplications: jest.fn(() => []),
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  formatRelativeTime: jest.fn(() => "現在"),
  hexToNpub: jest.fn(() => "npub1test"),
  isValidNpub: jest.fn(() => false),
  npubToHex: jest.fn((value: string) => value),
}));

jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: jest.fn(() => "テストユーザー"),
}));

jest.mock("@/utils/logger", () => ({
  logger: { error: jest.fn() },
}));

const listDiscussion: Discussion = {
  id: `34550:${"a".repeat(64)}:moderator-listing`,
  dTag: "moderator-listing",
  title: "公開モデレーター管理",
  description: "公開モデレーター管理のテスト会話",
  moderators: [],
  authorPubkey: "a".repeat(64),
  createdAt: 1,
  event: {
    id: "list-discussion-event",
    kind: 34550,
    pubkey: "a".repeat(64),
    created_at: 1,
    content: "公開モデレーター管理のテスト会話",
    tags: [["d", "moderator-listing"]],
    sig: "list-discussion-signature",
  },
};

const managementSnapshot: DiscussionManagementSnapshot = {
  listDiscussion,
  listingPosts: [],
  listingApprovals: [],
  referencedDiscussions: [],
  moderatorRequests: [],
  relayProvenance: { successfulRelayUrlsByPhase: {} },
};

const managementModel: DiscussionManagementModel = {
  state: "ready",
  snapshot: managementSnapshot,
  error: null,
  completionReason: "eose",
  relayProvenance: managementSnapshot.relayProvenance,
  reload: jest.fn().mockResolvedValue(undefined),
};

describe("public moderator route login return target", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDiscussionManagement.mockReturnValue(managementModel);
    nostrServiceMock.publishSignedEvent.mockResolvedValue(true);
  });

  it("returns unauthenticated moderator applicants to the canonical public route without action metadata", () => {
    render(<PublicModeratorPage />);

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const target = mockRouterPush.mock.calls[0][0] as string;
    const targetUrl = new URL(target, "https://kazaguruma.invalid");
    expect(targetUrl.pathname).toBe("/login");
    expect(targetUrl.searchParams.get("returnTo")).toBe(
      "/discussions/moderator",
    );
    for (const parameter of ["reason", "action", "payload", "draft"]) {
      expect(targetUrl.searchParams.has(parameter)).toBe(false);
    }
    expect(nostrServiceMock.publishSignedEvent).not.toHaveBeenCalled();
  });
});
