import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionEditPage from "../page";
import type { StreamEventsOptions } from "@/lib/nostr/nostr-service";
import type { Discussion } from "@/types/discussion";

const mockUseDiscussionMeta = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      pubkey: "author",
      isLoggedIn: true,
    },
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => mockUseDiscussionMeta(),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "demo",
    authorPubkey: "author",
    discussionId: "34550:author:demo",
  }),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    streamEventsOnEvent: jest.fn(),
    getDiscussions: jest.fn(),
    publishSignedEvent: jest.fn(),
  };

  return {
    createNostrService: () => serviceMock,
    getNostrServiceConfigKey: () => "test-config",
    __mock: serviceMock,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/nostr-utils", () => ({
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
  isValidNpub: () => true,
  npubToHex: (npub: string) => npub,
  getAdminPubkeyHex: () => "a".repeat(64),
  formatRelativeTime: () => "now",
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

describe("DiscussionEditPage streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const layoutDiscussion: Discussion = {
      id: "34550:author:demo",
      title: "Edit Me",
      description: "Updated description",
      authorPubkey: "author",
      dTag: "demo",
      moderators: [],
      createdAt: 123,
      event: {
        id: "event-1",
        pubkey: "author",
        kind: 34550,
        created_at: 123,
        tags: [
          ["d", "demo"],
          ["name", "Edit Me"],
          ["description", "desc"],
        ],
        content: "Updated description",
        sig: "sig",
      },
    };
    mockUseDiscussionMeta.mockReturnValue({
      discussion: layoutDiscussion,
      isLoading: false,
      error: null,
      completionReason: "eose",
      reload: jest.fn(),
    });
  });

  it("streams discussion metadata and renders form without waiting for EOSE", async () => {
    serviceMock.streamEventsOnEvent.mockImplementation(
      (_filters: unknown, handlers: StreamEventsOptions) => {
        handlers.onEose?.([]);
        return () => {};
      }
    );

    render(<DiscussionEditPage />);

    await waitFor(() =>
      expect(serviceMock.streamEventsOnEvent).toHaveBeenCalled()
    );
    expect(serviceMock.getDiscussions).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByLabelText("タイトル *")).toHaveValue("Edit Me")
    );
  });
});
