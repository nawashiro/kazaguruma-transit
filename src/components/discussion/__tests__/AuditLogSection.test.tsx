import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuditLogSection } from "../AuditLogSection";
import { formatBip39JapaneseMnemonicPreviewFromPubkey } from "@/lib/nostr/mnemonic-utils";

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
    getEventsWithCompletion: jest.fn(),
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
  AuditTimeline: ({
    items,
  }: {
    items: Array<{ id: string; approvedByMnemonic?: string }>;
  }) => (
    <div>
      <div data-testid="audit-timeline-count">{items.length}</div>
      <div data-testid="audit-timeline-ids">{items.map((item) => item.id).join(",")}</div>
      <div data-testid="audit-timeline-approvers">
        {items
          .map((item) => item.approvedByMnemonic)
          .filter((value): value is string => Boolean(value))
          .join(",")}
      </div>
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

const withCompletion = (events: TestEvent[]) => ({
  events,
  completionReason: "eose",
  eventCount: events.length,
  elapsedMs: 10,
  startedAt: 1000,
  lastEventAt: 1000,
  eoseReceived: true,
});

const createApprovalEvent = (
  id: string,
  createdAt: number,
  postId: string,
  approverPubkey: string
): TestEvent => ({
  id,
  pubkey: approverPubkey,
  created_at: createdAt,
  kind: 4550,
  tags: [
    ["a", "34550:test-pubkey:test-dtag"],
    ["e", postId],
    ["p", "user"],
    ["k", "1111"],
  ],
  content: "approved",
  sig: `sig-${id}`,
});

describe("AuditLogSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serviceMock.getEventsWithCompletion.mockResolvedValue(withCompletion([]));
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1discussionlist";
  });

  it("全件取得し、承認が新しくても主投稿を監査ログへ残す", async () => {
    const firstPage = Array.from({ length: 10 }, (_, i) =>
      createPostEvent(`event-${i + 1}`, 200 - i)
    );
    const approvals = firstPage.map((post, index) =>
      createApprovalEvent(
        `approval-${index + 1}`,
        300 - index,
        post.id,
        "f".repeat(64)
      )
    );
    serviceMock.getEventsWithCompletion
      .mockResolvedValueOnce(withCompletion(firstPage))
      .mockResolvedValueOnce(withCompletion(approvals));

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
      />
    );

    await act(async () => {
      await ref.current?.loadAuditData();
    });

    expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledTimes(2);
    expect(serviceMock.getEventsWithCompletion).toHaveBeenCalledWith(
      [
        {
          kinds: [1111, 1],
          "#a": ["34550:test-pubkey:test-dtag"],
        },
      ],
      {
        idleTimeoutMs: 500,
        hardTimeoutMs: 1500,
      }
    );
    expect(screen.getByTestId("audit-timeline-count")).toHaveTextContent("10");
    expect(screen.queryByRole("button", { name: "さらに過去10件を表示" })).not.toBeInTheDocument();
  });

  it("同時刻の監査イベントをイベントIDで安定して並べる", async () => {
    serviceMock.getEventsWithCompletion.mockResolvedValueOnce(withCompletion([
      createPostEvent("z-event", 200),
      createPostEvent("a-event", 200),
    ]));
    const ref = React.createRef<{ loadAuditData: () => void; retryLoadAuditData: () => void }>();
    render(<AuditLogSection ref={ref} discussion={null} discussionInfo={{ discussionId: "34550:test-pubkey:test-dtag", authorPubkey: "test-pubkey", dTag: "test-dtag" }} />);

    await act(async () => { await ref.current?.loadAuditData(); });

    expect(screen.getByTestId("audit-timeline-ids")).toHaveTextContent("a-event,z-event");
  });

  it("承認済み投稿の承認者Mnemonicをタイムラインへ渡す", async () => {
    const approverPubkey = "f".repeat(64);
    const expectedMnemonic =
      formatBip39JapaneseMnemonicPreviewFromPubkey(approverPubkey);
    const events = [
      createPostEvent("event-approved", 200),
      createApprovalEvent("approval-1", 201, "event-approved", approverPubkey),
    ];
    serviceMock.getEventsWithCompletion.mockResolvedValueOnce(
      withCompletion(events)
    );

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
      />
    );

    await act(async () => {
      await ref.current?.loadAuditData();
    });

    expect(screen.getByTestId("audit-timeline-approvers")).toHaveTextContent(
      expectedMnemonic
    );
  });

});
