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
import { usePathname } from "next/navigation";
import {
  getDiscussionReadStrategyConfig,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import {
  loadDiscussionModerationSnapshot,
  type ApprovalState,
} from "@/lib/discussion/discussion-moderation-snapshot";
import {
  loadKnownDiscussionData,
  saveKnownDiscussionData,
} from "@/lib/discussion/discussion-known-data-cache";
import { createNostrService, type CompletionReason, type Event } from "@/lib/nostr/nostr-service";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import {
  parseApprovalEvent,
  parseDiscussionEvent,
  parsePostEvent,
} from "@/lib/nostr/nostr-utils";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import { useDiscussionMeta } from "@/components/discussion/DiscussionTabLayout";

interface DiscussionManagementDataContextValue {
  posts: DiscussionPost[];
  approvals: PostApproval[];
  referencedDiscussions: Discussion[];
  isModerationLoading: boolean;
  isReferencedDiscussionsLoading: boolean;
  moderationError: string | null;
  completionReason: CompletionReason | null;
  approvalState: ApprovalState;
  reloadModeration: () => Promise<void>;
  addApproval: (approval: PostApproval) => void;
  removeApproval: (approvalId: string, postId: string, moderatorPubkey: string) => void;
}

const DiscussionManagementDataContext =
  createContext<DiscussionManagementDataContextValue | null>(null);

const nostrServiceConfig = getNostrServiceConfig();
const readStrategy = getDiscussionReadStrategyConfig();
const nostrService = createNostrService(nostrServiceConfig);

const hasDiscussionReference = (post: DiscussionPost): boolean =>
  post.event?.tags?.some(
    (tag) => tag[0] === "q" && tag[1]?.startsWith("34550:"),
  ) ?? false;

const getDiscussionReferences = (posts: DiscussionPost[]): string[] =>
  Array.from(
    new Set(
      posts.flatMap((post) =>
        (post.event?.tags ?? [])
          .filter((tag) => tag[0] === "q" && tag[1]?.startsWith("34550:"))
          .map((tag) => tag[1]),
      ),
    ),
  );

const getDiscussionReference = (discussion: Discussion): string =>
  `34550:${discussion.authorPubkey}:${discussion.dTag}`;

export function useDiscussionManagementData(): DiscussionManagementDataContextValue {
  const value = useContext(DiscussionManagementDataContext);
  if (!value) {
    throw new Error(
      "useDiscussionManagementData must be used within DiscussionManagementDataProvider",
    );
  }
  return value;
}

/**
 * Shares the listing community moderation snapshot across its top-level tabs.
 * Reads stay lazy: the moderator tab does not request listing posts or approvals.
 */
export function DiscussionManagementDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const meta = useDiscussionMeta();
  const discussion = meta?.discussion;
  const shouldLoadModeration =
    pathname === "/discussions" || pathname === "/discussions/manage";
  const shouldLoadPendingReferences = pathname === "/discussions/manage";

  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [referencedDiscussionById, setReferencedDiscussionById] = useState(
    new Map<string, Discussion>(),
  );
  const [isModerationLoading, setIsModerationLoading] = useState(
    shouldLoadModeration,
  );
  const [completionReason, setCompletionReason] =
    useState<CompletionReason | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [isReferencedDiscussionsLoading, setIsReferencedDiscussionsLoading] =
    useState(false);
  const [approvalState, setApprovalState] =
    useState<ApprovalState>("unknown");
  const loadedDiscussionIdRef = useRef<string | null>(null);
  const loadingDiscussionIdRef = useRef<string | null>(null);
  const readGenerationRef = useRef(0);
  const requestedReferenceIdsRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);
  const discussionListInfo = useMemo(() => {
    const naddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
    return naddr ? extractDiscussionFromNaddr(naddr) : null;
  }, []);
  const targetDiscussionId =
    discussionListInfo?.discussionId ?? discussion?.id ?? null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadModeration = useCallback(async () => {
    if (!targetDiscussionId) return;
    const readGeneration = ++readGenerationRef.current;
    loadingDiscussionIdRef.current = targetDiscussionId;
    setIsModerationLoading(true);
    setCompletionReason(null);
    setApprovalState("unknown");
    setModerationError(null);
    requestedReferenceIdsRef.current.clear();

    const knownData = loadKnownDiscussionData<Discussion, Event>(
      targetDiscussionId,
    );
    try {
      const snapshot = await loadDiscussionModerationSnapshot(
        nostrService,
        readStrategy,
        {
          discussionId: targetDiscussionId,
          hints: discussionListInfo?.relays,
          configured: nostrServiceConfig.relays
            .filter((relay) => relay.read)
            .map((relay) => relay.url),
          defaults: [],
          successful:
            knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays,
        },
      );
      if (readGenerationRef.current !== readGeneration) return;

      const nextApprovals = snapshot.approvalEvents
        .map(parseApprovalEvent)
        .filter((approval): approval is PostApproval => approval !== null);
      const nextPosts = snapshot.primaryEvents
        .map((event) => parsePostEvent(event, nextApprovals))
        .filter((post): post is DiscussionPost => post !== null)
        .filter(hasDiscussionReference)
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
      loadedDiscussionIdRef.current = targetDiscussionId;

      const events = [...snapshot.primaryEvents, ...snapshot.approvalEvents];
      saveKnownDiscussionData(targetDiscussionId, {
        metadata: discussion ?? knownData?.metadata ?? null,
        eventIds: events.map((event) => event.id),
        attemptedRelayUrls: snapshot.attemptedRelayUrls,
        successfulEventRelayUrls: snapshot.successfulRelayUrls,
        successfulRelays: [],
        events,
      });
    } catch (error) {
      if (readGenerationRef.current !== readGeneration) return;
      logger.error("Failed to load discussion management data:", error);
      setCompletionReason("hard-timeout");
      setModerationError(
        "会話一覧の取得に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      if (readGenerationRef.current === readGeneration) {
        loadingDiscussionIdRef.current = null;
        setIsModerationLoading(false);
      }
    }
  }, [discussion, discussionListInfo?.relays, targetDiscussionId]);

  useEffect(() => {
    if (!shouldLoadModeration || !targetDiscussionId) {
      setIsModerationLoading(false);
      return;
    }
    if (
      loadedDiscussionIdRef.current === targetDiscussionId ||
      loadingDiscussionIdRef.current === targetDiscussionId
    ) {
      return;
    }
    void loadModeration();
  }, [loadModeration, shouldLoadModeration, targetDiscussionId]);

  useEffect(() => {
    if (!shouldLoadModeration || !targetDiscussionId || isModerationLoading) return;
    const referenceSource = shouldLoadPendingReferences
      ? posts
      : posts.filter(
          (post) => post.approved || post.approvalState === "unknown",
        );
    const missingReferences = getDiscussionReferences(referenceSource).filter(
      (reference) =>
        !referencedDiscussionById.has(reference) &&
        !requestedReferenceIdsRef.current.has(reference),
    );
    if (missingReferences.length === 0) return;
    missingReferences.forEach((reference) =>
      requestedReferenceIdsRef.current.add(reference),
    );
    setIsReferencedDiscussionsLoading(true);

    void nostrService
      .getReferencedUserDiscussions(missingReferences)
      .then((events) => {
        if (!isMountedRef.current) return;
        const discussions = events
          .map(parseDiscussionEvent)
          .filter((item): item is Discussion => item !== null);
        setReferencedDiscussionById((current) => {
          const next = new Map(current);
          discussions.forEach((item) =>
            next.set(getDiscussionReference(item), item),
          );
          return next;
        });
      })
      .catch((error) => {
        logger.error("Failed to load referenced discussions:", error);
        missingReferences.forEach((reference) =>
          requestedReferenceIdsRef.current.delete(reference),
        );
      })
      .finally(() => {
        if (isMountedRef.current) setIsReferencedDiscussionsLoading(false);
      });
  }, [
    isModerationLoading,
    posts,
    referencedDiscussionById,
    shouldLoadModeration,
    shouldLoadPendingReferences,
    targetDiscussionId,
  ]);

  const addApproval = useCallback((approval: PostApproval) => {
    setApprovals((current) => [...current, approval]);
    setPosts((current) =>
      current.map((post) =>
        post.id === approval.postId
          ? {
              ...post,
              approved: true,
              approvedBy: [
                ...(post.approvedBy ?? []),
                approval.moderatorPubkey,
              ],
              approvedAt: approval.createdAt,
              approvalState: "approved",
            }
          : post,
      ),
    );
  }, []);

  const removeApproval = useCallback(
    (approvalId: string, postId: string, moderatorPubkey: string) => {
      setApprovals((current) =>
        current.filter((approval) => approval.id !== approvalId),
      );
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                approved: false,
                approvedBy: (post.approvedBy ?? []).filter(
                  (pubkey) => pubkey !== moderatorPubkey,
                ),
                approvedAt: undefined,
                approvalState: "unapproved",
              }
            : post,
        ),
      );
    },
    [],
  );

  const value = useMemo<DiscussionManagementDataContextValue>(
    () => ({
      posts,
      approvals,
      referencedDiscussions: Array.from(referencedDiscussionById.values()),
      isModerationLoading,
      isReferencedDiscussionsLoading,
      moderationError,
      completionReason,
      approvalState,
      reloadModeration: loadModeration,
      addApproval,
      removeApproval,
    }),
    [
      addApproval,
      approvalState,
      approvals,
      completionReason,
      isModerationLoading,
      isReferencedDiscussionsLoading,
      loadModeration,
      moderationError,
      posts,
      referencedDiscussionById,
      removeApproval,
    ],
  );

  return (
    <DiscussionManagementDataContext.Provider value={value}>
      {children}
    </DiscussionManagementDataContext.Provider>
  );
}
