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
  const gatewayMock = {
    queryDiscussionsByAuthorWithCompletion: jest.fn(),
  };

  return {
    createDiscussionNdkGateway: () => gatewayMock,
    __mock: gatewayMock,
  };
});

const { __mock: gatewayMock } = jest.requireMock(
  "@/lib/nostr/discussion-ndk-gateway"
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
    eventCount: events.length,
    elapsedMs: 10,
    startedAt: 1000,
    lastEventAt: 1000,
    eoseReceived: completionReason === "eose",
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays the derived user name with さん and does not display the old profile user name", async () => {
    gatewayMock.queryDiscussionsByAuthorWithCompletion.mockResolvedValue(
      withCompletion([])
    );

    render(<SettingsPage />);

    expect(
      await screen.findByText("あいうえお かきくけこ さしすせそ")
    ).toBeInTheDocument();
    expect(screen.getByText("さん")).toBeInTheDocument();
    expect(screen.queryByText("ユーザー名")).not.toBeInTheDocument();
  });

  it("loads user discussions via completion-aware read and does not use stream API", async () => {
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

    gatewayMock.queryDiscussionsByAuthorWithCompletion.mockResolvedValue(
      withCompletion([mockEvent], "idle-timeout")
    );

    render(<SettingsPage />);

    await waitFor(() =>
      expect(gatewayMock.queryDiscussionsByAuthorWithCompletion).toHaveBeenCalledWith(
        "user-pubkey",
        expect.any(Object)
      )
    );

    await waitFor(() =>
      expect(screen.getByText("Demo Discussion")).toBeInTheDocument()
    );

    expect(nostrServiceMock.publishSignedEvent).not.toHaveBeenCalled();
  });

  it("shows timeout warning when completion-aware read has no events", async () => {
    gatewayMock.queryDiscussionsByAuthorWithCompletion.mockResolvedValue(
      withCompletion([], "hard-timeout")
    );

    render(<SettingsPage />);

    expect(
      await screen.findByText(/会話データの取得に時間がかかっています/)
    ).toBeInTheDocument();
  });
});
