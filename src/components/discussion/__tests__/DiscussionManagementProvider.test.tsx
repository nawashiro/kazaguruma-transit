import path from "node:path";
import React, { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import type { PostApproval } from "@/types/discussion";
import ModeratorPage from "@/app/discussions/moderator/page";
import { DiscussionManagementShell } from "@/components/discussion/DiscussionManagementShell";

let pathname = "/discussions";
const mockExecuteNostrRead = jest.fn();
const mockUseDiscussionManagementRoute = jest.fn();
const mockManagementProviderBoundary = jest.fn();
const mockUseDiscussionDetail = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useParams: () => ({ naddr: "naddr-list" }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "viewer", isLoggedIn: true },
    signEvent: jest.fn(),
  }),
}));

jest.mock("@/components/discussion/DiscussionDetailProvider", () => ({
  useDiscussionDetail: () => mockUseDiscussionDetail(),
}), { virtual: true });

jest.mock("../DiscussionManagementProvider", () => ({
  DiscussionManagementProvider: ({ children }: { children: React.ReactNode }) => {
    mockManagementProviderBoundary();
    return <>{children}</>;
  },
  useDiscussionManagement: () => mockUseDiscussionManagementRoute(),
}), { virtual: true });

jest.mock("@/components/discussion/DiscussionDataProvider", () => ({
  DiscussionDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}), { virtual: true });

jest.mock("@/components/discussion/DiscussionManagementDataProvider", () => ({
  DiscussionManagementDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}), { virtual: true });

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  DiscussionTabLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDiscussionMeta: () => undefined,
}), { virtual: true });

jest.mock(
  "@/lib/config/discussion-config",
  () => ({
    getNostrServiceConfig: () => ({
      relays: [{ url: "wss://relay.example", read: true, write: false }],
      defaultTimeout: 500,
    }),
    getDiscussionReadStrategyConfig: () => ({
      idleTimeoutMs: 100,
      hardTimeoutMs: 300,
      dedupWindowMs: 0,
    }),
  }),
);

jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    discussionId: "34550:" + "a".repeat(64) + ":listing",
    authorPubkey: "a".repeat(64),
    dTag: "listing",
    relays: ["wss://hint.example"],
  }),
}));

jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({ queryWithCompletion: jest.fn() }),
}));

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: mockExecuteNostrRead,
}));

type CompletionReason = "eose" | "idle-timeout" | "hard-timeout";
type ManagementModel = {
  state: "loading" | "ready" | "partial" | "error";
  snapshot: {
    listDiscussion: { id: string; title: string } | null;
    listingPosts: Array<{ id: string }>;
    listingApprovals: Array<{ id: string; postId: string }>;
    referencedDiscussions: Array<{ id: string; title: string }>;
  } | null;
  error: string | null;
  reload: () => Promise<void>;
  addApproval?: (approval: PostApproval) => void;
};

type ProviderModule = {
  DiscussionManagementProvider?: React.ComponentType<{
    children: React.ReactNode;
    discussionListNaddr?: string;
  }>;
  useDiscussionManagement?: () => ManagementModel;
};

const providerPath = path.join(
  process.cwd(),
  "src/components/discussion/DiscussionManagementProvider",
);

const loadProvider = (): ProviderModule => {
  try {
    const loaded = jest.requireActual(providerPath) as unknown;
    if (!loaded || typeof loaded !== "object") {
      throw new Error("The management provider module did not export an object");
    }
    return loaded as ProviderModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Cannot find module") &&
      message.includes("DiscussionManagementProvider")
    ) {
      throw new Error(
        "T026 RED: DiscussionManagementProvider public module is not implemented",
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

const listAuthor = "a".repeat(64);
const referenceAuthor = "b".repeat(64);
const listDiscussionId = `34550:${listAuthor}:listing`;
const referenceDiscussionId = `34550:${referenceAuthor}:topic`;
const listMetadataEvent = event({
  id: "list-metadata-1",
  kind: 34550,
  pubkey: listAuthor,
  content: "説明",
  tags: [["d", "listing"], ["name", "掲載一覧"]],
  createdAt: 1,
});
const listingPostEvent = event({
  id: "listing-post-1",
  kind: 1111,
  pubkey: "c".repeat(64),
  content: "掲載投稿",
  tags: [["a", listDiscussionId], ["q", referenceDiscussionId]],
  createdAt: 2,
});
const approvalEvent = event({
  id: "listing-approval-1",
  kind: 4550,
  pubkey: "d".repeat(64),
  content: "",
  tags: [["a", listDiscussionId], ["e", listingPostEvent.id], ["p", listingPostEvent.pubkey]],
  createdAt: 3,
});
const referencedMetadataEvent = event({
  id: "reference-metadata-1",
  kind: 34550,
  pubkey: referenceAuthor,
  content: "参照説明",
  tags: [["d", "topic"], ["name", "参照会話"]],
  createdAt: 4,
});
const reloadedListMetadataEvent = event({
  id: "list-metadata-reloaded-1",
  kind: 34550,
  pubkey: listAuthor,
  content: "再読み込み後の掲載説明",
  tags: [["d", "listing"], ["name", "再読み込み後の掲載一覧"]],
  createdAt: 11,
});
const reloadedListingPostEvent = event({
  id: "listing-post-reloaded-1",
  kind: 1111,
  pubkey: "e".repeat(64),
  content: "再読み込み後の掲載投稿",
  tags: [["a", listDiscussionId], ["q", referenceDiscussionId]],
  createdAt: 12,
});
const reloadedReferencedMetadataEvent = event({
  id: "reference-metadata-reloaded-1",
  kind: 34550,
  pubkey: referenceAuthor,
  content: "再読み込み後の参照説明",
  tags: [["d", "topic"], ["name", "再読み込み後の参照会話"]],
  createdAt: 13,
});

const readResult = (events: NostrEventDTO[], completionReason: CompletionReason = "eose") => ({
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

const configurePartialManagementRead = (): void => {
  mockExecuteNostrRead.mockImplementation(async () => {
    const callNumber = mockExecuteNostrRead.mock.calls.length;
    if (callNumber === 1) return readResult([listMetadataEvent]);
    if (callNumber === 2) return readResult([listingPostEvent], "idle-timeout");
    if (callNumber === 3) return readResult([]);
    return readResult([referencedMetadataEvent]);
  });
};

function ManagementModelProbe({
  onModel,
}: {
  onModel: (model: ManagementModel) => void;
}) {
  const provider = loadProvider();
  if (typeof provider.useDiscussionManagement !== "function") {
    throw new Error(
      "T026 RED: useDiscussionManagement is not the single public management model",
    );
  }
  const model = provider.useDiscussionManagement();
  useEffect(() => {
    onModel(model);
  }, [model, onModel]);
  return (
    <div>
      <span data-testid="management-state">{model.state}</span>
      <span data-testid="management-title">
        {model.snapshot?.listDiscussion?.title ?? "no-snapshot"}
      </span>
      <span data-testid="management-references">
        {model.snapshot?.referencedDiscussions.map((item) => item.id).join(",") ?? "no-references"}
      </span>
    </div>
  );
}

describe("DiscussionManagementProvider", () => {
  beforeEach(() => {
    pathname = "/discussions";
    jest.clearAllMocks();
    mockUseDiscussionManagementRoute.mockReset();
    mockManagementProviderBoundary.mockReset();
    mockUseDiscussionDetail.mockReset();
    mockExecuteNostrRead.mockReset();
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr-list";
    mockExecuteNostrRead.mockImplementation(async () => {
      const callNumber = mockExecuteNostrRead.mock.calls.length;
      if (callNumber === 1) return readResult([listMetadataEvent]);
      if (callNumber === 2) return readResult([listingPostEvent]);
      if (callNumber === 3) return readResult([approvalEvent]);
      return readResult([referencedMetadataEvent]);
    });
  });

  it("publishes one public management model with the final snapshot", async () => {
    const provider = loadProvider();
    if (!provider.DiscussionManagementProvider) {
      throw new Error(
        "T026 RED: DiscussionManagementProvider is not a public provider export",
      );
    }
    if (typeof provider.useDiscussionManagement !== "function") {
      throw new Error(
        "T026 RED: useDiscussionManagement is not a public provider model hook",
      );
    }

    let latestModel: ManagementModel | undefined;
    const onModel = jest.fn((model: ManagementModel) => {
      latestModel = model;
    });
    const Provider = provider.DiscussionManagementProvider;

    render(
      <Provider discussionListNaddr="naddr-list">
        <ManagementModelProbe onModel={onModel} />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("management-state")).toHaveTextContent("ready"),
    );
    expect(screen.getByTestId("management-title")).toHaveTextContent("掲載一覧");
    expect(screen.getByTestId("management-references")).toHaveTextContent(
      referenceDiscussionId,
    );
    expect(latestModel).toEqual(
      expect.objectContaining({
        state: "ready",
        snapshot: expect.objectContaining({
          listingPosts: [expect.objectContaining({ id: listingPostEvent.id })],
          referencedDiscussions: [
            expect.objectContaining({ id: referenceDiscussionId }),
          ],
        }),
        error: null,
        reload: expect.any(Function),
      }),
    );
  });

  it("does not start extra reads while the same snapshot moves across all management routes", async () => {
    const provider = loadProvider();
    if (!provider.DiscussionManagementProvider) {
      throw new Error(
        "T026 RED: DiscussionManagementProvider is not a public provider export",
      );
    }
    if (typeof provider.useDiscussionManagement !== "function") {
      throw new Error(
        "T026 RED: useDiscussionManagement is not the single public management model",
      );
    }

    const Provider = provider.DiscussionManagementProvider;
    const onModel = jest.fn();
    const view = render(
      <Provider discussionListNaddr="naddr-list">
        <ManagementModelProbe onModel={onModel} />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("management-state")).toHaveTextContent("ready"),
    );
    expect(mockExecuteNostrRead).toHaveBeenCalledTimes(4);

    for (const nextPath of [
      "/discussions",
      "/discussions/manage",
      "/discussions/moderator",
    ]) {
      pathname = nextPath;
      view.rerender(
        <Provider discussionListNaddr="naddr-list">
          <ManagementModelProbe onModel={onModel} />
        </Provider>,
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId("management-title")).toHaveTextContent("掲載一覧");
    }

    expect(mockExecuteNostrRead).toHaveBeenCalledTimes(4);
  });

  it("renders the public moderator route through management provider state, not detail selectors", () => {
    pathname = "/discussions/moderator";
    const accessedManagementFields = new Set<string>();
    mockUseDiscussionManagementRoute.mockReturnValue({
      get state() {
        accessedManagementFields.add("state");
        return "ready";
      },
      get snapshot() {
        accessedManagementFields.add("snapshot");
        return {
          listDiscussion: {
            id: "management-moderator-route-sentinel",
            title: "管理モデルのモデレーター境界",
          },
          listingPosts: [],
          listingApprovals: [],
          referencedDiscussions: [],
        };
      },
      error: null,
      reload: jest.fn(),
    });
    mockUseDiscussionDetail.mockImplementation(() => {
      throw new Error(
        "T028A RED: /discussions/moderator must not consume the detail selector",
      );
    });

    render(
      <DiscussionManagementShell discussionListNaddr="naddr-list">
        <ModeratorPage />
      </DiscussionManagementShell>,
    );

    expect(mockManagementProviderBoundary).toHaveBeenCalledTimes(1);
    expect(mockUseDiscussionManagementRoute).toHaveBeenCalledTimes(1);
    expect(accessedManagementFields.has("state")).toBe(true);
    expect(accessedManagementFields.has("snapshot")).toBe(true);
    expect(mockUseDiscussionDetail).not.toHaveBeenCalled();
  });

  it("ignores the previous generation when reload resolves after a newer management read", async () => {
    const pendingReads: Array<{
      resolve: (value: ReturnType<typeof readResult>) => void;
    }> = [];
    mockExecuteNostrRead.mockImplementation(
      () =>
        new Promise<ReturnType<typeof readResult>>((resolve) => {
          pendingReads.push({ resolve });
        }),
    );

    const provider = loadProvider();
    if (!provider.DiscussionManagementProvider || typeof provider.useDiscussionManagement !== "function") {
      throw new Error("T036 RED: management provider reload guard is not public");
    }

    let latestModel: ManagementModel | undefined;
    const Provider = provider.DiscussionManagementProvider;
    render(
      <Provider discussionListNaddr="naddr-list">
        <ManagementModelProbe onModel={(model) => { latestModel = model; }} />
      </Provider>,
    );

    await waitFor(() => expect(pendingReads).toHaveLength(1));
    let reloadPromise: Promise<void> | undefined;
    await act(async () => {
      reloadPromise = latestModel?.reload();
      await Promise.resolve();
    });
    await waitFor(() => expect(pendingReads).toHaveLength(2));

    pendingReads[1].resolve(readResult([reloadedListMetadataEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(3));
    pendingReads[2].resolve(readResult([reloadedListingPostEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(4));
    pendingReads[3].resolve(readResult([]));
    await waitFor(() => expect(pendingReads).toHaveLength(5));
    pendingReads[4].resolve(readResult([reloadedReferencedMetadataEvent]));

    await waitFor(() => {
      expect(screen.getByTestId("management-state")).toHaveTextContent("ready");
      expect(screen.getByTestId("management-title")).toHaveTextContent(
        "再読み込み後の掲載一覧",
      );
      expect(screen.getByTestId("management-references")).toHaveTextContent(
        referenceDiscussionId,
      );
    });
    await reloadPromise;

    pendingReads[0].resolve(readResult([listMetadataEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(6));
    pendingReads[5].resolve(readResult([listingPostEvent]));
    await waitFor(() => expect(pendingReads).toHaveLength(7));
    pendingReads[6].resolve(readResult([]));
    await waitFor(() => expect(pendingReads).toHaveLength(8));
    pendingReads[7].resolve(readResult([referencedMetadataEvent]));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("management-title")).toHaveTextContent(
      "再読み込み後の掲載一覧",
    );
  });

  it("does not apply optimistic approval while the management snapshot is partial", async () => {
    configurePartialManagementRead();
    const approval: PostApproval = {
      id: "partial-management-approval",
      postId: listingPostEvent.id,
      postAuthorPubkey: listingPostEvent.pubkey,
      moderatorPubkey: "moderator",
      discussionId: listDiscussionId,
      createdAt: 7,
      event: approvalEvent,
    };
    const provider = loadProvider();
    if (!provider.DiscussionManagementProvider || typeof provider.useDiscussionManagement !== "function") {
      throw new Error("T036 RED: management provider partial action boundary is not public");
    }

    let latestModel: ManagementModel | undefined;
    const Provider = provider.DiscussionManagementProvider;
    render(
      <Provider discussionListNaddr="naddr-list">
        <ManagementModelProbe onModel={(model) => { latestModel = model; }} />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("management-state")).toHaveTextContent("partial"),
    );
    expect(latestModel?.snapshot?.listingApprovals).toHaveLength(0);
    await act(async () => {
      latestModel?.addApproval?.(approval);
      await Promise.resolve();
    });

    expect(latestModel?.snapshot?.listingApprovals).toHaveLength(0);
  });

});
