import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionDetailPage from "../page";
import type { StreamEventsOptions } from "@/lib/nostr/nostr-service";

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "viewer", isLoggedIn: true },
    signEvent: jest.fn(),
  }),
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
    streamDiscussionMeta: jest.fn(),
    getApprovalsOnEose: jest.fn(),
    getEvaluationsForPosts: jest.fn(),
    getEvaluations: jest.fn(),
    publishSignedEvent: jest.fn(),
  };

  return {
    createNostrService: () => serviceMock,
    __mock: serviceMock,
  };
});

const { __mock: serviceMock } = jest.requireMock("@/lib/nostr/nostr-service");

jest.mock("@/lib/nostr/nostr-utils", () => ({
  parseDiscussionEvent: jest.fn((event) => ({
    id: `34550:${event.pubkey}:${event.tags?.find((tag: string[]) => tag[0] === "d")?.[1] || ""}`,
    title: event.tags?.find((tag: string[]) => tag[0] === "name")?.[1] || "Untitled",
    description: event.content,
    authorPubkey: event.pubkey,
    dTag: event.tags?.find((tag: string[]) => tag[0] === "d")?.[1] || "",
    moderators: [],
    createdAt: event.created_at,
    event,
  })),
  parsePostEvent: jest.fn((_post, approvals) => ({
    id: approvals[0]?.postId || "post-1",
    content: "approved post",
    authorPubkey: "author",
    discussionId: "34550:author:demo",
    createdAt: approvals[0]?.createdAt || 100,
    approved: true,
    event: {
      id: "post-event",
      pubkey: "author",
      kind: 1,
      created_at: 100,
      tags: [["q", "34550:author:demo"]],
      content: "post",
      sig: "sig",
    },
  })),
  parseApprovalEvent: jest.fn((event) => ({
    id: event.id,
    postId: event.tags?.find((tag: string[]) => tag[0] === "e")?.[1] || "post-1",
    postAuthorPubkey: "author",
    moderatorPubkey: "mod",
    discussionId: "34550:author:demo",
    createdAt: event.created_at,
    event,
  })),
  parseEvaluationEvent: jest.fn((event) => ({
    id: event.id,
    postId: event.tags?.find((tag: string[]) => tag[0] === "e")?.[1] || "post-1",
    evaluatorPubkey: event.pubkey,
    rating: "+",
    discussionId: "34550:author:demo",
    createdAt: event.created_at,
    event,
  })),
  combinePostsWithStats: () => [],
  validatePostForm: () => [],
  formatRelativeTime: () => "now",
  getAdminPubkeyHex: () => "admin-pubkey",
}));

jest.mock("@/lib/test/test-data-loader", () => ({
  isTestMode: () => false,
  loadTestData: () => ({}),
}));

jest.mock("@/lib/evaluation/evaluation-service", () => ({
  evaluationService: {
    analyzeConsensus: jest
      .fn()
      .mockResolvedValue({ groupAwareConsensus: [], groupRepresentativeComments: [] }),
  },
}));

global.fetch = jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
});

jest.mock("@/components/discussion/EvaluationComponent", () => ({
  __esModule: true,
  EvaluationComponent: () => <div>Evaluation Component</div>,
}));

jest.mock("@/components/discussion/PermissionGuards", () => ({
  ModeratorCheck: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AdminCheck: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PermissionError: () => <div>Permission Error</div>,
}));

jest.mock("@/components/discussion/LoginModal", () => ({
  __esModule: true,
  LoginModal: () => <div>Login Modal</div>,
}));

jest.mock("@/components/discussion/PostPreview", () => ({
  __esModule: true,
  PostPreview: () => <div>Post Preview</div>,
}));

jest.mock("@/components/discussion/AuditTimeline", () => ({
  __esModule: true,
  AuditTimeline: () => <div>Audit Timeline</div>,
}));

// eslint-disable-next-line no-var
var loadAuditDataMock: jest.Mock;

jest.mock("@/components/discussion/AuditLogSection", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  loadAuditDataMock = jest.fn();

  const AuditLogSection = React.forwardRef(function AuditLogSectionMock(
    _props: Record<string, never>,
    ref: React.ForwardedRef<{ loadAuditData: () => void }>
  ) {
    React.useImperativeHandle(ref, () => ({
      loadAuditData: loadAuditDataMock,
    }));
    return <div>Audit Log Section</div>;
  });

  AuditLogSection.displayName = "AuditLogSectionMock";

  return {
    __esModule: true,
    AuditLogSection,
    __mock: {
      loadAuditDataMock,
    },
  };
});

jest.mock("@/components/ui/Button", () => {
  return function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
  };
});

describe("DiscussionDetailPage streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadAuditDataMock?.mockClear();
  });

  it("shows loading state for evaluations until approvals EOSE completes", async () => {
    let discussionHandlers: StreamEventsOptions | undefined;
    let resolveApprovals: (events: any[]) => void;

    const approvalsPromise = new Promise<any[]>((resolve) => {
      resolveApprovals = resolve;
    });

    serviceMock.streamDiscussionMeta.mockImplementation(
      (_pubkey: string, _dTag: string, handlers: StreamEventsOptions) => {
        discussionHandlers = handlers;
        return () => {};
      }
    );

    serviceMock.getApprovalsOnEose.mockReturnValue(approvalsPromise);
    serviceMock.getEvaluationsForPosts.mockResolvedValue([]);
    serviceMock.getEvaluations.mockResolvedValue([]);

    render(<DiscussionDetailPage />);

    const discussionEvent = {
      id: "discussion-1",
      pubkey: "author",
      kind: 34550,
      created_at: 999,
      tags: [
        ["d", "demo"],
        ["name", "Streamed Discussion"],
      ],
      content: "Streaming description",
      sig: "sig",
    };

    await act(async () => {
      discussionHandlers?.onEvent?.([discussionEvent], discussionEvent);
    });

    expect(
      await screen.findByText("Streamed Discussion")
    ).toBeInTheDocument();
    expect(
      screen.getByText("評価データを読み込み中...")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Evaluation Component")
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveApprovals([]);
    });

    await waitFor(() =>
      expect(
        screen.queryByText("評価データを読み込み中...")
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("Evaluation Component")).toBeInTheDocument();
  });

  it("loads audit data after switching to the audit tab", async () => {
    let discussionHandlers: StreamEventsOptions | undefined;

    serviceMock.streamDiscussionMeta.mockImplementation(
      (_pubkey: string, _dTag: string, handlers: StreamEventsOptions) => {
        discussionHandlers = handlers;
        return () => {};
      }
    );

    serviceMock.getApprovalsOnEose.mockResolvedValue([]);
    serviceMock.getEvaluationsForPosts.mockResolvedValue([]);
    serviceMock.getEvaluations.mockResolvedValue([]);

    render(<DiscussionDetailPage />);

    const discussionEvent = {
      id: "discussion-1",
      pubkey: "author",
      kind: 34550,
      created_at: 999,
      tags: [
        ["d", "demo"],
        ["name", "Streamed Discussion"],
      ],
      content: "Streaming description",
      sig: "sig",
    };

    await act(async () => {
      discussionHandlers?.onEvent?.([discussionEvent], discussionEvent);
    });

    expect(
      await screen.findByText("Streamed Discussion")
    ).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("tab", { name: "監査ログを開く" }).click();
    });

    await waitFor(() => expect(loadAuditDataMock).toHaveBeenCalledTimes(1));
  });

  it("renders metadata on event before approvals EOSE, then runs analysis once after EOSE flow", async () => {
    let discussionHandlers: StreamEventsOptions | undefined;
    let resolveApprovals: (events: any[]) => void;

    const approvalsPromise = new Promise<any[]>((resolve) => {
      resolveApprovals = resolve;
    });

    serviceMock.streamDiscussionMeta.mockImplementation(
      (_pubkey: string, _dTag: string, handlers: StreamEventsOptions) => {
        discussionHandlers = handlers;
        return () => {};
      }
    );

    serviceMock.getApprovalsOnEose.mockReturnValue(approvalsPromise);
    serviceMock.getEvaluationsForPosts.mockResolvedValue([
      { id: "eval-1", pubkey: "u1", tags: [["e", "post-1"]], created_at: 1 },
      { id: "eval-2", pubkey: "u2", tags: [["e", "post-1"]], created_at: 2 },
      { id: "eval-3", pubkey: "u3", tags: [["e", "post-2"]], created_at: 3 },
      { id: "eval-4", pubkey: "u4", tags: [["e", "post-2"]], created_at: 4 },
      { id: "eval-5", pubkey: "u5", tags: [["e", "post-1"]], created_at: 5 },
    ]);
    serviceMock.getEvaluations.mockResolvedValue([]);

    render(<DiscussionDetailPage />);

    await waitFor(() =>
      expect(serviceMock.streamDiscussionMeta).toHaveBeenCalled()
    );

    const discussionEvent = {
      id: "discussion-1",
      pubkey: "author",
      kind: 34550,
      created_at: 999,
      tags: [
        ["d", "demo"],
        ["name", "Streamed Discussion"],
      ],
      content: "Streaming description",
      sig: "sig",
    };

    await act(async () => {
      discussionHandlers?.onEvent?.([discussionEvent], discussionEvent);
    });

    expect(
      await screen.findByText("Streamed Discussion")
    ).toBeInTheDocument();
    expect(serviceMock.getEvaluationsForPosts).not.toHaveBeenCalled();

    const approvalEvents = [
      {
        id: "approval-1",
        pubkey: "mod",
        kind: 4550,
        created_at: 10,
        tags: [["e", "post-1"]],
        content: JSON.stringify({}),
        sig: "sig",
      },
      {
        id: "approval-2",
        pubkey: "mod",
        kind: 4550,
        created_at: 11,
        tags: [["e", "post-2"]],
        content: JSON.stringify({}),
        sig: "sig",
      },
    ];

    await act(async () => {
      resolveApprovals(approvalEvents);
    });

    await waitFor(() =>
      expect(serviceMock.getEvaluationsForPosts).toHaveBeenCalled()
    );

    const { evaluationService } = jest.requireMock(
      "@/lib/evaluation/evaluation-service"
    );
    await waitFor(() =>
      expect(evaluationService.analyzeConsensus).toHaveBeenCalledTimes(1)
    );
  });
});
