import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "../page";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      isLoggedIn: true,
      pubkey: "user-pubkey",
      profile: { about: "自己紹介" },
    },
    logout: jest.fn(),
    isLoading: false,
    error: null,
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
  getDiscussionReadStrategyConfig: () => ({
    relayLimit: 3,
    idleTimeoutMs: 500,
    hardTimeoutMs: 1500,
    dedupWindowMs: 250,
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    publishSignedEvent: jest.fn(),
  };

  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

const { __mock: nostrServiceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => {
  const gateway = {
    queryWithCompletion: jest.fn(),
  };

  return {
    createDiscussionNdkGateway: () => gateway,
  };
});

jest.mock("@/lib/discussion/discussion-read-executor", () => {
  const executeDiscussionRead = jest.fn();
  return { executeDiscussionRead, __mock: { executeDiscussionRead } };
});

const { __mock: discussionReadExecutorMock } = jest.requireMock(
  "@/lib/discussion/discussion-read-executor",
);

jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: (value: string) => value,
  formatBip39JapaneseMnemonicPreviewFromPubkey: () => "あいうえお かきくけこ さしすせそ",
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
  formatRelativeTime: () => "now",
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  __esModule: true,
  buildNaddrFromDiscussion: (discussion: any) => discussion.id,
}));

jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () =>
    "あいうえお かきくけこ さしすせそ",
}));

jest.mock("@/components/discussion/LoginModal", () => ({
  __esModule: true,
  LoginModal: () => <div>Login Modal</div>,
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

describe("SettingsPage streaming discussions", () => {
  const withCompletion = (events: any[], completionReason: "eose" | "idle-timeout" | "hard-timeout" = "eose") => ({
    events,
    completionReason,
    attemptedRelayUrls: [],
    successfulEventRelayUrls: [],
    sourceRelayUrlsByEventId: {},
    attempts: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    discussionReadExecutorMock.executeDiscussionRead.mockResolvedValue(
      withCompletion([]),
    );
  });

  it("displays the derived user name with さん and does not display the old profile user name", async () => {
    render(<SettingsPage />);

    expect(
      await screen.findByText("あいうえお かきくけこ さしすせそ")
    ).toBeInTheDocument();
    expect(screen.getByText("さん")).toBeInTheDocument();
    expect(screen.queryByText("ユーザー名")).not.toBeInTheDocument();
  });

  it("loads user discussions through the bounded discussion read executor", async () => {
    expect(typeof SettingsPage).toBe("function");

    const mockEvent = {
      id: "event-1",
      pubkey: "user-pubkey",
      kind: 34550,
      created_at: 123,
      tags: [
        ["d", "demo-discussion"],
        ["name", "Demo Discussion"],
      ],
      content: "desc",
      sig: "sig",
    };

    discussionReadExecutorMock.executeDiscussionRead.mockResolvedValue(
      withCompletion([mockEvent], "idle-timeout"),
    );

    render(<SettingsPage />);

    await waitFor(() =>
      expect(discussionReadExecutorMock.executeDiscussionRead).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          plan: expect.objectContaining({
            target: "discussion-list",
            filters: [expect.objectContaining({ authors: ["user-pubkey"] })],
          }),
        }),
      )
    );

    await waitFor(() =>
      expect(screen.getByText("Demo Discussion")).toBeInTheDocument()
    );

    expect(nostrServiceMock.publishSignedEvent).not.toHaveBeenCalled();
  });

  it("shows timeout warning when completion-aware read has no events", async () => {
    discussionReadExecutorMock.executeDiscussionRead.mockResolvedValue(
      withCompletion([], "hard-timeout"),
    );

    render(<SettingsPage />);

    expect(
      await screen.findByText(/会話データの取得に時間がかかっています/)
    ).toBeInTheDocument();
  });
});
