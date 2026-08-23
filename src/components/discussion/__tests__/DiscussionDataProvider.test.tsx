import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  DiscussionDataProvider,
  useDiscussionContentData,
  useDiscussionMeta,
  useDiscussionManagementData,
} from "../DiscussionDataProvider";
import type { DiscussionPost } from "@/types/discussion";

let pathname = "/discussions/naddr-test";
let mockNaddr = "naddr-test";
let mockKnownData: unknown = null;
let mockIsTestMode = false;
let mockDiscussionInfo: {
  discussionId: string;
  authorPubkey: string;
  dTag: string;
  relays: string[];
} | null = {
  discussionId: "34550:author:topic",
  authorPubkey: "author",
  dTag: "topic",
  relays: [],
};

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useParams: () => ({ naddr: mockNaddr }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({
    relays: [{ url: "wss://relay.example", read: true, write: false }],
    defaultTimeout: 500,
  }),
  getDiscussionReadStrategyConfig: () => ({
    idleTimeoutMs: 500,
    hardTimeoutMs: 1500,
    dedupWindowMs: 250,
  }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => mockDiscussionInfo,
}));

jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => ({
    getEventsWithCompletion: jest.fn(),
  }),
}));

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({
    queryWithCompletion: jest.fn(),
  }),
}));

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: jest.fn(),
}));

jest.mock("@/lib/discussion/discussion-moderation-snapshot", () => ({
  createDiscussionModerationSnapshot: ({
    primaryEvents,
    approvalEvents,
    relayUrls,
    attemptedRelayUrls,
    completionReason,
  }: {
    primaryEvents: unknown[];
    approvalEvents: unknown[];
    relayUrls: string[];
    attemptedRelayUrls: string[];
    completionReason: string;
  }) => ({
    primaryEvents,
    approvalEvents,
    relayUrls,
    initialRelayUrls: relayUrls.slice(0, 3),
    attemptedRelayUrls,
    nextRelayUrls: [],
    successfulRelayUrls: [],
    completionReason,
    approvalState: completionReason === "eose" ? "approved" : "unknown",
  }),
  loadDiscussionModerationSnapshot: jest.fn(),
}));

jest.mock("@/lib/discussion/discussion-known-data-cache", () => ({
  loadKnownDiscussionData: () => mockKnownData,
  saveKnownDiscussionData: jest.fn(),
}));

jest.mock("@/lib/test/test-data-loader", () => ({
  isTestMode: () => mockIsTestMode,
  loadTestData: jest.fn(),
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  npubToHex: (value: string) => value,
  parseApprovalEvent: () => null,
  parseDiscussionEvent: (event: {
    kind: number;
    pubkey: string;
    tags: string[][];
  }) => {
    if (event.kind !== 34550) return null;
    const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (!dTag) return null;
    return {
      id: `34550:${event.pubkey}:${dTag}`,
      dTag,
      title: event.tags.find((tag) => tag[0] === "name")?.[1] ?? dTag,
      description: "説明",
      moderators: [],
      authorPubkey: event.pubkey,
      createdAt: 1,
      event,
    };
  },
  parsePostEvent: jest.fn((event: { kind: number; id: string }) =>
    event.kind === 1111
      ? {
          id: event.id,
          content: "投稿",
          authorPubkey: "author",
          discussionId: "34550:author:topic",
          createdAt: 1,
          approved: true,
          approvedBy: [],
          event,
        }
      : null,
  ),
}));

const { executeNostrRead } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor",
) as { executeNostrRead: jest.Mock };
const { loadDiscussionModerationSnapshot } = jest.requireMock(
  "@/lib/discussion/discussion-moderation-snapshot",
) as { loadDiscussionModerationSnapshot: jest.Mock };
const { loadTestData } = jest.requireMock("@/lib/test/test-data-loader") as {
  loadTestData: jest.Mock;
};
function SharedDataProbe() {
  const meta = useDiscussionMeta();
  const content = useDiscussionContentData();
  return (
    <div>
      <span>{meta?.discussion ? `meta:${meta.discussion.title}` : "meta:none"}</span>
      <span>{meta?.error ? `error:${meta.error}` : "meta-no-error"}</span>
      <span data-testid="meta-completion">{meta?.completionReason ?? "none"}</span>
      <span data-testid="meta-loading">{String(meta?.isLoading ?? false)}</span>
      <span>{`posts:${content.posts.length}`}</span>
      <span data-testid="content-loading">{String(content.isLoading)}</span>
      <span>{`post-state:${content.posts[0]?.approvalState ?? "none"}`}</span>
    </div>
  );
}

function DetailContentProbe() {
  const content = useDiscussionContentData();
  return (
    <div>
      <span data-testid="detail-content-completion">
        {content.completionReason ?? "none"}
      </span>
      <span data-testid="detail-content-posts">
        {content.posts.map((post) => post.id).join(",")}
      </span>
      <button type="button" onClick={() => void content.reload()}>
        reload-detail-content
      </button>
    </div>
  );
}

function ActionProbe() {
  const content = useDiscussionContentData();
  const localPost: DiscussionPost = {
    id: "local-post",
    content: "local",
    authorPubkey: "author",
    discussionId: "34550:author:topic",
    createdAt: 3,
    approved: true,
    approvedBy: [],
    event: {
      id: "local-post",
      kind: 1111,
      pubkey: "author",
      created_at: 3,
      content: "local",
      tags: [["a", "34550:author:topic"]],
      sig: "sig",
    },
  };
  return (
    <div>
      <span>{content.posts.map((post) => post.id).join(",")}</span>
      <span data-testid="content-loading">{String(content.isLoading)}</span>
      <button type="button" onClick={() => content.addPost(localPost)}>
        add-local
      </button>
    </div>
  );
}

function ManagementProbe() {
  const management = useDiscussionManagementData();
  return (
    <div>
      <span>{management.referencedDiscussions.map((item) => item.title).join(",")}</span>
      <button type="button" onClick={() => void management.reloadModeration()}>
        reload-management
      </button>
    </div>
  );
}

function MutationCaptureProbe({
  onCapture,
}: {
  onCapture: (addPost: (post: DiscussionPost) => void) => void;
}) {
  const content = useDiscussionContentData();
  React.useEffect(() => {
    onCapture(content.addPost);
  }, [content.addPost, onCapture]);
  return <span>{content.posts.map((post) => post.id).join(",")}</span>;
}

function ReloadAndMutationProbe({
  onReload,
  onAddPost,
}: {
  onReload: (reload: (() => Promise<void>) | undefined) => void;
  onAddPost: (addPost: (post: DiscussionPost) => void) => void;
}) {
  const meta = useDiscussionMeta();
  const content = useDiscussionContentData();
  React.useEffect(() => {
    onReload(meta?.reload);
    onAddPost(content.addPost);
  }, [content.addPost, meta?.reload, onAddPost, onReload]);
  return (
    <div>
      <span>{meta?.discussion?.title ?? "no-discussion"}</span>
      <span>{content.posts.map((post) => post.id).join(",")}</span>
    </div>
  );
}

describe("DiscussionDataProvider", () => {
  beforeEach(() => {
    pathname = "/discussions/naddr-test";
    mockNaddr = "naddr-test";
    mockKnownData = null;
    mockIsTestMode = false;
    loadTestData.mockReset();
    mockDiscussionInfo = {
      discussionId: "34550:author:topic",
      authorPubkey: "author",
      dTag: "topic",
      relays: [],
    };
    executeNostrRead.mockReset().mockResolvedValue({
      events: [
        {
          id: "discussion-event",
          kind: 34550,
          pubkey: "author",
          created_at: 1,
          content: "説明",
          tags: [["d", "topic"], ["name", "共有会話"]],
          sig: "sig",
        },
      ],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 1,
      attemptedRelayUrls: ["wss://relay.example"],
      successfulEventRelayUrls: ["wss://relay.example"],
      sourceRelayUrlsByEventId: { "discussion-event": ["wss://relay.example"] },
      attempts: [],
    });
    loadDiscussionModerationSnapshot.mockReset().mockResolvedValue({
      primaryEvents: [
        {
          id: "post-1",
          kind: 1111,
          pubkey: "author",
          created_at: 2,
          content: "投稿",
          tags: [["a", "34550:author:topic"]],
          sig: "sig",
        },
      ],
      approvalEvents: [],
      relayUrls: ["wss://relay.example"],
      initialRelayUrls: ["wss://relay.example"],
      attemptedRelayUrls: ["wss://relay.example"],
      nextRelayUrls: [],
      successfulRelayUrls: ["wss://relay.example"],
      completionReason: "eose",
      approvalState: "approved",
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
  });

  it("shares one metadata/content read lifecycle with both display consumers", async () => {
    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    expect(await screen.findByText("meta:共有会話")).toBeInTheDocument();
    expect(executeNostrRead).toHaveBeenCalledTimes(1);
    expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("posts:1")).toBeInTheDocument();
  });

  it("shows primary posts provisionally while approval reads remain incomplete", async () => {
    let resolveSnapshot: ((value: unknown) => void) | undefined;
    const primaryEvent = {
      id: "primary-post",
      kind: 1111,
      pubkey: "author",
      created_at: 2,
      content: "primary",
      tags: [["a", "34550:author:topic"]],
      sig: "sig",
    };
    loadDiscussionModerationSnapshot.mockImplementationOnce(
      (_service, _strategy, input) => {
        (input as { onPrimaryComplete?: (result: unknown) => void }).onPrimaryComplete?.({
          events: [primaryEvent],
          completionReason: "eose",
          duplicateCount: 0,
          elapsedMs: 1,
          attemptedRelayUrls: [],
          successfulEventRelayUrls: [],
          sourceRelayUrlsByEventId: {},
          attempts: [],
        });
        return new Promise((resolve) => {
          resolveSnapshot = resolve;
        });
      },
    );

    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    expect(await screen.findByText("posts:1")).toBeInTheDocument();
    expect(screen.getByText("post-state:unknown")).toBeInTheDocument();
    expect(screen.getByTestId("content-loading")).toHaveTextContent("false");
    resolveSnapshot?.({
      primaryEvents: [primaryEvent],
      approvalEvents: [],
      relayUrls: ["wss://relay.example"],
      initialRelayUrls: ["wss://relay.example"],
      attemptedRelayUrls: ["wss://relay.example"],
      nextRelayUrls: [],
      successfulRelayUrls: [],
      completionReason: "idle-timeout",
      approvalState: "unknown",
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("hydrates cached metadata and events provisionally before relay reads finish", async () => {
    let resolveMetadata: ((value: unknown) => void) | undefined;
    mockKnownData = {
      version: 1,
      savedAt: Date.now(),
      metadata: {
        id: "34550:author:topic",
        dTag: "topic",
        title: "Cached conversation",
        description: "cached",
        moderators: [],
        authorPubkey: "author",
        createdAt: 1,
        event: {
          id: "cached-meta",
          kind: 34550,
          pubkey: "author",
          created_at: 1,
          content: "cached",
          tags: [["d", "topic"], ["name", "Cached conversation"]],
          sig: "sig",
        },
      },
      eventIds: ["cached-post"],
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      successfulRelays: [],
      events: [{
        id: "cached-post",
        kind: 1111,
        pubkey: "author",
        created_at: 2,
        content: "cached post",
        tags: [["a", "34550:author:topic"]],
        sig: "sig",
      }],
    };
    executeNostrRead.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveMetadata = resolve;
      }),
    );

    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    expect(await screen.findByText("meta:Cached conversation")).toBeInTheDocument();
    expect(await screen.findByText("posts:1")).toBeInTheDocument();
    expect(screen.getByTestId("meta-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("content-loading")).toHaveTextContent("false");
    expect(screen.getByText("post-state:unknown")).toBeInTheDocument();
    expect(executeNostrRead).toHaveBeenCalledTimes(1);
    expect(resolveMetadata).toBeDefined();
    await act(async () => {
      resolveMetadata?.({
        events: [],
        completionReason: "eose",
        duplicateCount: 0,
        elapsedMs: 1,
        attemptedRelayUrls: [],
        successfulEventRelayUrls: [],
        sourceRelayUrlsByEventId: {},
        attempts: [],
      });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("uses the test discussion fixture without live reads in test mode", async () => {
    mockIsTestMode = true;
    loadTestData.mockResolvedValue({
      discussion: {
        id: "34550:author:topic",
        dTag: "topic",
        title: "Fixture conversation",
        description: "fixture",
        moderators: [],
        authorPubkey: "author",
        createdAt: 1,
        event: null,
      },
      posts: [{
        id: "fixture-post",
        content: "fixture post",
        authorPubkey: "author",
        discussionId: "34550:author:topic",
        createdAt: 1,
        approved: true,
        approvedBy: [],
        event: {
          id: "fixture-post",
          kind: 1111,
          pubkey: "author",
          created_at: 1,
          content: "fixture post",
          tags: [["a", "34550:author:topic"]],
          sig: "sig",
        },
      }],
      evaluations: [],
    });

    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    expect(await screen.findByText("meta:Fixture conversation")).toBeInTheDocument();
    expect(await screen.findByText("posts:1")).toBeInTheDocument();
    expect(executeNostrRead).not.toHaveBeenCalled();
    expect(loadDiscussionModerationSnapshot).not.toHaveBeenCalled();
  });

  it("shares one content read between the main and approve detail tabs", async () => {
    const { rerender } = render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1));

    pathname = "/discussions/naddr-test/approve";
    rerender(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/discussions/naddr-test/moderators",
    "/discussions/naddr-test/edit",
  ])("loads shared detail content on %s", async (detailPath) => {
    pathname = detailPath;
    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(executeNostrRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1));
  });

  it("keeps one shared detail content lifecycle across main and moderator tabs", async () => {
    const { rerender } = render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    await waitFor(() => expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("posts:1")).toBeInTheDocument();

    pathname = "/discussions/naddr-test/moderators";
    rerender(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    pathname = "/discussions/naddr-test";
    rerender(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByText("posts:1")).toBeInTheDocument();
  });

  it("preserves provisional detail content through a moderator tab transition", async () => {
    const primaryEvent = {
      id: "partial-post",
      kind: 1111,
      pubkey: "author",
      created_at: 2,
      content: "暫定投稿",
      tags: [["a", "34550:author:topic"]],
      sig: "sig",
    };
    const partialResult = {
      primaryEvents: [primaryEvent],
      approvalEvents: [],
      relayUrls: ["wss://relay.example"],
      initialRelayUrls: ["wss://relay.example"],
      attemptedRelayUrls: ["wss://relay.example"],
      nextRelayUrls: [],
      successfulRelayUrls: [],
      completionReason: "idle-timeout",
      approvalState: "unknown",
    };
    loadDiscussionModerationSnapshot.mockImplementationOnce(
      (_service, _strategy, input) => {
        (input as { onPrimaryComplete?: (result: unknown) => void }).onPrimaryComplete?.({
          events: [primaryEvent],
          completionReason: "idle-timeout",
          duplicateCount: 0,
          elapsedMs: 1,
          attemptedRelayUrls: ["wss://relay.example"],
          successfulEventRelayUrls: [],
          sourceRelayUrlsByEventId: {},
          attempts: [],
        });
        return Promise.resolve(partialResult);
      },
    );

    const { rerender } = render(
      <DiscussionDataProvider>
        <DetailContentProbe />
      </DiscussionDataProvider>,
    );

    expect(await screen.findByTestId("detail-content-posts")).toHaveTextContent(
      "partial-post",
    );
    expect(screen.getByTestId("detail-content-completion")).toHaveTextContent(
      "idle-timeout",
    );

    pathname = "/discussions/naddr-test/moderators";
    rerender(
      <DiscussionDataProvider>
        <DetailContentProbe />
      </DiscussionDataProvider>,
    );
    pathname = "/discussions/naddr-test";
    rerender(
      <DiscussionDataProvider>
        <DetailContentProbe />
      </DiscussionDataProvider>,
    );

    expect(screen.getByTestId("detail-content-posts")).toHaveTextContent("partial-post");
    expect(screen.getByTestId("detail-content-completion")).toHaveTextContent(
      "idle-timeout",
    );
    fireEvent.click(screen.getByRole("button", { name: "reload-detail-content" }));
    await waitFor(() => expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(2));
  });

  it("loads management content through the shared lifecycle on the moderator tab", async () => {
    pathname = "/discussions/moderator";
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1list";
    render(
      <DiscussionDataProvider scope="management">
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(executeNostrRead).toHaveBeenCalledTimes(1));
    expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1);
  });

  it("deduplicates management references into one filter per discussion", async () => {
    pathname = "/discussions/manage";
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1list";
    const referenceA = `34550:${"a".repeat(64)}:topic-a`;
    const referenceB = `34550:${"b".repeat(64)}:topic-b`;
    loadDiscussionModerationSnapshot.mockResolvedValue({
      primaryEvents: [{
        id: "listing-post",
        kind: 1111,
        pubkey: "author",
        created_at: 2,
        content: "掲載",
        tags: [
          ["a", "34550:author:topic"],
          ["q", referenceA],
          ["q", referenceA],
          ["q", referenceB],
        ],
        sig: "sig",
      }],
      approvalEvents: [],
      relayUrls: ["wss://relay.example"],
      initialRelayUrls: ["wss://relay.example"],
      attemptedRelayUrls: ["wss://relay.example"],
      nextRelayUrls: [],
      successfulRelayUrls: [],
      completionReason: "eose",
      approvalState: "approved",
    });

    render(
      <DiscussionDataProvider scope="management">
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(executeNostrRead).toHaveBeenCalledTimes(2));
    expect(executeNostrRead.mock.calls[1]?.[1].plan.filters).toEqual([
      {
        kinds: [34550],
        authors: ["a".repeat(64)],
        "#d": ["topic-a"],
        limit: 1,
      },
      {
        kinds: [34550],
        authors: ["b".repeat(64)],
        "#d": ["topic-b"],
        limit: 1,
      },
    ]);
  });

  it("rejects metadata events that do not match the requested address", async () => {
    executeNostrRead.mockResolvedValueOnce({
      events: [{
        id: "other-discussion",
        kind: 34550,
        pubkey: "other-author",
        created_at: 99,
        content: "別会話",
        tags: [["d", "other-topic"], ["name", "別会話"]],
        sig: "sig",
      }],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 1,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    });

    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    await waitFor(() => {
      expect(executeNostrRead).toHaveBeenCalledTimes(1);
      expect(screen.getByText("error:会話情報が見つかりませんでした。")).toBeInTheDocument();
    });
    expect(screen.queryByText("meta:別会話")).not.toBeInTheDocument();
  });

  it("does not classify a partial metadata read as not-found", async () => {
    executeNostrRead.mockResolvedValueOnce({
      events: [],
      completionReason: "idle-timeout",
      duplicateCount: 0,
      elapsedMs: 1,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    });

    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    await waitFor(() => {
      expect(executeNostrRead).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("meta-completion")).toHaveTextContent("idle-timeout");
    });
    expect(screen.queryByText("error:会話情報が見つかりませんでした。")).not.toBeInTheDocument();
  });

  it("keeps management metadata relay hints while using the shared lifecycle", async () => {
    pathname = "/discussions";
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1list";
    mockDiscussionInfo = {
      discussionId: "34550:author:topic",
      authorPubkey: "author",
      dTag: "topic",
      relays: ["wss://hint.example"],
    };

    render(
      <DiscussionDataProvider scope="management">
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    await waitFor(() => expect(executeNostrRead).toHaveBeenCalledTimes(1));
    expect(executeNostrRead.mock.calls[0]?.[1].relayUrls).toEqual(
      expect.arrayContaining(["wss://hint.example"]),
    );
    expect(loadDiscussionModerationSnapshot.mock.calls[0]?.[2].relayUrls).toEqual(
      ["wss://relay.example"],
    );
    delete process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
  });

  it("keeps cached metadata hint relays out of management content reads", async () => {
    pathname = "/discussions";
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1list";
    mockDiscussionInfo = {
      discussionId: "34550:author:topic",
      authorPubkey: "author",
      dTag: "topic",
      relays: ["wss://naddr-hint.example"],
    };
    mockKnownData = {
      version: 1,
      savedAt: Date.now(),
      metadata: null,
      eventIds: [],
      attemptedRelayUrls: [],
      successfulEventRelayUrls: ["wss://naddr-hint.example/"],
      successfulRelays: [],
      events: [],
    };

    render(
      <DiscussionDataProvider scope="management">
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    await waitFor(() => expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1));
    expect(loadDiscussionModerationSnapshot.mock.calls[0]?.[2].relayUrls).toEqual(
      ["wss://relay.example"],
    );
  });

  it("preserves the new route when an older metadata read resolves late", async () => {
    let resolveOldMetadata: ((value: unknown) => void) | undefined;
    const newMetadata = {
      events: [{
        id: "new-discussion",
        kind: 34550,
        pubkey: "new-author",
        created_at: 2,
        content: "新説明",
        tags: [["d", "new-topic"], ["name", "新会話"]],
        sig: "sig",
      }],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 1,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    };
    executeNostrRead
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveOldMetadata = resolve;
        }),
      )
      .mockResolvedValueOnce(newMetadata);

    const { rerender } = render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(executeNostrRead).toHaveBeenCalledTimes(1));

    mockNaddr = "naddr-new";
    mockDiscussionInfo = {
      discussionId: "34550:new-author:new-topic",
      authorPubkey: "new-author",
      dTag: "new-topic",
      relays: [],
    };
    rerender(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    expect(await screen.findByText("meta:新会話")).toBeInTheDocument();
    await act(async () => {
      resolveOldMetadata?.({
        events: [{
          id: "old-discussion",
          kind: 34550,
          pubkey: "author",
          created_at: 1,
          content: "旧説明",
          tags: [["d", "topic"], ["name", "旧会話"]],
          sig: "sig",
        }],
        completionReason: "eose",
        duplicateCount: 0,
        elapsedMs: 1,
        attemptedRelayUrls: [],
        successfulEventRelayUrls: [],
        sourceRelayUrlsByEventId: {},
        attempts: [],
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("meta:新会話")).toBeInTheDocument();
  });

  it("reports an invalid target without starting metadata or content reads", async () => {
    mockNaddr = "naddr-invalid";
    mockDiscussionInfo = null;

    render(
      <DiscussionDataProvider>
        <SharedDataProbe />
      </DiscussionDataProvider>,
    );

    expect(await screen.findByText("error:会話情報の指定が正しくありません。")).toBeInTheDocument();
    expect(executeNostrRead).not.toHaveBeenCalled();
    expect(loadDiscussionModerationSnapshot).not.toHaveBeenCalled();
  });

  it("ignores a stale referenced-discussion read after management reload", async () => {
    pathname = "/discussions";
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1list";
    mockDiscussionInfo = {
      discussionId: "34550:author:topic",
      authorPubkey: "author",
      dTag: "topic",
      relays: [],
    };
    const referenceId = `34550:${"a".repeat(64)}:old-topic`;
    loadDiscussionModerationSnapshot.mockResolvedValue({
      primaryEvents: [{
        id: "listing-post",
        kind: 1111,
        pubkey: "author",
        created_at: 2,
        content: "掲載",
        tags: [
          ["a", "34550:author:topic"],
          ["q", referenceId],
        ],
        sig: "sig",
      }],
      approvalEvents: [],
      relayUrls: ["wss://relay.example"],
      initialRelayUrls: ["wss://relay.example"],
      attemptedRelayUrls: ["wss://relay.example"],
      nextRelayUrls: [],
      successfulRelayUrls: [],
      completionReason: "eose",
      approvalState: "approved",
    });
    let resolveReference: ((value: unknown) => void) | undefined;
    const managementMetadataResult = {
      events: [{
        id: "discussion-event",
        kind: 34550,
        pubkey: "author",
        created_at: 1,
        content: "説明",
        tags: [["d", "topic"], ["name", "共有会話"]],
        sig: "sig",
      }],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 1,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    };
    executeNostrRead.mockReset().mockResolvedValue(managementMetadataResult);
    executeNostrRead.mockImplementationOnce(() =>
      Promise.resolve(managementMetadataResult),
    );
    executeNostrRead.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveReference = resolve;
      }),
    );

    render(
      <DiscussionDataProvider scope="management">
        <ManagementProbe />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(executeNostrRead).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "reload-management" }));
    await waitFor(() => expect(executeNostrRead).toHaveBeenCalledTimes(4));

    await act(async () => {
      resolveReference?.({
        events: [{
          id: "old-reference",
          kind: 34550,
          pubkey: "a".repeat(64),
          created_at: 3,
          content: "Old reference",
          tags: [["d", "old-topic"], ["name", "Old reference"]],
          sig: "sig",
        }],
        completionReason: "eose",
        duplicateCount: 0,
        elapsedMs: 1,
        attemptedRelayUrls: [],
        successfulEventRelayUrls: [],
        sourceRelayUrlsByEventId: {},
        attempts: [],
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText("Old reference")).not.toBeInTheDocument();
  });

  it("ignores a mutation callback retained from a previous route", async () => {
    let oldAddPost: ((post: DiscussionPost) => void) | undefined;
    const capture = (addPost: (post: DiscussionPost) => void) => {
      if (!oldAddPost) oldAddPost = addPost;
    };
    const { rerender } = render(
      <DiscussionDataProvider>
        <MutationCaptureProbe onCapture={capture} />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(oldAddPost).toBeDefined());

    mockNaddr = "naddr-new";
    mockDiscussionInfo = {
      discussionId: "34550:new-author:new-topic",
      authorPubkey: "new-author",
      dTag: "new-topic",
      relays: [],
    };
    executeNostrRead.mockResolvedValue({
      events: [{
        id: "new-discussion",
        kind: 34550,
        pubkey: "new-author",
        created_at: 2,
        content: "新説明",
        tags: [["d", "new-topic"], ["name", "新会話"]],
        sig: "sig",
      }],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 1,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    });
    rerender(
      <DiscussionDataProvider>
        <MutationCaptureProbe onCapture={capture} />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(oldAddPost).toBeDefined());

    await act(async () => {
      oldAddPost?.({
        id: "stale-post",
        content: "stale",
        authorPubkey: "author",
        discussionId: "34550:author:topic",
        createdAt: 3,
        approved: true,
        approvedBy: [],
        event: {
          id: "stale-post",
          kind: 1111,
          pubkey: "author",
          created_at: 3,
          content: "stale",
          tags: [["a", "34550:author:topic"]],
          sig: "sig",
        },
      });
      await Promise.resolve();
    });
    expect(screen.queryByText("stale-post")).not.toBeInTheDocument();
  });

  it("ignores a reload callback retained from a previous route", async () => {
    let oldReload: (() => Promise<void>) | undefined;
    const capture = (reload: (() => Promise<void>) | undefined) => {
      if (!oldReload && reload) oldReload = reload;
    };
    const ignoreAddPost = jest.fn();
    const { rerender } = render(
      <DiscussionDataProvider>
        <ReloadAndMutationProbe
          onReload={capture}
          onAddPost={ignoreAddPost}
        />
      </DiscussionDataProvider>,
    );
    await waitFor(() => expect(oldReload).toBeDefined());

    mockNaddr = "naddr-new";
    mockDiscussionInfo = {
      discussionId: "34550:new-author:new-topic",
      authorPubkey: "new-author",
      dTag: "new-topic",
      relays: [],
    };
    executeNostrRead.mockResolvedValue({
      events: [{
        id: "new-discussion",
        kind: 34550,
        pubkey: "new-author",
        created_at: 2,
        content: "新説明",
        tags: [["d", "new-topic"], ["name", "新会話"]],
        sig: "sig",
      }],
      completionReason: "eose",
      duplicateCount: 0,
      elapsedMs: 1,
      attemptedRelayUrls: [],
      successfulEventRelayUrls: [],
      sourceRelayUrlsByEventId: {},
      attempts: [],
    });
    rerender(
      <DiscussionDataProvider>
        <ReloadAndMutationProbe
          onReload={capture}
          onAddPost={ignoreAddPost}
        />
      </DiscussionDataProvider>,
    );
    await screen.findByText("新会話");
    const callsAfterRouteChange = executeNostrRead.mock.calls.length;

    await act(async () => {
      await oldReload?.();
      await Promise.resolve();
    });
    expect(executeNostrRead).toHaveBeenCalledTimes(callsAfterRouteChange);
  });

  it("ignores a mutation callback from before a same-discussion reload", async () => {
    let oldReload: (() => Promise<void>) | undefined;
    let oldAddPost: ((post: DiscussionPost) => void) | undefined;
    const captureReload = (reload: (() => Promise<void>) | undefined) => {
      if (!oldReload && reload) oldReload = reload;
    };
    const captureAddPost = (addPost: (post: DiscussionPost) => void) => {
      if (!oldAddPost) oldAddPost = addPost;
    };
    render(
      <DiscussionDataProvider>
        <ReloadAndMutationProbe
          onReload={captureReload}
          onAddPost={captureAddPost}
        />
      </DiscussionDataProvider>,
    );
    await waitFor(() => {
      expect(oldReload).toBeDefined();
      expect(oldAddPost).toBeDefined();
    });

    await act(async () => {
      await oldReload?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      oldAddPost?.({
        id: "post-before-reload",
        content: "stale",
        authorPubkey: "author",
        discussionId: "34550:author:topic",
        createdAt: 3,
        approved: true,
        approvedBy: [],
        event: {
          id: "post-before-reload",
          kind: 1111,
          pubkey: "author",
          created_at: 3,
          content: "stale",
          tags: [["a", "34550:author:topic"]],
          sig: "sig",
        },
      });
      await Promise.resolve();
    });
    expect(screen.queryByText("post-before-reload")).not.toBeInTheDocument();
  });

  it("preserves a locally added post when the initial content read completes", async () => {
    let resolveContent: ((value: unknown) => void) | undefined;
    loadDiscussionModerationSnapshot.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveContent = resolve;
      }),
    );

    render(
      <DiscussionDataProvider>
        <ActionProbe />
      </DiscussionDataProvider>,
    );

    await waitFor(() => expect(loadDiscussionModerationSnapshot).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "add-local" }));
    expect(await screen.findByText("local-post")).toBeInTheDocument();

    await act(async () => {
      resolveContent?.({
        primaryEvents: [],
        approvalEvents: [],
        relayUrls: ["wss://relay.example"],
        initialRelayUrls: ["wss://relay.example"],
        attemptedRelayUrls: ["wss://relay.example"],
        nextRelayUrls: [],
        successfulRelayUrls: [],
        completionReason: "eose",
        approvalState: "unapproved",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId("content-loading")).toHaveTextContent("false"),
    );
    expect(screen.getByText("local-post")).toBeInTheDocument();
  });
});
