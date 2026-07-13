"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscussionMeta } from "@/components/discussion/DiscussionTabLayout";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
  getDiscussionReadStrategyConfig,
} from "@/lib/config/discussion-config";
import { selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";
import { loadKnownDiscussionData, saveKnownDiscussionData } from "@/lib/discussion/discussion-known-data-cache";
import { createDiscussionModerationSnapshot } from "@/lib/discussion/discussion-moderation-snapshot";
import { loadDiscussionModerationSnapshot } from "@/lib/discussion/discussion-moderation-snapshot";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";
import {
  buildDisabledActionState,
  DisabledReasonText,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parsePostEvent,
  parseApprovalEvent,
  formatRelativeTime,
  getAdminPubkeyHex,
  isModerator,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import type {
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import {
  CheckBadgeIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import type { Event } from "@/lib/nostr/nostr-service";
import { isModeratorRequestEvent } from "@/lib/discussion/moderator-request";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrServiceConfig = getNostrServiceConfig();
const readStrategy = typeof getDiscussionReadStrategyConfig === "function" ? getDiscussionReadStrategyConfig() : { relayLimit: 3, idleTimeoutMs: nostrServiceConfig.defaultTimeout, hardTimeoutMs: nostrServiceConfig.defaultTimeout * 3, dedupWindowMs: 250 };
const nostrService = createNostrService(nostrServiceConfig);

export default function PostApprovalPage() {
  const params = useParams();
  const naddrParam = params.naddr as string;
  const discussionMeta = useDiscussionMeta();
  const discussion = discussionMeta?.discussion ?? null;
  const isDiscussionLoading = discussionMeta?.isLoading ?? false;
  const discussionCompletionReason = discussionMeta?.completionReason ?? null;

  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvalState, setApprovalState] = useState<"approved" | "unapproved" | "unknown">("unknown");
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const postsEventsRef = useRef<Event[]>([]);
  const approvalEventsRef = useRef<Event[]>([]);
  const approvalStreamCleanupRef = useRef<(() => void) | null>(null);
  const completionReasonRef = useRef<"eose" | "idle-timeout" | "hard-timeout" | "cancelled">("eose");

  const mergeStreamEvents = useCallback((current: Event[], incoming: Event[]): Event[] => {
    const byId = new Map(current.map((event) => [event.id, event]));
    incoming.forEach((event) => byId.set(event.id, event));
    return Array.from(byId.values()).sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id));
  }, []);

  const { user, signEvent } = useAuth();

  // Parse naddr and extract discussion info
  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);
  const rebuildFromEvents = useCallback(() => {
    const relayCandidates = selectRelayCandidates({
      hints: discussionInfo?.relays,
      successful: discussionInfo ? loadKnownDiscussionData<unknown, Event>(discussionInfo.discussionId)?.successfulRelays : [],
      configured: (nostrServiceConfig.relays ?? []).filter((relay) => relay.read).map((relay) => relay.url),
      defaults: [],
      limit: readStrategy.relayLimit,
    });
    const snapshot = createDiscussionModerationSnapshot({
      discussionId: discussionInfo?.discussionId ?? "",
      primaryEvents: postsEventsRef.current,
      approvalEvents: approvalEventsRef.current,
      relayCandidates,
      attemptedRelayUrls: relayCandidates.map((candidate) => candidate.url),
      completionReason: completionReasonRef.current,
    });
    setApprovalState(snapshot.approvalState);
    const parsedApprovals = approvalEventsRef.current
      .map(parseApprovalEvent)
      .filter((a): a is PostApproval => a !== null);

    const parsedPosts = snapshot.primaryEvents
      .map((event) => parsePostEvent(event, parsedApprovals))
      .filter((p): p is DiscussionPost => p !== null)
      .sort((a, b) => b.createdAt - a.createdAt);

    setApprovals(parsedApprovals);
    setPosts(parsedPosts);
  }, [discussionInfo]);

  const startStreaming = useCallback(() => {
    if (!isDiscussionsEnabled() || !discussionInfo) return;
    setIsLoading(true);
    approvalStreamCleanupRef.current?.();
    approvalEventsRef.current = [];
    postsEventsRef.current = [];
    const knownData = loadKnownDiscussionData<unknown, Event>(discussionInfo.discussionId);
    const relayUrls = selectRelayCandidates({
      hints: discussionInfo.relays,
      successful: knownData?.successfulRelays,
      configured: (nostrServiceConfig.relays ?? []).filter((relay) => relay.read).map((relay) => relay.url),
      defaults: [],
      limit: readStrategy.relayLimit,
    }).map((relay) => relay.url);

    const postsStream = nostrService.streamEventsOnEvent(
      [
        {
          kinds: [1111, 1],
          "#a": [discussionInfo.discussionId],
        },
      ],
      {
        onEvent: (events) => {
          postsEventsRef.current = mergeStreamEvents(postsEventsRef.current, events.filter((event) => !isModeratorRequestEvent(event)));
          rebuildFromEvents();
        },
        onEose: (events) => {
          const normalPosts = events.filter((event) => !isModeratorRequestEvent(event));
          postsEventsRef.current = mergeStreamEvents(postsEventsRef.current, normalPosts);
          rebuildFromEvents();
          saveKnownDiscussionData(discussionInfo.discussionId, { metadata: null, eventIds: normalPosts.map((event) => event.id), attemptedRelayUrls: relayUrls, successfulRelays: [], events: normalPosts });
          setIsLoading(false);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
        ...(relayUrls.length > 0 ? { relayUrls } : {}),
      }
    );

    const approvalsStream = nostrService.streamApprovals(
      discussionInfo.discussionId,
      {
        onEvent: (events) => {
          approvalEventsRef.current = mergeStreamEvents(approvalEventsRef.current, events);
          rebuildFromEvents();
        },
        onEose: (events) => {
          approvalEventsRef.current = mergeStreamEvents(approvalEventsRef.current, events);
          rebuildFromEvents();
          saveKnownDiscussionData(discussionInfo.discussionId, { metadata: null, eventIds: events.map((event) => event.id), attemptedRelayUrls: relayUrls, successfulRelays: [], events });
          setIsLoading(false);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
        ...(relayUrls.length > 0 ? { relayUrls } : {}),
      }
    );

    if (typeof nostrService.getEventsWithCompletion === "function") {
      void loadDiscussionModerationSnapshot(nostrService, readStrategy, {
        discussionId: discussionInfo.discussionId,
        hints: discussionInfo.relays,
        successful: knownData?.successfulRelays,
        configured: (nostrServiceConfig.relays ?? []).filter((relay) => relay.read).map((relay) => relay.url),
        defaults: [],
      }).then((snapshot) => {
        completionReasonRef.current = snapshot.completionReason;
        saveKnownDiscussionData(discussionInfo.discussionId, {
          metadata: null,
          eventIds: snapshot.approvalEvents.map((event) => event.id),
          attemptedRelayUrls: snapshot.attemptedRelayUrls,
          successfulRelays: snapshot.successfulRelayUrls,
          events: snapshot.approvalEvents,
        });
        postsEventsRef.current = mergeStreamEvents(postsEventsRef.current, snapshot.primaryEvents);
        approvalEventsRef.current = mergeStreamEvents(approvalEventsRef.current, snapshot.approvalEvents);
        rebuildFromEvents();
      });
    }

    approvalStreamCleanupRef.current = () => {
      postsStream();
      approvalsStream();
    };
  }, [discussionInfo, mergeStreamEvents, nostrServiceConfig.defaultTimeout, rebuildFromEvents]);

  useEffect(() => {
    if (isDiscussionsEnabled() && discussionInfo) {
      startStreaming();
    }
    return () => {
      approvalStreamCleanupRef.current?.();
    };
  }, [startStreaming, discussionInfo]);

  const handleApprovePost = async (post: DiscussionPost) => {
    const canModerate = discussion
      ? isModerator(
        user.pubkey,
        discussion.moderators.map((m) => m.pubkey),
        ADMIN_PUBKEY
      ) || user.pubkey === discussion.authorPubkey
      : false;
    if (!user.isLoggedIn || !discussion || !canModerate) return;

    setApprovingIds((prev) => new Set([...prev, post.id]));
    try {
      const eventTemplate = nostrService.createApprovalEvent(
        post.event,
        discussion.id
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish approval to relays");
      }

      // 楽観的な更新
      const newApproval: PostApproval = {
        id: signedEvent.id,
        postId: post.id,
        postAuthorPubkey: post.authorPubkey,
        moderatorPubkey: user.pubkey || "",
        discussionId: discussion.id,
        createdAt: signedEvent.created_at,
        event: signedEvent,
      };

      approvalEventsRef.current = mergeStreamEvents(approvalEventsRef.current, [signedEvent as Event]);

      setApprovals((prev) => [...prev, newApproval]);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
              ...p,
              approved: true,
              approvedBy: [...(p.approvedBy || []), user.pubkey || ""],
              approvedAt: signedEvent.created_at,
            }
            : p
        )
      );
    } catch (error) {
      logger.error("Failed to approve post:", error);
    } finally {
      setApprovingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(post.id);
        return newSet;
      });
    }
  };

  const handleRevokeApproval = async (post: DiscussionPost) => {
    const canModerate = discussion
      ? isModerator(
        user.pubkey,
        discussion.moderators.map((m) => m.pubkey),
        ADMIN_PUBKEY
      ) || user.pubkey === discussion.authorPubkey
      : false;
    if (!user.isLoggedIn || !discussion || !canModerate) return;

    const approval = approvals.find(
      (a) => a.postId === post.id && a.moderatorPubkey === user.pubkey
    );
    if (!approval) return;

    setRevokingIds((prev) => new Set([...prev, post.id]));
    try {
      const eventTemplate = nostrService.createRevocationEvent(
        approval.id,
        discussion.id
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish revocation to relays");
      }

      // 楽観的な更新 - 承認を削除
      setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
              ...p,
              approved: false,
              approvedBy:
                p.approvedBy?.filter((pubkey) => pubkey !== user.pubkey) ||
                [],
              approvedAt: undefined,
            }
            : p
        )
      );
    } catch (error) {
      logger.error("Failed to revoke approval:", error);
    } finally {
      setRevokingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(post.id);
        return newSet;
      });
    }
  };

  // Check for invalid naddr
  if (!discussionInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">無効な会話URL</h1>
          <p className="text-gray-600 mb-4">指定された会話URLが無効です。</p>
          <Link
            href="/discussions"
            className="btn btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">投稿承認</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const pendingPosts = posts.filter((post) => !post.approved);
  const approvedPosts = posts.filter((post) => post.approved);
  const hasApprovalPermission = Boolean(
    discussion &&
    (user.pubkey === discussion.authorPubkey ||
      isModerator(
        user.pubkey,
        discussion.moderators.map((m) => m.pubkey),
        ADMIN_PUBKEY
      ))
  );
  const permissionReason = !user.isLoggedIn
    ? "承認操作にはログインが必要です。"
    : "この会話の作成者またはモデレーターのみ承認操作できます。";

  return (
    <div className="container mx-auto px-4 py-8">
      {!hasApprovalPermission && (
        <div className="card bg-base-100 shadow-sm mb-6" role="status">
          <div className="card-body">
            <div className="flex flex-nowrap gap-2 items-center">
              <InformationCircleIcon
                className="h-6 w-6 shrink-0 text-info"
                aria-hidden="true"
              />
              <p className="ruby-text">
                投稿を承認するにはモデレーターになる必要があります。
                <Link
                  href={`/discussions/${naddrParam}/moderators#become-moderator`}
                  className="link"
                >
                  モデレーターになる
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
      <nav className="tabs tabs-box mb-6 w-full overflow-x-auto" role="tablist">
        <button
          aria-selected={activeTab === "pending"}
          aria-controls="pending-panel"
          id="pending-tab"
          aria-label="承認待ちタブを開く"
          className={`tab px-4 ${activeTab === "pending" ? "tab-active" : ""
            }`}
          role="tab"
          onClick={() => setActiveTab("pending")}
        >
          <span className="ruby-text">承認待ち</span>
          {pendingPosts.length > 0 && (
            <span className="badge badge-warning badge-md ml-1">
              {pendingPosts.length}
            </span>
          )}
        </button>
        <button
          aria-selected={activeTab === "approved"}
          aria-controls="approved-panel"
          id="approved-tab"
          aria-label="承認済みタブを開く"
          className={`tab px-4 ${activeTab === "approved" ? "tab-active" : ""
            }`}
          role="tab"
          onClick={() => setActiveTab("approved")}
        >
          <span className="ruby-text">承認済み</span>
          {approvedPosts.length > 0 && (
            <span className="badge badge-success badge-md ml-1">
              {approvedPosts.length}
            </span>
          )}
        </button>
      </nav>

      {isDiscussionLoading || isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 dark:bg-gray-700 rounded"
            ></div>
          ))}
        </div>
      ) : !discussion ? (
        discussionCompletionReason === "idle-timeout" ||
          discussionCompletionReason === "hard-timeout" ||
          discussionCompletionReason === "cancelled" ? (
          <div className="alert alert-warning" role="alert">
            <span>
              会話データの取得に時間がかかっています（{discussionCompletionReason}）。
              受信待機中または relay 応答遅延の可能性があります。
            </span>
          </div>
        ) : (
          <div className="alert alert-warning" role="alert">
            <span>会話が見つかりません。</span>
          </div>
        )
      ) : (
        <main
          aria-labelledby={`${activeTab}-tab`}
          id={`${activeTab}-panel`}
          role="tabpanel"
        >
          <DiscussionReadStatus
            isLoading={false}
            completionReason={null}
            hasData={posts.length > 0}
            approvalState={approvalState === "unknown" ? "unknown" : undefined}
            onReload={startStreaming}
          />
          {activeTab === "pending" && (
            <section>
              {pendingPosts.length > 0 ? (
                <div className="space-y-4">
                  {pendingPosts.map((post) => (
                    <div
                      key={post.id}
                      className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <div className="card-body p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            {post.busStopTag && (
                              <div className="mb-2">
                                <span className="badge badge-outline badge-md">
                                  {post.busStopTag}
                                </span>
                              </div>
                            )}
                            <div className="prose prose-sm dark:prose-invert max-w-none ruby-text">
                              {post.content.split("\n").map((line, i) => (
                                <p key={i} className="mb-1 last:mb-0">
                                  {line || "\u00A0"}
                                </p>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleApprovePost(post)}
                            disabled={
                              approvingIds.has(post.id) ||
                              !hasApprovalPermission
                            }
                            className="ml-4 btn btn-primary rounded-full dark:rounded-sm"
                          >
                            <span>
                              {approvingIds.has(post.id) ? "" : "承認"}
                            </span>
                          </button>
                        </div>
                        {user.isLoggedIn && (
                          <DisabledReasonText
                            state={buildDisabledActionState(
                              hasApprovalPermission,
                              permissionReason
                            )}
                          />
                        )}
                        <div className="text-gray-500">
                          {formatRelativeTime(post.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="card-body">
                    <div className="text-center py-8 ruby-text">
                      <CheckBadgeIcon
                        aria-label="承認待ちなし"
                        className="mx-auto h-12 w-12 text-gray-400"
                      />
                      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                        承認待ちの投稿はありません
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        新しい投稿が投稿されると、ここに表示されます。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "approved" && (
            <section>
              {approvedPosts.length > 0 ? (
                <div className="space-y-4">
                  {approvedPosts.slice(0, 10).map((post) => (
                    <div
                      key={post.id}
                      className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 opacity-75"
                    >
                      <div className="card-body p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            {post.busStopTag && (
                              <div className="mb-2">
                                <span className="badge badge-outline badge-md">
                                  {post.busStopTag}
                                </span>
                              </div>
                            )}
                            <div className="prose prose-sm dark:prose-invert max-w-none ruby-text">
                              {post.content.split("\n").map((line, i) => (
                                <p key={i} className="mb-1 last:mb-0">
                                  {line || "\u00A0"}
                                </p>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            {(() => {
                              const hasOwnApproval = approvals.some(
                                (a) =>
                                  a.postId === post.id &&
                                  a.moderatorPubkey === user.pubkey
                              );
                              const revokeAllowed =
                                hasApprovalPermission && hasOwnApproval;
                              return (
                                <button
                                  onClick={() => handleRevokeApproval(post)}
                                  disabled={
                                    revokingIds.has(post.id) || !revokeAllowed
                                  }
                                  className="btn btn-warning rounded-full dark:rounded-sm"
                                >
                                  <span>
                                    {revokingIds.has(post.id)
                                      ? ""
                                      : "承認を撤回"}
                                  </span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                        {(() => {
                          const hasOwnApproval = approvals.some(
                            (a) =>
                              a.postId === post.id &&
                              a.moderatorPubkey === user.pubkey
                          );
                          const revokeAllowed =
                            hasApprovalPermission && hasOwnApproval;
                          const revokeReason = !hasApprovalPermission
                            ? permissionReason
                            : "自分が行った承認のみ撤回できます。";
                          return (
                            user.isLoggedIn ? (
                              <DisabledReasonText
                                state={buildDisabledActionState(
                                  revokeAllowed,
                                  revokeReason
                                )}
                              />
                            ) : null
                          );
                        })()}
                        <div className="text-gray-500">
                          承認:{" "}
                          {formatRelativeTime(
                            post.approvedAt || post.createdAt
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {approvedPosts.length > 10 && (
                    <p className="text-center text-gray-500 text-sm">
                      最新10件を表示中（全{approvedPosts.length}件）
                    </p>
                  )}
                </div>
              ) : (
                <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="card-body">
                    <div className="text-center py-8 ruby-text">
                      <CheckBadgeIcon
                        aria-label="承認済みなし"
                        className="mx-auto h-12 w-12 text-gray-400"
                      />
                      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                        承認済みの投稿はありません
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        投稿が承認されると、ここに表示されます。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}
