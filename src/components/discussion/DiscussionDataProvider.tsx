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
import {
  executeNostrRead,
  type NostrReadTransport,
} from "@/lib/nostr/nostr-read-executor";
import { createDiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import { resolveDiscussionReferences } from "@/lib/discussion/discussion-reference-resolver";
import { isTestMode, loadTestData } from "@/lib/test/test-data-loader";
import type {
  NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";
import {
  createNostrService,
  type CompletionReason,
  type Event,
} from "@/lib/nostr/nostr-service";
import { extractDiscussionFromNaddr, type DiscussionInfo } from "@/lib/nostr/naddr-utils";
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
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import { logger } from "@/utils/logger";

const nostrServiceConfig = getNostrServiceConfig();
const readStrategy = getDiscussionReadStrategyConfig();
const nostrService = createNostrService(nostrServiceConfig);
const readableRelayUrls = nostrServiceConfig.relays
  .filter((relay) => relay.read)
  .map((relay) => relay.url);
const discussionReadTransport = nostrService.getEventsWithCompletion.bind(
  nostrService,
) as unknown as NostrReadTransport;

export interface DiscussionMetaState {
  discussion: Discussion | null;
  isLoading: boolean;
  error: string | null;
  completionReason: CompletionReason | null;
  reload: () => Promise<void>;
}

export interface MergeModerationEventsInput {
  primaryEvents?: Event[];
  approvalEvents?: Event[];
  completionReason?: CompletionReason;
}

export interface DiscussionContentState {
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
  removeApproval: (
    approvalId: string,
    postId?: string,
    moderatorPubkey?: string,
  ) => void;
}

export interface DiscussionManagementState extends DiscussionContentState {
  referencedDiscussions: Discussion[];
  isModerationLoading: boolean;
  isReferencedDiscussionsLoading: boolean;
  referencedDiscussionCompletionReason: CompletionReason | null;
  moderationError: string | null;
  reloadModeration: () => Promise<void>;
  removeManagementApproval: (
    approvalId: string,
    postId: string,
    moderatorPubkey: string,
  ) => void;
}

interface DiscussionDataContextValue {
  meta: DiscussionMetaState;
  content: DiscussionContentState;
  management: DiscussionManagementState;
}

const EMPTY_CONTENT_STATE: DiscussionContentState = {
  posts: [],
  approvals: [],
  isLoading: false,
  error: null,
  completionReason: null,
  approvalState: "unknown",
  reload: async () => undefined,
  mergeModerationEvents: () => undefined,
  addPost: () => undefined,
  addApproval: () => undefined,
  removeApproval: () => undefined,
};

const DiscussionDataContext = createContext<DiscussionDataContextValue | null>(null);

const mergeEvents = (current: Event[], incoming: Event[]): Event[] => {
  const byId = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values()).sort(
    (left, right) =>
      right.created_at - left.created_at || left.id.localeCompare(right.id),
  );
};

const getDiscussionReference = (discussion: Discussion): string =>
  `34550:${discussion.authorPubkey}:${discussion.dTag}`;

const normalizeRelayUrl = (url: string): string => url.replace(/\/+$/, "");

const isUsableDiscussionMetadata = (value: unknown): value is Discussion => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const discussion = value as Partial<Discussion>;
  return typeof discussion.id === "string" &&
    typeof discussion.dTag === "string" &&
    typeof discussion.title === "string" &&
    typeof discussion.description === "string" &&
    typeof discussion.authorPubkey === "string" &&
    typeof discussion.createdAt === "number" &&
    Number.isFinite(discussion.createdAt) &&
    Array.isArray(discussion.moderators) &&
    discussion.moderators.every(
      (moderator) => Boolean(moderator && typeof moderator.pubkey === "string"),
    );
};

const pickLatestDiscussion = (
  events: NostrEventDTO[],
  discussionInfo: DiscussionInfo,
): Discussion | null => {
  const parsed = events
    .filter(
      (event) =>
        arePubkeysEqual(event.pubkey, discussionInfo.authorPubkey) &&
        event.tags.some(
          (tag) => tag[0] === "d" && tag[1] === discussionInfo.dTag,
        ),
    )
    .map(parseDiscussionEvent)
    .filter((discussion): discussion is Discussion => discussion !== null);
  if (parsed.length === 0) return null;
  return parsed.reduce((latest, current) =>
    current.createdAt > latest.createdAt ? current : latest,
  );
};

export function useDiscussionData(): DiscussionDataContextValue {
  const value = useContext(DiscussionDataContext);
  if (!value) {
    throw new Error("useDiscussionData must be used within DiscussionDataProvider");
  }
  return value;
}

export function useDiscussionMeta(): DiscussionMetaState | undefined {
  return useContext(DiscussionDataContext)?.meta;
}

export function useDiscussionContentData(): DiscussionContentState {
  return useContext(DiscussionDataContext)?.content ?? EMPTY_CONTENT_STATE;
}

export function useDiscussionManagementData(): DiscussionManagementState {
  return useDiscussionData().management;
}

export type DiscussionDataScope = "management" | "detail";

export function DiscussionDataProvider({
  children,
  discussionListNaddr,
  scope = "detail",
  read = true,
}: {
  children: React.ReactNode;
  discussionListNaddr?: string;
  scope?: DiscussionDataScope;
  /** Compatibility mode for route owners that already own the snapshot lifecycle. */
  read?: boolean;
}) {
  if (read === false) return <>{children}</>;
  return (
    <DiscussionDataProviderReadable
      discussionListNaddr={discussionListNaddr}
      scope={scope}
    >
      {children}
    </DiscussionDataProviderReadable>
  );
}

function DiscussionDataProviderReadable({
  children,
  discussionListNaddr,
  scope = "detail",
}: {
  children: React.ReactNode;
  discussionListNaddr?: string;
  scope?: DiscussionDataScope;
}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const params = useParams();
  const routeNaddr = typeof params?.naddr === "string" ? params.naddr : undefined;
  const managementScope = scope === "management";
  const targetNaddr = managementScope
    ? discussionListNaddr ?? process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR
    : routeNaddr;
  const discussionInfo = useMemo<DiscussionInfo | null>(
    () => (targetNaddr ? extractDiscussionFromNaddr(targetNaddr) : null),
    [targetNaddr],
  );
  const shouldLoadContent = Boolean(discussionInfo);

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(Boolean(discussionInfo));
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataCompletionReason, setMetadataCompletionReason] =
    useState<CompletionReason | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [contentLoading, setContentLoading] = useState(shouldLoadContent);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentCompletionReason, setContentCompletionReason] =
    useState<CompletionReason | null>(null);
  const [approvalState, setApprovalState] = useState<ApprovalState>("unknown");
  const [referencedDiscussionById, setReferencedDiscussionById] = useState(
    new Map<string, Discussion>(),
  );
  const [referencedDiscussionLoading, setReferencedDiscussionLoading] = useState(false);
  const [referencedDiscussionCompletionReason, setReferencedDiscussionCompletionReason] =
    useState<CompletionReason | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);

  const metadataLoadedRef = useRef<string | null>(null);
  const contentLoadedRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const primaryEventsRef = useRef<Event[]>([]);
  const approvalEventsRef = useRef<Event[]>([]);
  const attemptedRelayUrlsRef = useRef<string[]>([]);
  const relayUrlsRef = useRef<string[]>([]);
  const completionReasonRef = useRef<CompletionReason>("cancelled");
  const requestedReferenceIdsRef = useRef(new Set<string>());
  const activeDiscussionIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mutationGeneration = loadGenerationRef.current;

  const buildRelayUrls = useCallback(
    (
      knownData: ReturnType<typeof loadKnownDiscussionData<Discussion, Event>> | null,
      includeDiscussionHints: boolean,
    ) => {
      const cachedRelayUrls = [
        ...(knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays ?? []),
      ];
      const hintRelayUrls = new Set(
        (discussionInfo?.relays ?? []).map(normalizeRelayUrl),
      );
      const usableCachedRelayUrls = includeDiscussionHints
        ? cachedRelayUrls
        : cachedRelayUrls.filter(
            (relayUrl) => !hintRelayUrls.has(normalizeRelayUrl(relayUrl)),
          );
      const configured = [
        ...(includeDiscussionHints ? discussionInfo?.relays ?? [] : []),
        ...readableRelayUrls,
      ].map(normalizeRelayUrl);
      return Array.from(
        new Set([
          ...usableCachedRelayUrls.map(normalizeRelayUrl),
          ...configured,
        ]),
      );
    },
    [discussionInfo?.relays],
  );

  const rebuildContentFromEvents = useCallback(
    (
      primaryEvents: Event[],
      approvalEvents: Event[],
      nextCompletionReason: CompletionReason,
      approvalStateOverride?: ApprovalState,
    ) => {
      if (!discussionInfo) return;
      primaryEventsRef.current = primaryEvents;
      approvalEventsRef.current = approvalEvents;
      completionReasonRef.current = nextCompletionReason;

      const snapshot = createDiscussionModerationSnapshot({
        discussionId: discussionInfo.discussionId,
        primaryEvents,
        approvalEvents,
        relayUrls: relayUrlsRef.current,
        attemptedRelayUrls: attemptedRelayUrlsRef.current,
        completionReason: nextCompletionReason,
      });
      const nextApprovals = snapshot.approvalEvents
        .map(parseApprovalEvent)
        .filter((approval): approval is PostApproval => approval !== null);
      const nextApprovalState = approvalStateOverride ?? snapshot.approvalState;
      const nextPosts = snapshot.primaryEvents
        .map((event) => parsePostEvent(event, nextApprovals))
        .filter((post): post is DiscussionPost => post !== null)
        .filter((post) =>
          managementScope
            ? resolveDiscussionReferences(post.event?.tags ?? []).references.length > 0
            : true,
        )
        .map((post) => ({
          ...post,
          approvalState: (
            nextApprovalState === "unknown"
              ? "unknown"
              : snapshot.completionReason === "eose"
                ? post.approved
                  ? "approved"
                  : "unapproved"
                : "unknown"
          ) as DiscussionPost["approvalState"],
        }))
        .sort((left, right) => right.createdAt - left.createdAt);

      setApprovals(nextApprovals);
      setPosts(nextPosts);
      setApprovalState(nextApprovalState);
      setContentCompletionReason(snapshot.completionReason);
    },
    [discussionInfo, managementScope],
  );

  const loadData = useCallback(async () => {
    if (!discussionInfo) {
      setMetadataLoading(false);
      setContentLoading(false);
      setMetadataError("会話情報の指定が正しくありません。");
      return;
    }

    const generation = ++loadGenerationRef.current;
    const knownData = loadKnownDiscussionData<Discussion, Event>(
      discussionInfo.discussionId,
    );
    const metadataRelayUrls = buildRelayUrls(knownData, true);
    const contentRelayUrls = buildRelayUrls(knownData, !managementScope);
    relayUrlsRef.current = contentRelayUrls;
    setMetadataError(null);
    setContentError(null);
    setManagementError(null);
    requestedReferenceIdsRef.current.clear();

    if (isTestMode(discussionInfo.dTag)) {
      setMetadataLoading(true);
      setContentLoading(shouldLoadContent);
      try {
        const testData = await loadTestData();
        if (loadGenerationRef.current !== generation) return;
        setDiscussion(testData.discussion);
        setMetadataCompletionReason("eose");
        metadataLoadedRef.current = discussionInfo.discussionId;
        setMetadataLoading(false);
        if (shouldLoadContent) {
          setPosts(testData.posts);
          setApprovals([]);
          setApprovalState("approved");
          setContentCompletionReason("eose");
          contentLoadedRef.current = discussionInfo.discussionId;
          setContentLoading(false);
        }
      } catch (error) {
        if (loadGenerationRef.current !== generation) return;
        logger.error("Failed to load discussion test data:", error);
        setMetadataError("会話データの取得に失敗しました");
        setMetadataCompletionReason("hard-timeout");
        setMetadataLoading(false);
        setContentLoading(false);
      }
      return;
    }

    const cachedMetadata = knownData?.metadata;
    const hasMatchingCachedMetadata = Boolean(
      isUsableDiscussionMetadata(cachedMetadata) &&
      cachedMetadata.dTag === discussionInfo.dTag &&
      arePubkeysEqual(cachedMetadata.authorPubkey, discussionInfo.authorPubkey),
    );
    if (
      isUsableDiscussionMetadata(cachedMetadata) &&
      cachedMetadata.dTag === discussionInfo.dTag &&
      arePubkeysEqual(cachedMetadata.authorPubkey, discussionInfo.authorPubkey)
    ) {
      setDiscussion(cachedMetadata);
      setMetadataLoading(false);
    }
    const hasCachedContent = Boolean(shouldLoadContent && knownData?.events?.length);
    if (shouldLoadContent && knownData?.events?.length) {
      attemptedRelayUrlsRef.current = knownData.attemptedRelayUrls ?? [];
      rebuildContentFromEvents(
        knownData.events.filter((event) => event.kind !== 4550),
        knownData.events.filter((event) => event.kind === 4550),
        "cancelled",
      );
      setContentLoading(false);
    }

    if (metadataLoadedRef.current !== discussionInfo.discussionId) {
      if (!hasMatchingCachedMetadata) setMetadataLoading(true);
      try {
        const plan = createDiscussionReadPlan("discussion-meta", readStrategy, {
          authorPubkey: discussionInfo.authorPubkey,
          dTag: discussionInfo.dTag,
        });
        const metadataResult = await executeNostrRead(discussionReadTransport, {
          plan,
          relayUrls: metadataRelayUrls,
          onAttemptComplete: ({ events }) => {
            if (loadGenerationRef.current !== generation) return;
            const latest = pickLatestDiscussion(events, discussionInfo);
            if (latest) setDiscussion(latest);
          },
        });
        if (loadGenerationRef.current !== generation) return;

        const latest = pickLatestDiscussion(metadataResult.events, discussionInfo);
        if (latest) {
          setDiscussion(latest);
          saveKnownDiscussionData(discussionInfo.discussionId, {
            metadata: latest,
            eventIds: metadataResult.events.map((event) => event.id),
            attemptedRelayUrls: metadataResult.attemptedRelayUrls,
            successfulEventRelayUrls: metadataResult.successfulEventRelayUrls,
            successfulRelays: [],
            events: metadataResult.events as Event[],
          });
        } else if (
          !hasMatchingCachedMetadata &&
          metadataResult.completionReason === "eose"
        ) {
          setMetadataError("会話情報が見つかりませんでした。");
        }
        setMetadataCompletionReason(metadataResult.completionReason);
        metadataLoadedRef.current = discussionInfo.discussionId;
      } catch (error) {
        if (loadGenerationRef.current !== generation) return;
        logger.error("Failed to load discussion metadata:", error);
        setMetadataError("会話データの取得に失敗しました");
        setMetadataCompletionReason("hard-timeout");
      } finally {
        if (loadGenerationRef.current === generation) setMetadataLoading(false);
      }
    }

    if (
      shouldLoadContent &&
      contentLoadedRef.current !== discussionInfo.discussionId
    ) {
      if (!hasCachedContent) setContentLoading(true);
      try {
        const snapshot = await loadDiscussionModerationSnapshot(
          nostrService,
          readStrategy,
          {
            discussionId: discussionInfo.discussionId,
            relayUrls: contentRelayUrls,
            onPrimaryAttemptComplete: (attempt) => {
              if (loadGenerationRef.current !== generation) return;
              attemptedRelayUrlsRef.current = attempt.relayUrls;
              rebuildContentFromEvents(
                mergeEvents(primaryEventsRef.current, attempt.events as unknown as Event[]),
                approvalEventsRef.current,
                attempt.completionReason,
                "unknown",
              );
              setContentLoading(false);
            },
            onPrimaryComplete: (primary) => {
              if (loadGenerationRef.current !== generation) return;
              attemptedRelayUrlsRef.current = primary.attemptedRelayUrls;
              rebuildContentFromEvents(
                mergeEvents(primaryEventsRef.current, primary.events as unknown as Event[]),
                approvalEventsRef.current,
                primary.completionReason,
                "unknown",
              );
              setContentLoading(false);
            },
          },
        );
        if (loadGenerationRef.current !== generation) return;

        attemptedRelayUrlsRef.current = snapshot.attemptedRelayUrls;
        rebuildContentFromEvents(
          mergeEvents(primaryEventsRef.current, snapshot.primaryEvents),
          mergeEvents(approvalEventsRef.current, snapshot.approvalEvents),
          snapshot.completionReason,
        );
        contentLoadedRef.current = discussionInfo.discussionId;
        saveKnownDiscussionData(discussionInfo.discussionId, {
          metadata: knownData?.metadata ?? null,
          eventIds: [
            ...snapshot.primaryEvents.map((event) => event.id),
            ...snapshot.approvalEvents.map((event) => event.id),
          ],
          attemptedRelayUrls: snapshot.attemptedRelayUrls,
          successfulEventRelayUrls: snapshot.successfulRelayUrls,
          successfulRelays: [],
          events: [...snapshot.primaryEvents, ...snapshot.approvalEvents],
        });
      } catch (error) {
        if (loadGenerationRef.current !== generation) return;
        logger.error("Failed to load discussion content:", error);
        setContentError("投稿データの取得に失敗しました。");
        setContentCompletionReason("hard-timeout");
        setManagementError("会話一覧の取得に失敗しました。時間をおいて再度お試しください。");
      } finally {
        if (loadGenerationRef.current === generation) setContentLoading(false);
      }
    } else if (!shouldLoadContent) {
      setContentLoading(false);
    }
  }, [buildRelayUrls, discussionInfo, managementScope, rebuildContentFromEvents, shouldLoadContent]);

  useEffect(() => {
    const nextDiscussionId = discussionInfo?.discussionId ?? null;
    if (activeDiscussionIdRef.current !== nextDiscussionId) {
      loadGenerationRef.current += 1;
      activeDiscussionIdRef.current = nextDiscussionId;
      metadataLoadedRef.current = null;
      contentLoadedRef.current = null;
      primaryEventsRef.current = [];
      approvalEventsRef.current = [];
      attemptedRelayUrlsRef.current = [];
      relayUrlsRef.current = [];
      completionReasonRef.current = "cancelled";
      requestedReferenceIdsRef.current.clear();
      setDiscussion(null);
      setPosts([]);
      setApprovals([]);
      setReferencedDiscussionById(new Map());
      setReferencedDiscussionLoading(false);
      setReferencedDiscussionCompletionReason(null);
      setMetadataCompletionReason(null);
      setContentCompletionReason(null);
      setApprovalState("unknown");
    }

    if (!discussionInfo) {
      setMetadataLoading(false);
      setContentLoading(false);
      setMetadataError("会話情報の指定が正しくありません。");
      setMetadataCompletionReason("cancelled");
      setContentError(null);
      setContentCompletionReason("cancelled");
      return;
    }
    void loadData();
  }, [discussionInfo, loadData]);

  const reload = useCallback(async () => {
    const reloadDiscussionId = discussionInfo?.discussionId ?? null;
    if (activeDiscussionIdRef.current !== reloadDiscussionId) return;
    loadGenerationRef.current += 1;
    metadataLoadedRef.current = null;
    contentLoadedRef.current = null;
    primaryEventsRef.current = [];
    approvalEventsRef.current = [];
    attemptedRelayUrlsRef.current = [];
    relayUrlsRef.current = [];
    completionReasonRef.current = "cancelled";
    requestedReferenceIdsRef.current.clear();
    setDiscussion(null);
    setPosts([]);
    setApprovals([]);
    setReferencedDiscussionById(new Map());
    setReferencedDiscussionLoading(false);
    setReferencedDiscussionCompletionReason(null);
    setMetadataCompletionReason(null);
    setContentCompletionReason(null);
    setApprovalState("unknown");
    await loadData();
  }, [discussionInfo?.discussionId, loadData]);

  const addPost = useCallback((post: DiscussionPost) => {
    if (
      activeDiscussionIdRef.current !== discussionInfo?.discussionId ||
      loadGenerationRef.current !== mutationGeneration
    ) return;
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
    primaryEventsRef.current = mergeEvents(primaryEventsRef.current, [post.event]);
  }, [discussionInfo?.discussionId, mutationGeneration]);

  const addApproval = useCallback(
    (approval: PostApproval) => {
      if (
        activeDiscussionIdRef.current !== discussionInfo?.discussionId ||
        loadGenerationRef.current !== mutationGeneration
      ) return;
      approvalEventsRef.current = mergeEvents(approvalEventsRef.current, [approval.event]);
      setApprovals((current) => [approval, ...current.filter((item) => item.id !== approval.id)]);
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
    },
    [discussionInfo?.discussionId, mutationGeneration],
  );

  const removeApproval = useCallback(
    (approvalId: string) => {
      if (
        activeDiscussionIdRef.current !== discussionInfo?.discussionId ||
        loadGenerationRef.current !== mutationGeneration
      ) return;
      approvalEventsRef.current = approvalEventsRef.current.filter(
        (event) => event.id !== approvalId,
      );
      rebuildContentFromEvents(
        primaryEventsRef.current,
        approvalEventsRef.current,
        completionReasonRef.current,
      );
    },
    [discussionInfo?.discussionId, mutationGeneration, rebuildContentFromEvents],
  );

  const mergeModerationEvents = useCallback(
    ({ primaryEvents = [], approvalEvents = [], completionReason }: MergeModerationEventsInput) => {
      if (
        activeDiscussionIdRef.current !== discussionInfo?.discussionId ||
        loadGenerationRef.current !== mutationGeneration
      ) return;
      rebuildContentFromEvents(
        mergeEvents(primaryEventsRef.current, primaryEvents),
        mergeEvents(approvalEventsRef.current, approvalEvents),
        completionReason ?? completionReasonRef.current,
      );
    },
    [discussionInfo?.discussionId, mutationGeneration, rebuildContentFromEvents],
  );

  useEffect(() => {
    if (!managementScope || !shouldLoadContent || contentLoading) return;
    const referenceSource = pathname === "/discussions/manage"
      ? posts
      : posts.filter((post) => post.approved || post.approvalState === "unknown");
    const references = resolveDiscussionReferences(
      referenceSource.flatMap((post) => post.event?.tags ?? []),
    ).references;
    const missingReferences = references.filter(
      (reference) =>
        !referencedDiscussionById.has(reference.discussionId) &&
        !requestedReferenceIdsRef.current.has(reference.discussionId),
    );
    if (missingReferences.length === 0) return;

    missingReferences.forEach((reference) =>
      requestedReferenceIdsRef.current.add(reference.discussionId),
    );
    setReferencedDiscussionLoading(true);
    const referenceGeneration = loadGenerationRef.current;
    const referencePlan = createDiscussionReadPlan("discussion-references", readStrategy, {
      references: missingReferences,
    });
    void executeNostrRead(discussionReadTransport, {
      plan: referencePlan,
      relayUrls: readableRelayUrls,
    })
      .then((result) => {
        if (
          !isMountedRef.current ||
          loadGenerationRef.current !== referenceGeneration
        ) return;
        const discussions = result.events
          .map(parseDiscussionEvent)
          .filter((item): item is Discussion => item !== null);
        setReferencedDiscussionCompletionReason(result.completionReason);
        setReferencedDiscussionById((current) => {
          const next = new Map(current);
          discussions.forEach((item) => next.set(getDiscussionReference(item), item));
          return next;
        });
      })
      .catch((error) => {
        if (
          !isMountedRef.current ||
          loadGenerationRef.current !== referenceGeneration
        ) return;
        logger.error("Failed to load referenced discussions:", error);
        missingReferences.forEach((reference) =>
          requestedReferenceIdsRef.current.delete(reference.discussionId),
        );
      })
      .finally(() => {
        if (
          isMountedRef.current &&
          loadGenerationRef.current === referenceGeneration
        ) {
          setReferencedDiscussionLoading(false);
        }
      });
  }, [contentLoading, managementScope, pathname, posts, referencedDiscussionById, shouldLoadContent]);

  const meta = useMemo<DiscussionMetaState>(
    () => ({
      discussion,
      isLoading: metadataLoading,
      error: metadataError,
      completionReason: metadataCompletionReason,
      reload,
    }),
    [discussion, metadataCompletionReason, metadataError, metadataLoading, reload],
  );

  const content = useMemo<DiscussionContentState>(
    () => ({
      posts,
      approvals,
      isLoading: contentLoading,
      error: contentError,
      completionReason: contentCompletionReason,
      approvalState,
      reload,
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
      contentCompletionReason,
      contentError,
      contentLoading,
      mergeModerationEvents,
      posts,
      reload,
      removeApproval,
    ],
  );

  const management = useMemo<DiscussionManagementState>(
    () => ({
      ...content,
      referencedDiscussions: Array.from(referencedDiscussionById.values()),
      isModerationLoading: contentLoading,
      isReferencedDiscussionsLoading: referencedDiscussionLoading,
      referencedDiscussionCompletionReason,
      moderationError: managementError,
      reloadModeration: reload,
      removeManagementApproval: (approvalId, postId, moderatorPubkey) => {
        if (
          activeDiscussionIdRef.current !== discussionInfo?.discussionId ||
          loadGenerationRef.current !== mutationGeneration
        ) return;
        void postId;
        void moderatorPubkey;
        removeApproval(approvalId);
      },
    }),
    [
      content,
      contentLoading,
      discussionInfo?.discussionId,
      managementError,
      mutationGeneration,
      referencedDiscussionById,
      referencedDiscussionCompletionReason,
      referencedDiscussionLoading,
      reload,
      removeApproval,
    ],
  );

  return (
    <DiscussionDataContext.Provider value={{ meta, content, management }}>
      {children}
    </DiscussionDataContext.Provider>
  );
}
