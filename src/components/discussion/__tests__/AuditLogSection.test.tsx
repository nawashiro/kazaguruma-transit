import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuditLogSection } from "../AuditLogSection";

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: "list",
    authorPubkey: "admin",
    discussionId: "34550:admin:list",
  }),
}));

jest.mock("@/lib/test/test-data-loader", () => ({
  isTestMode: () => false,
  loadTestData: jest.fn(),
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parsePostEvent: jest.fn((event: { id: string; created_at: number }) => ({
    id: event.id,
    createdAt: event.created_at,
    content: "post",
    authorPubkey: "user",
    authorName: "user",
    parentId: null,
    tags: [],
    event,
  })),
  parseApprovalEvent: jest.fn(() => null),
  parseDiscussionEvent: jest.fn(() => ({
    id: "34550:pubkey:dtag",
    dTag: "dtag",
    title: "discussion",
    description: "",
    moderators: [],
    authorPubkey: "pubkey",
    createdAt: 1000,
    event: {} as any,
  })),
  createAuditTimeline: jest.fn(
    (
      _discussions: unknown[],
      _evaluations: unknown[],
      posts: Array<{ id: string; createdAt: number; event: { id: string } }>
    ) =>
      posts.map((post) => ({
        id: post.id,
        type: "post-submitted",
        timestamp: post.createdAt,
        actorPubkey: "actor",
        description: "desc",
        event: { id: post.event.id },
      }))
  ),
}));

jest.mock("@/lib/nostr/nostr-service", () => {
  const serviceMock = {
    getEventsOnEose: jest.fn(),
    getProfile: jest.fn().mockResolvedValue([]),
    getReferencedUserDiscussions: jest.fn().mockResolvedValue([]),
  };

  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

jest.mock("@/components/discussion/AuditTimeline", () => ({
  __esModule: true,
  AuditTimeline: ({ items }: { items: Array<{ id: string }> }) => (
    <div>
      <div data-testid="audit-timeline-count">{items.length}</div>
      <div data-testid="audit-timeline-ids">{items.map((item) => item.id).join(",")}</div>
    </div>
  ),
}));

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

type TestEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

const createPostEvent = (id: string, createdAt: number): TestEvent => ({
  id,
  pubkey: "user",
  created_at: createdAt,
  kind: 1111,
  tags: [["a", "34550:test-pubkey:test-dtag"]],
  content: "post",
  sig: `sig-${id}`,
});

describe("AuditLogSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1discussionlist";
  });

  it("初回取得でlimit=10を指定して通信する", async () => {
    const firstPage = Array.from({ length: 10 }, (_, i) =>
      createPostEvent(`event-${i + 1}`, 200 - i)
    );
    serviceMock.getEventsOnEose.mockResolvedValueOnce(firstPage);

    const ref = React.createRef<{
      loadAuditData: () => void;
      retryLoadAuditData: () => void;
    }>();
    render(
      <AuditLogSection
        ref={ref}
        discussion={{
          id: "34550:test-pubkey:test-dtag",
          dTag: "test-dtag",
          title: "Test Discussion",
          description: "",
          moderators: [],
          authorPubkey: "test-pubkey",
          createdAt: 1234567890,
          event: {} as any,
        }}
        discussionInfo={{
          discussionId: "34550:test-pubkey:test-dtag",
          authorPubkey: "test-pubkey",
          dTag: "test-dtag",
        }}
        initialVisibleCount={10}
      />
    );

    await act(async () => {
      await ref.current?.loadAuditData();
    });

    expect(serviceMock.getEventsOnEose).toHaveBeenCalledTimes(1);
    expect(serviceMock.getEventsOnEose).toHaveBeenCalledWith([
      {
        kinds: [1111, 1, 4550],
        "#a": ["34550:test-pubkey:test-dtag"],
        limit: 10,
      },
    ]);
    expect(screen.getByTestId("audit-timeline-count")).toHaveTextContent("10");
    expect(screen.getByRole("button", { name: "さらに過去10件を表示" })).toBeEnabled();
  });

  it("追加取得でuntilカーソルを使って再クエリし、件数を増やす", async () => {
    const firstPage = Array.from({ length: 10 }, (_, i) =>
      createPostEvent(`event-${i + 1}`, 200 - i)
    );
    const secondPage = [
      createPostEvent("event-11", 189),
      createPostEvent("event-12", 188),
      createPostEvent("event-13", 187),
    ];
    serviceMock.getEventsOnEose
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const ref = React.createRef<{
      loadAuditData: () => void;
      retryLoadAuditData: () => void;
    }>();
    render(
      <AuditLogSection
        ref={ref}
        discussion={{
          id: "34550:test-pubkey:test-dtag",
          dTag: "test-dtag",
          title: "Test Discussion",
          description: "",
          moderators: [],
          authorPubkey: "test-pubkey",
          createdAt: 1234567890,
          event: {} as any,
        }}
        discussionInfo={{
          discussionId: "34550:test-pubkey:test-dtag",
          authorPubkey: "test-pubkey",
          dTag: "test-dtag",
        }}
        initialVisibleCount={10}
      />
    );

    await act(async () => {
      await ref.current?.loadAuditData();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "さらに過去10件を表示" }));
    });

    expect(serviceMock.getEventsOnEose).toHaveBeenCalledTimes(2);
    expect(serviceMock.getEventsOnEose).toHaveBeenNthCalledWith(2, [
      {
        kinds: [1111, 1, 4550],
        "#a": ["34550:test-pubkey:test-dtag"],
        limit: 10,
        until: 190,
      },
    ]);
    expect(screen.getByTestId("audit-timeline-count")).toHaveTextContent("13");
    expect(screen.getByRole("button", { name: "さらに過去10件を表示" })).toBeDisabled();
  });

  it("追加取得で重複イベントIDをマージ時に除外する", async () => {
    const firstPage = [
      createPostEvent("duplicate", 200),
      createPostEvent("unique-1", 199),
      createPostEvent("unique-2", 198),
      createPostEvent("unique-3", 197),
      createPostEvent("unique-4", 196),
      createPostEvent("unique-5", 195),
      createPostEvent("unique-6", 194),
      createPostEvent("unique-7", 193),
      createPostEvent("unique-8", 192),
      createPostEvent("unique-9", 191),
    ];
    const secondPage = [
      createPostEvent("duplicate", 200),
      createPostEvent("older-1", 190),
      createPostEvent("older-2", 189),
    ];

    serviceMock.getEventsOnEose
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const ref = React.createRef<{
      loadAuditData: () => void;
      retryLoadAuditData: () => void;
    }>();
    render(
      <AuditLogSection
        ref={ref}
        discussion={{
          id: "34550:test-pubkey:test-dtag",
          dTag: "test-dtag",
          title: "Test Discussion",
          description: "",
          moderators: [],
          authorPubkey: "test-pubkey",
          createdAt: 1234567890,
          event: {} as any,
        }}
        discussionInfo={{
          discussionId: "34550:test-pubkey:test-dtag",
          authorPubkey: "test-pubkey",
          dTag: "test-dtag",
        }}
        initialVisibleCount={10}
      />
    );

    await act(async () => {
      await ref.current?.loadAuditData();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "さらに過去10件を表示" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("audit-timeline-ids")).toHaveTextContent("duplicate");
    });

    const ids = screen.getByTestId("audit-timeline-ids").textContent?.split(",") ?? [];
    const duplicateCount = ids.filter((id) => id === "duplicate").length;
    expect(duplicateCount).toBe(1);
  });
});
