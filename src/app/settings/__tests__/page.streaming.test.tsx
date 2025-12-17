import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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
      profile: { name: "User" },
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
    streamEventsOnEvent: jest.fn(),
    getDiscussions: jest.fn(),
  };

  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: (value: string) => value,
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("streams user discussions and renders on first event without waiting for EOSE", async () => {
    let streamHandlers: any;

    serviceMock.streamEventsOnEvent.mockImplementation((_filters, handlers) => {
      streamHandlers = handlers;
      return () => {};
    });

    expect(typeof SettingsPage).toBe("function");

    render(<SettingsPage />);

    await waitFor(() =>
      expect(serviceMock.streamEventsOnEvent).toHaveBeenCalled()
    );
    expect(serviceMock.getDiscussions).not.toHaveBeenCalled();

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

    await act(async () => {
      streamHandlers.onEvent?.([mockEvent], mockEvent);
    });

    await waitFor(() =>
      expect(screen.getByText("Demo Discussion")).toBeInTheDocument()
    );
  });
});
