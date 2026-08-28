import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

function assertSettingsAuthLink(element: HTMLElement, expectedPathname: string) {
  expect(element.tagName).toBe("A");
  const href = element.getAttribute("href");
  expect(href).not.toBeNull();
  if (href === null) {
    throw new Error("settings auth link did not expose a native href");
  }

  const target = new URL(href, "https://kazaguruma.invalid");
  expect(target.pathname).toBe(expectedPathname);
  expect(target.searchParams.get("returnTo")).toBe("/settings");
  expect([...target.searchParams.keys()]).toEqual(["returnTo"]);
}

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
    expect(screen.getByRole("link", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "アカウント作成" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ログイン / アカウント作成" }),
    ).not.toBeInTheDocument();
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

  it("renders separate native login and signup links without opening LoginModal", () => {
    mockSettingsUser.isLoggedIn = false;
    mockSettingsUser.pubkey = "";

    render(<SettingsPage />);

    const loginLink = screen.getByRole("link", { name: "ログイン" });
    const signupLink = screen.getByRole("link", { name: "アカウント作成" });

    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "ログイン / アカウント作成" }),
    ).not.toBeInTheDocument();
    assertSettingsAuthLink(loginLink, "/login");
    assertSettingsAuthLink(signupLink, "/signup");
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(discussionReadExecutorMock.executeNostrRead).not.toHaveBeenCalled();
  });

  it("keeps the page spacing while using the default size for the unauthenticated account message", () => {
    mockSettingsUser.isLoggedIn = false;
    mockSettingsUser.pubkey = "";

    render(<SettingsPage />);

    const heading = screen.getByRole("heading", { name: "ログインしていません" });
    expect(heading).not.toHaveClass("text-lg");

    const unauthenticatedContent = heading.parentElement?.parentElement;
    expect(unauthenticatedContent).not.toBeNull();
    if (!unauthenticatedContent) {
      throw new Error("unauthenticated settings content wrapper was not found");
    }
    expect(unauthenticatedContent).not.toHaveClass("py-8");

    const accountCard = heading.closest("div.card");
    expect(accountCard).not.toBeNull();
    if (!accountCard) throw new Error("settings account card was not found");

    const settingsPage = accountCard.parentElement?.parentElement;
    expect(settingsPage).not.toBeNull();
    expect(settingsPage).toHaveClass("py-8");
    expect(screen.getByRole("heading", { name: "アカウント情報" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "アカウント作成" })).toBeInTheDocument();
  });
});
