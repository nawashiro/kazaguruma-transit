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
import { useParams } from "next/navigation";
import {
  getDiscussionReadStrategyConfig,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { createDiscussionNdkGateway } from "@/lib/nostr/discussion-ndk-gateway";
import {
  readDiscussionDetail,
  type DiscussionDetailReadResult,
  type DiscussionDetailSnapshot,
  type ModeratorRequest,
} from "@/lib/discussion/discussion-detail-read-coordinator";
import type {
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";

export interface DiscussionDetailModel {
  state: "loading" | "ready" | "partial" | "error";
  snapshot: DiscussionDetailSnapshot | null;
  error: string | null;
  completionReason: DiscussionDetailReadResult["completionReason"];
  relayProvenance: DiscussionDetailSnapshot["relayProvenance"] | null;
  /** True only for consumers rendered outside the provider boundary. */
  isFallback?: boolean;
  reload: () => Promise<void>;
  addPost: (post: DiscussionPost) => void;
  addApproval: (approval: PostApproval) => void;
  removeApproval: (approvalId: string) => void;
}

interface DiscussionDetailProviderProps {
  children: React.ReactNode;
  /** The current viewer is used only to derive userEvaluationIds. */
  userPubkey?: string | null;
}

const config = getNostrServiceConfig();
const strategy = typeof getDiscussionReadStrategyConfig === "function"
  ? getDiscussionReadStrategyConfig()
  : {
      idleTimeoutMs: config.defaultTimeout,
      hardTimeoutMs: config.defaultTimeout * 3,
      dedupWindowMs: 0,
    };
const gateway = createDiscussionNdkGateway(config);
const configuredRelayUrls = (config.relays ?? [])
  .filter((relay) => relay.read)
  .map((relay) => relay.url);

const emptyReload = async (): Promise<void> => undefined;
const emptyMutation = (): void => undefined;
const EMPTY_DETAIL_MODEL: DiscussionDetailModel = {
  state: "loading",
  snapshot: null,
  error: null,
  completionReason: null,
  relayProvenance: null,
  isFallback: true,
  reload: emptyReload,
  addPost: emptyMutation,
  addApproval: emptyMutation,
  removeApproval: emptyMutation,
};

const DiscussionDetailContext = createContext<DiscussionDetailModel | null>(
  null,
);

const mergePosts = (
  current: DiscussionPost[],
  incoming: DiscussionPost,
): DiscussionPost[] => [
  incoming,
  ...current.filter((post) => post.id !== incoming.id),
];

const mergeApprovals = (
  current: PostApproval[],
  incoming: PostApproval,
): PostApproval[] => [
  incoming,
  ...current.filter((approval) => approval.id !== incoming.id),
];

const updatePostsForApprovals = (
  posts: DiscussionPost[],
  approvals: PostApproval[],
): DiscussionPost[] =>
  posts.map((post) => {
    const postApprovals = approvals.filter(
      (approval) => approval.postId === post.id,
    );
    return {
      ...post,
      approved: postApprovals.length > 0,
      approvedBy: postApprovals.map((approval) => approval.moderatorPubkey),
      approvedAt:
        postApprovals.length > 0
          ? Math.min(...postApprovals.map((approval) => approval.createdAt))
          : undefined,
      approvalState: postApprovals.length > 0 ? "approved" : "unapproved",
    };
  });

export function useDiscussionDetail(): DiscussionDetailModel {
  return useContext(DiscussionDetailContext) ?? EMPTY_DETAIL_MODEL;
}

export function DiscussionDetailProvider({
  children,
  userPubkey = null,
}: DiscussionDetailProviderProps) {
  const params = useParams<{ naddr?: string | string[] }>();
  const naddr = Array.isArray(params?.naddr)
    ? params.naddr[0]
    : params?.naddr;
  const discussionInfo = useMemo(
    () => (naddr ? extractDiscussionFromNaddr(naddr) : null),
    [naddr],
  );
  const identity = discussionInfo?.discussionId ?? naddr ?? null;
  const relayUrls = useMemo(
    () =>
      Array.from(
        new Set([
          ...(discussionInfo?.relays ?? []),
          ...configuredRelayUrls,
        ]),
      ),
    [discussionInfo?.relays],
  );
  const generationRef = useRef(0);
  const activeIdentityRef = useRef<string | null>(null);
  const committedGenerationRef = useRef(-1);
  const userPubkeyRef = useRef<string | null>(userPubkey);
  userPubkeyRef.current = userPubkey;
  const [session, setSession] = useState<DiscussionDetailModel>(() => ({
    ...EMPTY_DETAIL_MODEL,
    isFallback: false,
  }));

  const isCurrentGeneration = useCallback(
    (generation: number, expectedIdentity: string | null): boolean =>
      generationRef.current === generation &&
      activeIdentityRef.current === expectedIdentity,
    [],
  );

  const runRead = useCallback(
    async (
      generation: number,
      expectedIdentity: string | null,
    ): Promise<void> => {
      if (!discussionInfo || !expectedIdentity) {
        if (isCurrentGeneration(generation, expectedIdentity)) {
          setSession((current) => ({
            ...current,
            state: "error",
            snapshot: null,
            error: "会話URLを解釈できません。",
            completionReason: "cancelled",
            relayProvenance: null,
          }));
        }
        return;
      }

      const result = await readDiscussionDetail({
        gateway,
        discussionId: discussionInfo.discussionId,
        authorPubkey: discussionInfo.authorPubkey,
        dTag: discussionInfo.dTag,
        relayUrls,
        strategy,
        userPubkey: userPubkeyRef.current,
        isCurrent: () => isCurrentGeneration(generation, expectedIdentity),
      });

      if (!isCurrentGeneration(generation, expectedIdentity)) return;
      if (result.snapshot) committedGenerationRef.current = generation;
      setSession((current) => ({
        ...current,
        state: result.state,
        snapshot: result.snapshot,
        error: result.error,
        completionReason: result.completionReason,
        relayProvenance: result.snapshot?.relayProvenance ?? null,
      }));
    },
    [discussionInfo, isCurrentGeneration, relayUrls],
  );

  useEffect(() => {
    const generation = ++generationRef.current;
    activeIdentityRef.current = identity;
    committedGenerationRef.current = -1;
    setSession((current) => ({
      ...current,
      state: "loading",
      snapshot: null,
      error: null,
      completionReason: null,
      relayProvenance: null,
    }));
    void runRead(generation, identity).catch((error: unknown) => {
      if (!isCurrentGeneration(generation, identity)) return;
      setSession((current) => ({
        ...current,
        state: "error",
        snapshot: null,
        error: error instanceof Error ? error.message : String(error),
        completionReason: null,
        relayProvenance: null,
      }));
    });
  }, [identity, isCurrentGeneration, runRead]);

  const reload = useCallback(async (): Promise<void> => {
    // A reload callback belongs to the identity it was created for. If the
    // active route has moved on, the retained callback must not hijack the
    // active identity or start a new generation for the old discussion.
    if (activeIdentityRef.current !== identity) return;
    const generation = ++generationRef.current;
    committedGenerationRef.current = -1;
    setSession((current) => ({
      ...current,
      state: "loading",
      snapshot: null,
      error: null,
      completionReason: null,
      relayProvenance: null,
    }));
    await runRead(generation, identity);
  }, [identity, runRead]);

  // A mutation callback is valid only for the generation in which it was
  // created. Capturing the generation at render time (and including it in
  // the useCallback deps) lets a callback retained from before a reload or
  // a route change be gated out against the newer generation.
  const mutationGeneration = generationRef.current;

  const canMutate = useCallback(
    () =>
      Boolean(identity) &&
      activeIdentityRef.current === identity &&
      committedGenerationRef.current === generationRef.current &&
      mutationGeneration === generationRef.current,
    [identity, mutationGeneration],
  );

  const addPost = useCallback(
    (post: DiscussionPost): void => {
      if (!canMutate()) return;
      setSession((current) => {
        if (!current.snapshot) return current;
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            posts: mergePosts(current.snapshot.posts, post),
          },
        };
      });
    },
    [canMutate],
  );

  const addApproval = useCallback(
    (approval: PostApproval): void => {
      if (!canMutate()) return;
      setSession((current) => {
        // A partial snapshot deliberately keeps approvalState="unknown".
        // Do not let an optimistic write turn an unconfirmed read into a
        // confirmed approval while the route is still loading or degraded.
        if (current.state !== "ready" || !current.snapshot) return current;
        const approvals = mergeApprovals(current.snapshot.approvals, approval);
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            approvals,
            posts: updatePostsForApprovals(current.snapshot.posts, approvals),
          },
        };
      });
    },
    [canMutate],
  );

  const removeApproval = useCallback(
    (approvalId: string): void => {
      if (!canMutate()) return;
      setSession((current) => {
        if (current.state !== "ready" || !current.snapshot) return current;
        const approvals = current.snapshot.approvals.filter(
          (approval) => approval.id !== approvalId,
        );
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            approvals,
            posts: updatePostsForApprovals(current.snapshot.posts, approvals),
          },
        };
      });
    },
    [canMutate],
  );

  const snapshotForViewer = useMemo(() => {
    if (!session.snapshot) return null;
    const userEvaluationIds = new Set(
      session.snapshot.evaluations
        .filter(
          (evaluation) =>
            evaluation.evaluatorPubkey === (userPubkey ?? null),
        )
        .map((evaluation) => evaluation.id),
    );
    return {
      ...session.snapshot,
      userEvaluationIds,
    };
  }, [session.snapshot, userPubkey]);

  const model = useMemo<DiscussionDetailModel>(
    () => ({
      ...session,
      snapshot: snapshotForViewer,
      reload,
      addPost,
      addApproval,
      removeApproval,
    }),
    [addApproval, addPost, reload, removeApproval, session, snapshotForViewer],
  );

  return (
    <DiscussionDetailContext.Provider value={model}>
      {children}
    </DiscussionDetailContext.Provider>
  );
}

export type { ModeratorRequest };
