import path from "node:path";
import React, { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import type { PostApproval } from "@/types/discussion";

let pathname = "/discussions/naddr-test";
let mockNaddr = "naddr-test";

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
    idleTimeoutMs: 100,
    hardTimeoutMs: 300,
    dedupWindowMs: 0,
  }),
}));

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () =>
    mockNaddr === "naddr-new"
      ? {
          discussionId: "34550:author:new-topic",
          authorPubkey: "author",
          dTag: "new-topic",
          relays: ["wss://hint.example"],
        }
      : {
          discussionId: "34550:author:topic",
          authorPubkey: "author",
          dTag: "topic",
          relays: ["wss://hint.example"],
        },
}));

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({ queryWithCompletion: jest.fn() }),
}));

jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => ({
    getEventsWithCompletion: jest.fn(),
    publishSignedEvent: jest.fn(),
  }),
}));

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: jest.fn(),
}));

const { executeNostrRead } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor",
) as { executeNostrRead: jest.Mock };

type DetailModel = {
  state: "loading" | "ready" | "partial" | "error";
  snapshot: {
    discussion: { title: string } | null;
    posts: Array<{ id: string }>;
    approvals: Array<{ id: string }>;
    moderatorRequests: Array<{ id: string }>;
    userEvaluationIds: Set<string>;
  } | null;
  error: string | null;
  reload: () => Promise<void>;
  addPost: (post: unknown) => void;
  addApproval: (approval: unknown) => void;
  removeApproval: (approvalId: string) => void;
};

type DetailProviderModule = {
  DiscussionDetailProvider?: React.ComponentType<{
    children: React.ReactNode;
    userPubkey?: string | null;
  }>;
  useDiscussionDetail?: () => DetailModel;
};

const providerPath = path.join(
  process.cwd(),
  "src/components/discussion/DiscussionDetailProvider",
);

const loadProvider = (): DetailProviderModule => {
  try {
    const loaded = jest.requireActual(providerPath) as unknown;
    if (!loaded || typeof loaded !== "object") {
      throw new Error("The detail provider module did not export an object");
    }
    return loaded as DetailProviderModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Cannot find module") && message.includes("DiscussionDetailProvider")) {
      throw new Error(
        "T013 RED: DiscussionDetailProvider public module is not implemented",
      );
    }
    throw error;
  }
};

const event = (input: {
  id: string;
  kind: number;
  pubkey: string;
  content: string;
  tags: string[][];
  createdAt: number;
}): NostrEventDTO => ({
  id: input.id,
  kind: input.kind,
  pubkey: input.pubkey,
  content: input.content,
  tags: input.tags,
  created_at: input.createdAt,
  sig: `${input.id}-signature`,
});

const metadataEvent = event({
  id: "metadata-1",
  kind: 34550,
  pubkey: "author",
  content: "説明",
  tags: [["d", "topic"], ["name", "共有会話"]],
  createdAt: 1,
});
const replacementMetadataEvent = event({
  id: "metadata-new-1",
  kind: 34550,
  pubkey: "author",
  content: "新しい説明",
  tags: [["d", "new-topic"], ["name", "新しい会話"]],
  createdAt: 11,
});
const postEvent = event({
  id: "post-1",
  kind: 1111,
  pubkey: "poster",
  content: "本文",
  tags: [["a", "34550:author:topic"]],
  createdAt: 2,
});
const replacementPostEvent = event({
  id: "post-new-1",
  kind: 1111,
  pubkey: "new-poster",
  content: "新しい本文",
  tags: [["a", "34550:author:new-topic"]],
  createdAt: 12,
});
const approvalEvent = event({
  id: "approval-1",
  kind: 4550,
  pubkey: "moderator",
  content: "",
  tags: [
    ["a", "34550:author:topic"],
    ["e", "post-1"],
    ["p", "poster"],
  ],
  createdAt: 3,
});
const evaluationEvent = event({
  id: "evaluation-1",
  kind: 7,
  pubkey: "viewer",
  content: "+",
  tags: [["a", "34550:author:topic"], ["e", "post-1"]],
  createdAt: 4,
});
const reloadedMetadataEvent = event({
  id: "metadata-reloaded-1",
  kind: 34550,
  pubkey: "author",
  content: "再読み込み後の説明",
  tags: [["d", "topic"], ["name", "再読み込み後の会話"]],
  createdAt: 11,
});
const reloadedPostEvent = event({
  id: "post-reloaded-1",
  kind: 1111,
  pubkey: "new-poster",
  content: "再読み込み後の本文",
  tags: [["a", "34550:author:topic"]],
  createdAt: 12,
});

type CompletionReason = "eose" | "idle-timeout" | "hard-timeout";

const readResult = (
  events: NostrEventDTO[],
  completionReason: CompletionReason = "eose",
) => ({
  events,
  completionReason,
  duplicateCount: 0,
  elapsedMs: 1,
  attemptedRelayUrls: ["wss://relay.example"],
  successfulEventRelayUrls: events.length > 0 ? ["wss://relay.example"] : [],
  sourceRelayUrlsByEventId: Object.fromEntries(
    events.map((item) => [item.id, ["wss://relay.example"]]),
  ),
  attempts: [],
});

const configureReadFixture = (): void => {
  executeNostrRead.mockImplementation(
    async (_transport: unknown, input: unknown) => {
      const plan = (
        input as { plan?: { target?: string; filters?: Array<{ kinds?: number[] }> } }
      ).plan;
      const target = plan?.target;
      const kinds = plan?.filters?.[0]?.kinds ?? [];
      if (target === "discussion-meta" || kinds.includes(34550)) {
        return readResult([metadataEvent]);
      }
      if (target === "discussion-approvals" || kinds.includes(4550)) {
        return readResult([approvalEvent]);
      }
      if (target === "discussion-evaluations" || kinds.includes(7)) {
        return readResult([evaluationEvent]);
      }
      return readResult([postEvent]);
    },
  );
};

const configurePartialReadFixture = (): void => {
  executeNostrRead.mockImplementation(async () => {
    const callNumber = executeNostrRead.mock.calls.length;
    if (callNumber === 1) return readResult([metadataEvent]);
    if (callNumber === 2) return readResult([postEvent], "idle-timeout");
    if (callNumber === 3) return readResult([]);
    return readResult([evaluationEvent]);
  });
};

function DetailModelProbe({
  onModel,
}: {
  onModel: (model: DetailModel) => void;
}) {
  const provider = loadProvider();
  if (typeof provider.useDiscussionDetail !== "function") {
    throw new Error(
      "T013 RED: useDiscussionDetail is not the single public detail model",
    );
  }
  const model = provider.useDiscussionDetail();
  useEffect(() => {
    onModel(model);
  }, [model, onModel]);
  return (
    <div>
      <span data-testid="detail-state">{model.state}</span>
      <span data-testid="detail-title">
        {model.snapshot?.discussion?.title ?? "no-snapshot"}
      </span>
      <span data-testid="detail-posts">
        {model.snapshot?.posts.map((post) => post.id).join(",") ?? "no-posts"}
      </span>
    </div>
  );
}

describe("DiscussionDetailProvider", () => {
  beforeEach(() => {
    pathname = "/discussions/naddr-test";
    mockNaddr = "naddr-test";
    executeNostrRead.mockReset();
    configureReadFixture();
  });

  it("publishes one public detail model with the final snapshot and route actions", async () => {
    const provider = loadProvider();
    if (!provider.DiscussionDetailProvider) {
      throw new Error(
        "T013 RED: DiscussionDetailProvider is not a public provider export",
      );
    }
    if (typeof provider.useDiscussionDetail !== "function") {
      throw new Error(
        "T013 RED: useDiscussionDetail is not a public provider model hook",
      );
    }

    let latestModel: DetailModel | undefined;
    const onModel = jest.fn((model: DetailModel) => {
      latestModel = model;
    });
    const Provider = provider.DiscussionDetailProvider;

    render(
      <Provider>
        <DetailModelProbe onModel={onModel} />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("detail-state")).toHaveTextContent("ready"),
    );
    expect(screen.getByTestId("detail-title")).toHaveTextContent("共有会話");
    expect(screen.getByTestId("detail-posts")).toHaveTextContent("post-1");
    expect(latestModel).toEqual(
      expect.objectContaining({
        state: "ready",
        snapshot: expect.objectContaining({
          posts: [expect.objectContaining({ id: "post-1" })],
        }),
        error: null,
        reload: expect.any(Function),
        addPost: expect.any(Function),
        addApproval: expect.any(Function),
        removeApproval: expect.any(Function),
      }),
    );
  });

  it("keeps the completed detail read and snapshot when the viewer pubkey arrives", async () => {
    const provider = loadProvider();
    if (!provider.DiscussionDetailProvider) {
      throw new Error(
        "T013 RED: DiscussionDetailProvider is not a public provider export",
      );
    }
    if (typeof provider.useDiscussionDetail !== "function") {
      throw new Error(
        "T013 RED: useDiscussionDetail is not a public provider model hook",
      );
    }

    let latestModel: DetailModel | undefined;
    const Provider = provider.DiscussionDetailProvider;
    const view = render(
      <Provider userPubkey={null}>
        <DetailModelProbe onModel={(model) => { latestModel = model; }} />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("detail-state")).toHaveTextContent("ready"),
    );
    const initialReadCount = executeNostrRead.mock.calls.length;
    const initialSnapshot = latestModel?.snapshot;
    expect(initialReadCount).toBe(4);
    expect(initialSnapshot).not.toBeNull();
    expect(initialSnapshot).toEqual(
      expect.objectContaining({
        discussion: expect.objectContaining({ title: "共有会話" }),
        posts: [expect.objectContaining({ id: "post-1" })],
      }),
    );

    view.rerender(
      <Provider userPubkey="viewer">
        <DetailModelProbe onModel={(model) => { latestModel = model; }} />
      </Provider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(executeNostrRead).toHaveBeenCalledTimes(initialReadCount);
    expect(latestModel?.snapshot).toEqual(
      expect.objectContaining({
        discussion: initialSnapshot?.discussion,
        posts: initialSnapshot?.posts,
        approvals: initialSnapshot?.approvals,
        moderatorRequests: initialSnapshot?.moderatorRequests,
      }),
    );
  });

  it("does not start extra reads while the same naddr moves main to approve, moderators, and edit", async () => {
    const provider = loadProvider();
    if (!provider.DiscussionDetailProvider) {
      throw new Error(
        "T013 RED: DiscussionDetailProvider is not a public provider export",
      );
    }
    if (typeof provider.useDiscussionDetail !== "function") {
      throw new Error(
        "T013 RED: useDiscussionDetail is not a public provider model hook",
      );
    }

    const onModel = jest.fn();
    const Provider = provider.DiscussionDetailProvider;
    const view = render(
      <Provider>
        <DetailModelProbe onModel={onModel} />
      </Provider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("detail-state")).toHaveTextContent("ready"),
    );
    const initialReadCount = executeNostrRead.mock.calls.length;
    expect(initialReadCount).toBe(4);

    for (const nextPath of [
      "/discussions/naddr-test/approve",
      "/discussions/naddr-test/moderators",
      "/discussions/naddr-test/edit",
      "/discussions/naddr-test",
    ]) {
      pathname = nextPath;
      view.rerender(
        <Provider>
          <DetailModelProbe onModel={onModel} />
        </Provider>,
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId("detail-title")).toHaveTextContent("共有会話");
      expect(screen.getByTestId("detail-posts")).toHaveTextContent("post-1");
    }

    expect(executeNostrRead).toHaveBeenCalledTimes(initialReadCount);
  });

  it("ignores an old detail read resolved after a new naddr generation", async () => {
    const pendingReads: Array<{
      resolve: (value: ReturnType<typeof readResult>) => void;
    }> = [];
    executeNostrRead.mockImplementation(
      () =>
        new Promise<ReturnType<typeof readResult>>((resolve) => {
          pendingReads.push({ resolve });
        }),
    );

    const provider = loadProvider();
    if (!provider.DiscussionDetailProvider) {
      throw new Error(
        "T013 RED: DiscussionDetailProvider is not a public provider export",
      );
    }
    if (typeof provider.useDiscussionDetail !== "function") {
      throw new Error(
        "T013 RED: useDiscussionDetail is not the single public detail model",
      );
    }

    const onModel = jest.fn();
    const Provider = provider.DiscussionDetailProvider;
    const view = render(
      <Provider>
        <DetailModelProbe onModel={onModel} />
      </Provider>,
    );

    await waitFor(() => expect(pendingReads).toHaveLength(1));

    mockNaddr = "naddr-new";
    view.rerender(
      <Provider>
        <DetailModelProbe onModel={onModel} />
      </Provider>,
    );
    await waitFor(() => expect(pendingReads).toHaveLength(2));

    pendingReads[1].resolve(readResult([replacementMetadataEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(3));
    pendingReads[2].resolve(readResult([replacementPostEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(4));
    pendingReads[3].resolve(readResult([]));
    await waitFor(() => expect(pendingReads).toHaveLength(5));
    pendingReads[4].resolve(readResult([evaluationEvent]));

    await waitFor(() => {
      expect(screen.getByTestId("detail-state")).toHaveTextContent("ready");
      expect(screen.getByTestId("detail-title")).toHaveTextContent("新しい会話");
      expect(screen.getByTestId("detail-posts")).toHaveTextContent("post-new-1");
    });

    pendingReads[0].resolve(readResult([metadataEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(6));
    pendingReads[5].resolve(readResult([postEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(7));
    pendingReads[6].resolve(readResult([]));
    await waitFor(() => expect(pendingReads).toHaveLength(8));
    pendingReads[7].resolve(readResult([evaluationEvent]));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("detail-title")).toHaveTextContent("新しい会話");
    expect(screen.getByTestId("detail-posts")).toHaveTextContent("post-new-1");
    expect(screen.getByTestId("detail-posts")).not.toHaveTextContent("post-1");
  });

  it("ignores the previous generation when reload resolves after a newer detail read", async () => {
    const pendingReads: Array<{
      resolve: (value: ReturnType<typeof readResult>) => void;
    }> = [];
    executeNostrRead.mockImplementation(
      () =>
        new Promise<ReturnType<typeof readResult>>((resolve) => {
          pendingReads.push({ resolve });
        }),
    );

    const provider = loadProvider();
    if (!provider.DiscussionDetailProvider || typeof provider.useDiscussionDetail !== "function") {
      throw new Error("T036 RED: detail provider reload guard is not public");
    }

    let latestModel: DetailModel | undefined;
    const onModel = jest.fn((model: DetailModel) => {
      latestModel = model;
    });
    const Provider = provider.DiscussionDetailProvider;
    render(
      <Provider>
        <DetailModelProbe onModel={onModel} />
      </Provider>,
    );

    await waitFor(() => expect(pendingReads).toHaveLength(1));
    let reloadPromise: Promise<void> | undefined;
    await act(async () => {
      reloadPromise = latestModel?.reload();
      await Promise.resolve();
    });
    await waitFor(() => expect(pendingReads).toHaveLength(2));

    pendingReads[1].resolve(readResult([reloadedMetadataEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(3));
    pendingReads[2].resolve(readResult([reloadedPostEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(4));
    pendingReads[3].resolve(readResult([]));
    await waitFor(() => expect(pendingReads).toHaveLength(5));
    pendingReads[4].resolve(readResult([evaluationEvent]));

    await waitFor(() => {
      expect(screen.getByTestId("detail-state")).toHaveTextContent("ready");
      expect(screen.getByTestId("detail-title")).toHaveTextContent("再読み込み後の会話");
      expect(screen.getByTestId("detail-posts")).toHaveTextContent("post-reloaded-1");
    });
    await reloadPromise;

    pendingReads[0].resolve(readResult([metadataEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(6));
    pendingReads[5].resolve(readResult([postEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(7));
    pendingReads[6].resolve(readResult([]));
    await waitFor(() => expect(pendingReads).toHaveLength(8));
    pendingReads[7].resolve(readResult([evaluationEvent]));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("detail-title")).toHaveTextContent("再読み込み後の会話");
    expect(screen.getByTestId("detail-posts")).toHaveTextContent("post-reloaded-1");
    expect(screen.getByTestId("detail-posts")).not.toHaveTextContent("post-1");
  });

  it("does not apply optimistic approval while the detail snapshot is partial", async () => {
    configurePartialReadFixture();
    const approval: PostApproval = {
      id: "partial-approval",
      postId: "post-1",
      postAuthorPubkey: "poster",
      moderatorPubkey: "moderator",
      discussionId: "34550:author:topic",
      createdAt: 7,
      event: approvalEvent,
    };
    const provider = loadProvider();
    if (!provider.DiscussionDetailProvider || typeof provider.useDiscussionDetail !== "function") {
      throw new Error("T036 RED: detail provider partial action boundary is not public");
    }

    let latestModel: DetailModel | undefined;
    const Provider = provider.DiscussionDetailProvider;
    render(
      <Provider>
        <DetailModelProbe onModel={(model) => { latestModel = model; }} />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("detail-state")).toHaveTextContent("partial"),
    );
    expect(latestModel?.snapshot?.approvals).toHaveLength(0);
    await act(async () => {
      latestModel?.addApproval(approval);
      await Promise.resolve();
    });

    expect(latestModel?.snapshot?.approvals).toHaveLength(0);
  });

});
