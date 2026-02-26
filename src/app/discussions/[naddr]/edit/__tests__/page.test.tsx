import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionEditPage from "../page";

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

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ defaultTimeout: 10 }),
}));

jest.mock("@/lib/nostr/nostr-service", () => ({
  __mock: {
    publishSignedEvent: jest.fn(async () => true),
  },
  createNostrService: () => ({
    streamEventsOnEvent: (_filters: unknown, handlers: { onEose?: (events: unknown[]) => void }) => {
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
      return () => undefined;
    },
    publishSignedEvent:
      jest.requireMock("@/lib/nostr/nostr-service").__mock
        .publishSignedEvent,
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
  parseDiscussionEvent: () => ({
    id: "34550:f:test-discussion",
    title: "Test Discussion",
    description: "Test Description",
    authorPubkey: "f".repeat(64),
    dTag: "test-discussion",
    moderators: [],
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
}));

jest.mock("@/lib/discussion/user-creation-flow", () => ({
  createDiscussionListingRequest: (...args: unknown[]) =>
    (createDiscussionListingRequestMock as (...mockArgs: unknown[]) => unknown)(
      ...args
    ),
  createModeratorPromotionRequestEvent: (...args: unknown[]) =>
    (createModeratorPromotionRequestMock as (
      ...mockArgs: unknown[]
    ) => unknown)(...args),
}));

jest.mock("@/components/discussion/LoginModal", () => ({
  LoginModal: () => <div>Login Modal</div>,
}));

describe("DiscussionEditPage listing request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.user = {
      pubkey: "f".repeat(64),
      isLoggedIn: true,
    };
  });

  it("publishes listing request from edit page", async () => {
    render(<DiscussionEditPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "会話一覧へ掲載申請" })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "会話一覧へ掲載申請" }));

    await waitFor(() =>
      expect(createDiscussionListingRequestMock).toHaveBeenCalled()
    );
    expect(signEventMock).toHaveBeenCalled();
    expect(
      jest.requireMock("@/lib/nostr/nostr-service").__mock.publishSignedEvent
    ).toHaveBeenCalled();
    expect(await screen.findByText("会話一覧への掲載を申請しました")).toBeInTheDocument();
  });

  it("allows non-author users to send moderator promotion request", async () => {
    authState.user = {
      pubkey: "e".repeat(64),
      isLoggedIn: true,
    };

    render(<DiscussionEditPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "モデレーター昇格を申請" })
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "モデレーター昇格を申請" }));

    await waitFor(() =>
      expect(createModeratorPromotionRequestMock).toHaveBeenCalledWith(
        "34550:f:test-discussion",
        "f".repeat(64),
        "e".repeat(64),
        ""
      )
    );
    expect(signEventMock).toHaveBeenCalled();
    expect(
      jest.requireMock("@/lib/nostr/nostr-service").__mock.publishSignedEvent
    ).toHaveBeenCalled();
    expect(
      await screen.findByText("モデレーター昇格申請を送信しました")
    ).toBeInTheDocument();
  });
});
