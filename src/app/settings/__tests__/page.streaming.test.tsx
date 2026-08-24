import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "../page";

const mockSettingsUser = {
  isLoggedIn: true,
  pubkey: "user-pubkey",
  profile: { about: "自己紹介" },
};
const mockRouterPush = jest.fn();
const mockAuthError = { value: null as string | null };

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: mockSettingsUser,
    logout: jest.fn(),
    isLoading: false,
    error: mockAuthError.value,
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
  getDiscussionReadStrategyConfig: () => ({

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

jest.mock("@/lib/nostr/nostr-read-executor", () => {
  const executeNostrRead = jest.fn();
  return { executeNostrRead, __mock: { executeNostrRead } };
});

const { __mock: discussionReadExecutorMock } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor",
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
    duplicateCount: 0,
    elapsedMs: 0,
    attemptedRelayUrls: [],
    successfulEventRelayUrls: [],
    sourceRelayUrlsByEventId: {},
    attempts: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsUser.isLoggedIn = true;
    mockSettingsUser.pubkey = "user-pubkey";
    mockAuthError.value = null;
    discussionReadExecutorMock.executeNostrRead.mockResolvedValue(
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

  it("renders an unauthenticated auth error as an assertive soft alert", async () => {
    mockSettingsUser.isLoggedIn = false;
    mockSettingsUser.pubkey = "";
    mockAuthError.value = "認証に失敗しました。";

    render(<SettingsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(alert).toHaveTextContent("認証に失敗しました。");
    expect(
      screen.getByRole("button", { name: "ログイン / アカウント作成" }),
    ).toBeInTheDocument();
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

    discussionReadExecutorMock.executeNostrRead.mockResolvedValue(
      withCompletion([mockEvent], "idle-timeout"),
    );

    render(<SettingsPage />);

    await waitFor(() =>
      expect(discussionReadExecutorMock.executeNostrRead).toHaveBeenCalledWith(
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
    discussionReadExecutorMock.executeNostrRead.mockResolvedValue(
      withCompletion([], "hard-timeout"),
    );

    render(<SettingsPage />);

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(/会話データの取得に時間がかかっています/);
    expect(warning).toHaveAttribute("aria-live", "polite");
    expect(warning).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
  });

  it("sends an unauthenticated user to the login page instead of opening LoginModal", () => {
    mockSettingsUser.isLoggedIn = false;
    mockSettingsUser.pubkey = "";

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "ログイン / アカウント作成" }));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const target = mockRouterPush.mock.calls[0][0] as string;
    const targetUrl = new URL(target, "https://kazaguruma.invalid");
    expect(targetUrl.pathname).toBe("/login");
    expect(targetUrl.searchParams.get("returnTo")).toBe("/settings");
    expect(targetUrl.searchParams.has("action")).toBe(false);
    expect(targetUrl.searchParams.has("payload")).toBe(false);
    expect(targetUrl.searchParams.has("draft")).toBe(false);
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(discussionReadExecutorMock.executeNostrRead).not.toHaveBeenCalled();
  });
});
