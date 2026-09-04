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
import {
  getDiscussionReadStrategyConfig,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { appConfig } from "@/lib/config/app-config";
import type {
  DiscussionManagementReadResult,
  DiscussionManagementRelayProvenance,
  DiscussionManagementSnapshot,
} from "@/lib/discussion/discussion-management-read-coordinator";
import { createDiscussionNdkGateway } from "@/lib/nostr/discussion-ndk-gateway";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import type { PostApproval } from "@/types/discussion";

export interface DiscussionManagementModel {
  state: "loading" | "ready" | "partial" | "error";
  snapshot: DiscussionManagementSnapshot | null;
  error: string | null;
  completionReason?: DiscussionManagementReadResult["completionReason"];
  relayProvenance?: DiscussionManagementRelayProvenance | null;
  reload: () => Promise<void>;
  addApproval?: (approval: PostApproval) => void;
  removeApproval?: (approvalId: string) => void;
}

interface DiscussionManagementProviderProps {
  children: React.ReactNode;
  /** Explicit list naddr; the public environment setting is the fallback. */
  discussionListNaddr?: string;
}

const config = getNostrServiceConfig();
const strategy = getDiscussionReadStrategyConfig();
const gateway = createDiscussionNdkGateway(config);
const configuredRelayUrls = (config.relays ?? [])
  .filter((relay) => relay.read)
  .map((relay) => relay.url);

const emptyReload = async (): Promise<void> => undefined;
const emptyMutation = (): void => undefined;
const EMPTY_MANAGEMENT_MODEL: DiscussionManagementModel = {
  state: "loading",
  snapshot: null,
  error: null,
  completionReason: null,
  relayProvenance: null,
  reload: emptyReload,
  addApproval: () => emptyMutation(),
  removeApproval: () => emptyMutation(),
};

const DiscussionManagementContext =
  createContext<DiscussionManagementModel | null>(null);

export function useDiscussionManagement(): DiscussionManagementModel {
  return useContext(DiscussionManagementContext) ?? EMPTY_MANAGEMENT_MODEL;
}

export function DiscussionManagementProvider({
  children,
  discussionListNaddr,
}: DiscussionManagementProviderProps) {
  const targetNaddr =
    discussionListNaddr ?? appConfig.discussion.discussionListNaddr;
  const discussionInfo = useMemo(
    () => (targetNaddr ? extractDiscussionFromNaddr(targetNaddr) : null),
    [targetNaddr],
  );
  const identity = discussionInfo?.discussionId ?? targetNaddr ?? null;
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
  const [session, setSession] = useState<DiscussionManagementModel>(() => ({
    ...EMPTY_MANAGEMENT_MODEL,
    state: identity ? "loading" : "error",
    error: identity ? null : "掲載一覧の会話URLが設定されていません。",
  }));

  const isCurrentGeneration = useCallback(
    (generation: number, expectedIdentity: string | null): boolean =>
      generationRef.current === generation &&
      activeIdentityRef.current === expectedIdentity,
    [],
  );

  const resetSession = useCallback(() => {
    setSession((current) => ({
      ...current,
      state: "loading",
      snapshot: null,
      error: null,
      completionReason: null,
      relayProvenance: null,
    }));
  }, []);

  const runRead = useCallback(
    async (
      generation: number,
      expectedIdentity: string | null,
    ): Promise<void> => {
      if (!discussionInfo || !expectedIdentity) {
        if (!isCurrentGeneration(generation, expectedIdentity)) return;
        setSession((current) => ({
          ...current,
          state: "error",
          snapshot: null,
          error: "掲載一覧の会話URLを解釈できません。",
          completionReason: "cancelled",
          relayProvenance: null,
        }));
        return;
      }

      const { readDiscussionManagement } = await import(
        "@/lib/discussion/discussion-management-read-coordinator",
      );
      const result = await readDiscussionManagement({
        gateway,
        discussionId: discussionInfo.discussionId,
        authorPubkey: discussionInfo.authorPubkey,
        dTag: discussionInfo.dTag,
        relayUrls,
        strategy,
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
        relayProvenance: result.relayProvenance,
      }));
    },
    [discussionInfo, isCurrentGeneration, relayUrls],
  );

  useEffect(() => {
    const generation = ++generationRef.current;
    activeIdentityRef.current = identity;
    committedGenerationRef.current = -1;
    resetSession();

    if (!identity) {
      setSession((current) => ({
        ...current,
        state: "error",
        error: "掲載一覧の会話URLが設定されていません。",
        completionReason: "cancelled",
      }));
      return;
    }

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
  }, [identity, isCurrentGeneration, resetSession, runRead]);

  const reload = useCallback(async (): Promise<void> => {
    const generation = ++generationRef.current;
    activeIdentityRef.current = identity;
    committedGenerationRef.current = -1;
    resetSession();
    await runRead(generation, identity);
  }, [identity, resetSession, runRead]);

  const canMutate = useCallback(
    () =>
      Boolean(identity) &&
      activeIdentityRef.current === identity &&
      committedGenerationRef.current === generationRef.current,
    [identity],
  );

  const addApproval = useCallback(
    (approval: PostApproval): void => {
      if (!canMutate()) return;
      setSession((current) => {
        // A partial snapshot deliberately keeps approvalState="unknown".
        // Do not let an optimistic write turn an unconfirmed read into a
        // confirmed approval while the route is still loading or degraded.
        if (current.state !== "ready" || !current.snapshot) return current;
        const approvals = [
          approval,
          ...current.snapshot.listingApprovals.filter(
            (item) => item.id !== approval.id,
          ),
        ];
        const listingPosts = current.snapshot.listingPosts.map((post) => {
          if (post.id !== approval.postId) return post;
          return {
            ...post,
            approved: true,
            approvalState: "approved" as const,
            approvedBy: [
              ...(post.approvedBy ?? []).filter(
                (pubkey) => pubkey !== approval.moderatorPubkey,
              ),
              approval.moderatorPubkey,
            ],
            approvedAt: Math.min(
              approval.createdAt,
              post.approvedAt ?? approval.createdAt,
            ),
          };
        });
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            listingPosts,
            listingApprovals: approvals,
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
        const approvals = current.snapshot.listingApprovals.filter(
          (approval) => approval.id !== approvalId,
        );
        const listingPosts = current.snapshot.listingPosts.map((post) => {
          const postApprovals = approvals.filter(
            (approval) => approval.postId === post.id,
          );
          return {
            ...post,
            approved: postApprovals.length > 0,
            approvalState: postApprovals.length > 0
              ? ("approved" as const)
              : ("unapproved" as const),
            approvedBy: postApprovals.map(
              (approval) => approval.moderatorPubkey,
            ),
            approvedAt: postApprovals.length > 0
              ? Math.min(...postApprovals.map((approval) => approval.createdAt))
              : undefined,
          };
        });
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            listingPosts,
            listingApprovals: approvals,
          },
        };
      });
    },
    [canMutate],
  );

  const model = useMemo<DiscussionManagementModel>(
    () => ({ ...session, reload, addApproval, removeApproval }),
    [addApproval, reload, removeApproval, session],
  );

  return (
    <DiscussionManagementContext.Provider value={model}>
      {children}
    </DiscussionManagementContext.Provider>
  );
}
