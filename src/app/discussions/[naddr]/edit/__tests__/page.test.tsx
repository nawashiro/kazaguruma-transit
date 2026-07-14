import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionEditPage from "../page";
import type { Discussion } from "@/types/discussion";

const authState = {
  user: {
    pubkey: "f".repeat(64),
    isLoggedIn: true,
  },
};
const signEventMock = jest.fn(async (event: unknown) => ({
  id: "signed-id",
  kind: 1111,
  pubkey: "f".repeat(64),
  created_at: 10,
  tags: [],
  content: "",
  sig: "s".repeat(128),
  ...(event as object),
}));
const createDiscussionListingRequestMock = jest.fn(() => ({
  kind: 1111,
  content: "nostr:naddr1discussion",
  tags: [
    ["a", "34550:admin:list"],
    ["q", "34550:author:discussion"],
  ],
  created_at: 1,
}));
const createModeratorPromotionRequestMock = jest.fn(() => ({
  kind: 1111,
  content: "",
  tags: [
    ["a", "34550:f:test-discussion"],
    ["p", "f".repeat(64)],
    ["t", "moderator-request"],
  ],
  created_at: 1,
}));
const createModeratorDecisionDraftMock = jest.fn(() => ({
  kind: 34550,
  content: "Test Description",
  tags: [
    ["d", "test-discussion"],
    ["name", "Test Discussion"],
    ["description", "Test Description"],
    ["p", "e".repeat(64), "", "moderator"],
  ],
  created_at: 11,
  pubkey: "f".repeat(64),
}));
const mockUseDiscussionMeta = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr1discussion" }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: authState.user,
    signEvent: signEventMock,
  }),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ defaultTimeout: 10 }),
}));

jest.mock("@/lib/nostr/nostr-service", () => ({
  __mock: {
    publishSignedEvent: jest.fn(async () => true),
  },
  getNostrServiceConfigKey: () => "test-config",
  createNostrService: () => ({
    streamEventsOnEvent: (
      filters: Array<{ kinds?: number[]; "#t"?: string[] }>,
      handlers: { onEose?: (events: unknown[]) => void },
    ) => {
      const kinds = filters[0]?.kinds ?? [];
      if (kinds.includes(34550)) {
        handlers.onEose?.([
          {
            id: "discussion-event",
            pubkey: "f".repeat(64),
            kind: 34550,
            created_at: 1,
            tags: [
              ["d", "test-discussion"],
              ["name", "Test Discussion"],
              ["description", "Test Description"],
            ],
            content: "Test Description",
            sig: "s".repeat(128),
          },
        ]);
      } else if (
        kinds.includes(1111) &&
        filters[0]?.["#t"]?.includes("moderator-request")
      ) {
        handlers.onEose?.([
          {
            id: "promotion-request-1",
            pubkey: "e".repeat(64),
            kind: 1111,
            created_at: 2,
            tags: [
              ["a", "34550:f:test-discussion"],
              ["p", "f".repeat(64)],
              ["t", "moderator-request"],
            ],
            content: "",
            sig: "s".repeat(128),
          },
        ]);
      } else {
        handlers.onEose?.([]);
      }
      return () => undefined;
    },
    publishSignedEvent: jest.requireMock("@/lib/nostr/nostr-service").__mock
      .publishSignedEvent,
  }),
}));

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({
    createModeratorDecisionDraft: (...args: unknown[]) =>
      (createModeratorDecisionDraftMock as (...mockArgs: unknown[]) => unknown)(
        ...args,
      ),
  }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "test-discussion",
    authorPubkey: "f".repeat(64),
    discussionId: "34550:f:test-discussion",
  }),
  buildNaddrFromDiscussion: () => "naddr1discussion",
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: (pubkey: string) => `npub-${pubkey}`,
  parseDiscussionEvent: () => ({
    id: "34550:f:test-discussion",
    title: "Test Discussion",
    description: "Test Description",
    authorPubkey: "f".repeat(64),
    dTag: "test-discussion",
    moderators: [{ pubkey: "e".repeat(64) }],
    createdAt: 1,
    event: {
      id: "discussion-event",
      kind: 34550,
      pubkey: "f".repeat(64),
      created_at: 1,
      tags: [["d", "test-discussion"]],
      content: "Test Description",
      sig: "s".repeat(128),
    },
  }),
  isValidNpub: () => true,
  npubToHex: () => "f".repeat(64),
  getAdminPubkeyHex: () => "a".repeat(64),
  formatRelativeTime: () => "now",
}));

jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () =>
    "あいこくしん あいさつ あいだ",
}));

jest.mock("@/lib/discussion/user-creation-flow", () => ({
  createDiscussionListingRequest: (...args: unknown[]) =>
    (createDiscussionListingRequestMock as (...mockArgs: unknown[]) => unknown)(
      ...args,
    ),
  createModeratorPromotionRequestEvent: (...args: unknown[]) =>
    (
      createModeratorPromotionRequestMock as (...mockArgs: unknown[]) => unknown
    )(...args),
}));

jest.mock("@/components/discussion/LoginModal", () => ({
  LoginModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="login-modal">Login Modal</div> : null,
}));

describe("DiscussionEditPage listing request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const layoutDiscussion: Discussion = {
      id: "34550:f:test-discussion",
      title: "Test Discussion",
      description: "Test Description",
      authorPubkey: "f".repeat(64),
      dTag: "test-discussion",
      moderators: [{ pubkey: "e".repeat(64) }],
      createdAt: 1,
      event: {
        id: "discussion-event",
        kind: 34550,
        pubkey: "f".repeat(64),
        created_at: 1,
        tags: [["d", "test-discussion"]],
        content: "Test Description",
        sig: "s".repeat(128),
      },
    };
    mockUseDiscussionMeta.mockReturnValue({
      discussion: layoutDiscussion,
      isLoading: false,
      error: null,
      completionReason: "eose",
      reload: jest.fn(),
    });
    authState.user = {
      pubkey: "f".repeat(64),
      isLoggedIn: true,
    };
  });

  it("publishes listing request from edit page", async () => {
    render(<DiscussionEditPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "会話一覧へ掲載申請" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "会話一覧へ掲載申請" }));

    await waitFor(() =>
      expect(createDiscussionListingRequestMock).toHaveBeenCalled(),
    );
    expect(signEventMock).toHaveBeenCalled();
    expect(
      jest.requireMock("@/lib/nostr/nostr-service").__mock.publishSignedEvent,
    ).toHaveBeenCalled();
    expect(
      await screen.findByText("会話一覧への掲載を申請しました"),
    ).toBeInTheDocument();
  });

  it("does not expose basic information controls to non-authors", () => {
    authState.user = {
      pubkey: "d".repeat(64),
      isLoggedIn: true,
    };

    render(<DiscussionEditPage />);

    expect(
      screen.getByRole("heading", { name: "基本情報を編集できません" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("会話の基本情報を編集できるのは会話作成者だけです。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "会話に戻る" }),
    ).not.toBeInTheDocument();
  });

  it("does not include moderator management in basic information", async () => {
    render(<DiscussionEditPage />);

    expect(screen.queryByText("モデレーター管理")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "承認" }),
    ).not.toBeInTheDocument();
  });

  it("does not show current moderators in basic information", async () => {
    render(<DiscussionEditPage />);

    expect(
      screen.queryByText("現在のモデレーター（Mnemonic）"),
    ).not.toBeInTheDocument();
  });

  it("groups destructive actions separately and removes the duplicate return link", async () => {
    render(<DiscussionEditPage />);

    expect(
      await screen.findByRole("heading", { name: "危険な操作" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "会話を削除" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "会話に戻る" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "会話を編集" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "会話情報を編集" }),
    ).not.toBeInTheDocument();
  });

  it("shows only the permission explanation for unauthenticated users", async () => {
    authState.user = { pubkey: "", isLoggedIn: false };

    render(<DiscussionEditPage />);

    expect(
      screen.getByText("会話の基本情報を編集できるのは会話作成者だけです。"),
    ).toBeInTheDocument();
  });
});
