"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, usePathname } from "next/navigation";
import {
  getDiscussionReadStrategyConfig,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import {
  createDiscussionModerationSnapshot,
  loadDiscussionModerationSnapshot,
  type ApprovalState,
} from "@/lib/discussion/discussion-moderation-snapshot";
import {
  loadKnownDiscussionData,
  saveKnownDiscussionData,
} from "@/lib/discussion/discussion-known-data-cache";
import { rankRelayCandidates } from "@/lib/discussion/relay-candidate-selector";
import { createNostrService, type CompletionReason, type Event } from "@/lib/nostr/nostr-service";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { parseApprovalEvent, parsePostEvent } from "@/lib/nostr/nostr-utils";
import { isTestMode, loadTestData } from "@/lib/test/test-data-loader";
import type { DiscussionPost, PostApproval } from "@/types/discussion";
import { logger } from "@/utils/logger";

interface MergeModerationEventsInput {
  primaryEvents?: Event[];
  approvalEvents?: Event[];
  completionReason?: CompletionReason;
}

interface DiscussionContentDataContextValue {
  posts: DiscussionPost[];
  approvals: PostApproval[];
  isLoading: boolean;
  error: string | null;
  completionReason: CompletionReason | null;
  approvalState: ApprovalState;
  reload: () => Promise<void>;
  mergeModerationEvents: (input: MergeModerationEventsInput) => void;
  addPost: (post: DiscussionPost) => void;
  addApproval: (approval: PostApproval) => void;
  removeApproval: (approvalId: string) => void;
}

const DiscussionContentDataContext =
  createContext<DiscussionContentDataContextValue | null>(null);

const nostrServiceConfig = getNostrServiceConfig();
const readStrategy =
  typeof getDiscussionReadStrategyConfig === "function"
    ? getDiscussionReadStrategyConfig()
    : {
        relayLimit: 3,
        idleTimeoutMs: nostrServiceConfig.defaultTimeout,
        hardTimeoutMs: nostrServiceConfig.defaultTimeout * 3,
        dedupWindowMs: 250,
      };
const nostrService = createNostrService(nostrServiceConfig);
const readableRelayUrls = (nostrServiceConfig.relays ?? [])
  .filter((relay) => relay.read)
  .map((relay) => relay.url);

const mergeEvents = (current: Event[], incoming: Event[]): Event[] => {
  const byId = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values()).sort(
    (left, right) =>
      right.created_at - left.created_at || left.id.localeCompare(right.id),
  );
};

export function useDiscussionContentData(): DiscussionContentDataContextValue {
  const value = useContext(DiscussionContentDataContext);
  if (!value) {
    throw new Error(
      "useDiscussionContentData must be used within DiscussionContentDataProvider",
    );
  }
  return value;
}

/** Shares posts and approvals between the main and moderation tabs of one discussion. */
export function DiscussionContentDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const params = useParams();
  const naddr = params.naddr as string | undefined;
  const discussionInfo = useMemo(
    () => (naddr ? extractDiscussionFromNaddr(naddr) : null),
    [naddr],
  );
  const baseHref = naddr ? `/discussions/${naddr}` : "";
  const shouldLoad =
    pathname === baseHref || pathname === `${baseHref}/approve`;

  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [isLoading, setIsLoading] = useState(shouldLoad);
  const [error, setError] = useState<string | null>(null);
  const [completionReason, setCompletionReason] =
    useState<CompletionReason | null>(null);
  const [approvalState, setApprovalState] =
    useState<ApprovalState>("unknown");
  const primaryEventsRef = useRef<Event[]>([]);
  const approvalEventsRef = useRef<Event[]>([]);
  const attemptedRelayUrlsRef = useRef<string[]>([]);
  const completionReasonRef = useRef<CompletionReason>("cancelled");
  const loadedDiscussionIdRef = useRef<string | null>(null);
  const loadingDiscussionIdRef = useRef<string | null>(null);
  const readGenerationRef = useRef(0);

  const rebuildFromEvents = useCallback(
    (
      primaryEvents: Event[],
      approvalEvents: Event[],
      nextCompletionReason: CompletionReason,
    ) => {
      if (!discussionInfo) return;
      primaryEventsRef.current = primaryEvents;
      approvalEventsRef.current = approvalEvents;
      completionReasonRef.current = nextCompletionReason;

      const knownData = loadKnownDiscussionData<unknown, Event>(
        discussionInfo.discussionId,
      );
      const snapshot = createDiscussionModerationSnapshot({
        discussionId: discussionInfo.discussionId,
        primaryEvents,
        approvalEvents,
        relayCandidates: rankRelayCandidates({
          hints: discussionInfo.relays,
          successful:
            knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays,
          configured: readableRelayUrls,
          defaults: [],
        }),
        attemptedRelayUrls: attemptedRelayUrlsRef.current,
        completionReason: nextCompletionReason,
      });
      const nextApprovals = snapshot.approvalEvents
        .map(parseApprovalEvent)
        .filter((approval): approval is PostApproval => approval !== null);
      const nextPosts = snapshot.primaryEvents
        .map((event) => parsePostEvent(event, nextApprovals))
        .filter((post): post is DiscussionPost => post !== null)
        .map((post) => ({
          ...post,
          approvalState: (
            snapshot.completionReason === "eose"
              ? post.approved
                ? "approved"
                : "unapproved"
              : "unknown"
          ) as DiscussionPost["approvalState"],
        }))
        .sort((left, right) => right.createdAt - left.createdAt);

      setApprovals(nextApprovals);
      setPosts(nextPosts);
      setApprovalState(snapshot.approvalState);
      setCompletionReason(snapshot.completionReason);
    },
    [discussionInfo],
  );

  const mergeModerationEvents = useCallback(
    ({
      primaryEvents = [],
      approvalEvents = [],
      completionReason: nextCompletionReason,
    }: MergeModerationEventsInput) => {
      rebuildFromEvents(
        mergeEvents(primaryEventsRef.current, primaryEvents),
        mergeEvents(approvalEventsRef.current, approvalEvents),
        nextCompletionReason ?? completionReasonRef.current,
      );
    },
    [rebuildFromEvents],
  );

  const loadModeration = useCallback(async () => {
    if (!discussionInfo) return;
    const readGeneration = ++readGenerationRef.current;
    loadingDiscussionIdRef.current = discussionInfo.discussionId;
    setIsLoading(true);
    setError(null);

    if (isTestMode(discussionInfo.dTag)) {
      try {
        const testData = await loadTestData();
        if (readGenerationRef.current !== readGeneration) return;
        setPosts(testData.posts);
        setApprovals([]);
        setApprovalState("approved");
        setCompletionReason("eose");
        loadedDiscussionIdRef.current = discussionInfo.discussionId;
      } catch (loadError) {
        logger.error("Failed to load discussion test data:", loadError);
        setError("投稿データの取得に失敗しました。");
      } finally {
        if (readGenerationRef.current === readGeneration) {
          loadingDiscussionIdRef.current = null;
          setIsLoading(false);
        }
      }
      return;
    }

    const knownData = loadKnownDiscussionData<unknown, Event>(
      discussionInfo.discussionId,
    );
    attemptedRelayUrlsRef.current = knownData?.attemptedRelayUrls ?? [];
    if (knownData?.events?.length) {
      rebuildFromEvents(
        knownData.events.filter((event) => event.kind !== 4550),
        knownData.events.filter((event) => event.kind === 4550),
        "cancelled",
      );
    }

    try {
      const snapshot = await loadDiscussionModerationSnapshot(
        nostrService,
        readStrategy,
        {
          discussionId: discussionInfo.discussionId,
          hints: discussionInfo.relays,
          successful:
            knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays,
          configured: readableRelayUrls,
          defaults: [],
        },
      );
      if (readGenerationRef.current !== readGeneration) return;

      attemptedRelayUrlsRef.current = snapshot.attemptedRelayUrls;
      rebuildFromEvents(
        mergeEvents(primaryEventsRef.current, snapshot.primaryEvents),
        mergeEvents(approvalEventsRef.current, snapshot.approvalEvents),
        snapshot.completionReason,
      );
      loadedDiscussionIdRef.current = discussionInfo.discussionId;
      const events = [...snapshot.primaryEvents, ...snapshot.approvalEvents];
      saveKnownDiscussionData(discussionInfo.discussionId, {
        metadata: null,
        eventIds: events.map((event) => event.id),
        attemptedRelayUrls: snapshot.attemptedRelayUrls,
        successfulEventRelayUrls: snapshot.successfulRelayUrls,
        successfulRelays: [],
        events,
      });
    } catch (loadError) {
      if (readGenerationRef.current !== readGeneration) return;
      logger.error("Failed to load discussion posts:", loadError);
      setError("投稿データの取得に失敗しました。");
      setCompletionReason("hard-timeout");
    } finally {
      if (readGenerationRef.current === readGeneration) {
        loadingDiscussionIdRef.current = null;
        setIsLoading(false);
      }
    }
  }, [discussionInfo, rebuildFromEvents]);

  useEffect(() => {
    if (!shouldLoad || !discussionInfo) {
      setIsLoading(false);
      return;
    }
    if (
      loadedDiscussionIdRef.current === discussionInfo.discussionId ||
      loadingDiscussionIdRef.current === discussionInfo.discussionId
    ) {
      return;
    }
    primaryEventsRef.current = [];
    approvalEventsRef.current = [];
    setPosts([]);
    setApprovals([]);
    void loadModeration();
  }, [discussionInfo, loadModeration, shouldLoad]);

  const addPost = useCallback((post: DiscussionPost) => {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
    primaryEventsRef.current = mergeEvents(primaryEventsRef.current, [post.event]);
  }, []);

  const addApproval = useCallback(
    (approval: PostApproval) => {
      mergeModerationEvents({ approvalEvents: [approval.event] });
    },
    [mergeModerationEvents],
  );

  const removeApproval = useCallback(
    (approvalId: string) => {
      rebuildFromEvents(
        primaryEventsRef.current,
        approvalEventsRef.current.filter((event) => event.id !== approvalId),
        completionReasonRef.current,
      );
    },
    [rebuildFromEvents],
  );

  const value = useMemo<DiscussionContentDataContextValue>(
    () => ({
      posts,
      approvals,
      isLoading,
      error,
      completionReason,
      approvalState,
      reload: loadModeration,
      mergeModerationEvents,
      addPost,
      addApproval,
      removeApproval,
    }),
    [
      addApproval,
      addPost,
      approvalState,
      approvals,
      completionReason,
      error,
      isLoading,
      loadModeration,
      mergeModerationEvents,
      posts,
      removeApproval,
    ],
  );

  return (
    <DiscussionContentDataContext.Provider value={value}>
      {children}
    </DiscussionContentDataContext.Provider>
  );
}
