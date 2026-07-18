"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import PageHeader from "@/components/layouts/PageHeader";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
  getDiscussionReadStrategyConfig,
} from "@/lib/config/discussion-config";
import { selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";
import { loadDiscussionModerationSnapshot } from "@/lib/discussion/discussion-moderation-snapshot";
import {
  loadKnownDiscussionData,
  saveKnownDiscussionData,
} from "@/lib/discussion/discussion-known-data-cache";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  formatRelativeTime,
} from "@/lib/nostr/nostr-utils";
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";
import {
  extractDiscussionFromNaddr,
  buildNaddrFromRef,
} from "@/lib/nostr/naddr-utils";
import type { Event } from "@/lib/nostr/nostr-service";
import type { CompletionReason } from "@/lib/nostr/nostr-service";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";

const nostrServiceConfig = getNostrServiceConfig();
const readStrategy = getDiscussionReadStrategyConfig();
const nostrService = createNostrService(nostrServiceConfig);

export default function DiscussionManagePage() {
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [referencedDiscussions, setReferencedDiscussions] = useState<
    Discussion[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completionReason, setCompletionReason] =
    useState<CompletionReason | null>(null);
  const [approvalState, setApprovalState] = useState<
    "approved" | "unapproved" | "unknown"
  >("unknown");
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");

  const readGenerationRef = useRef(0);

  const { user, signEvent } = useAuth();

  const canManagePosts = Boolean(
    discussion &&
      (arePubkeysEqual(user.pubkey, discussion.authorPubkey) ||
        discussion.moderators.some(
          (moderator) => arePubkeysEqual(user.pubkey, moderator.pubkey)
        ))
  );

  // qタグから参照されている会話を検索
  const findReferencedDiscussion = (qRef: string): Discussion | null => {
    return (
      referencedDiscussions.find((d) => {
        const expectedRef = `34550:${d.authorPubkey}:${d.dTag}`;
        return expectedRef === qRef;
      }) || null
    );
  };

  // qタグ引用をレンダリング（会話一覧風）
  const renderQTagReferences = (post: DiscussionPost) => {
    const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
    if (qTags.length === 0) return null;

    return (
      <div className="space-y-3 break-all">
        {qTags.map((qTag, index) => {
          if (!qTag[1] || !qTag[1].startsWith("34550:")) return null;

          const referencedDiscussion = findReferencedDiscussion(qTag[1]);
          if (!referencedDiscussion) {
            // 内部参照形式をnaddr形式に変換してユーザーに表示
            try {
              const naddr = buildNaddrFromRef(qTag[1]);
              return (
                <div key={index} className="text-sm text-gray-400 italic">
                  会話が見つかりません。参照: {naddr}
                </div>
              );
            } catch {
              return (
                <div key={index} className="text-sm text-gray-400 italic">
                  無効な参照形式。参照: {qTag[1]}
                </div>
              );
            }
          }

          const naddr = buildNaddrFromRef(qTag[1]);
          return (
            <div key={index}>
              <Link
                href={`/discussions/${naddr}`}
                className="block hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-3 -m-3 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 ruby-text">
                  {referencedDiscussion.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 ruby-text">
                  {referencedDiscussion.description.length > 100
                    ? `${referencedDiscussion.description.slice(0, 100)}...`
                    : referencedDiscussion.description}
                </p>
                <div className="flex justify-between items-center">
                  <div className="text-gray-500">
                    <time
                      dateTime={new Date(
                        referencedDiscussion.createdAt * 1000
                      ).toISOString()}
                    >
                      {formatRelativeTime(referencedDiscussion.createdAt)}
                    </time>
                  </div>
                  <span className="badge badge-outline">
                    {referencedDiscussion.moderators.length + 1} モデレーター
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    );
  };

  // naddrを解析し、ディスカッション情報を抽出します
  const discussionInfo = useMemo(() => {
    const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
    if (!discussionListNaddr) return null;
    return extractDiscussionFromNaddr(discussionListNaddr);
  }, []);

  const loadDiscussionData = useCallback(async () => {
    const readGeneration = ++readGenerationRef.current;
    setDiscussion(null);
    setPosts([]);
    setApprovals([]);
    setCompletionReason(null);
    setApprovalState("unknown");
    setIsLoading(true);

    if (!isDiscussionsEnabled() || !discussionInfo) {
      setIsLoading(false);
      return;
    }

    const knownData = loadKnownDiscussionData<Discussion, Event>(
      discussionInfo.discussionId
    );
    const knownMetadata = knownData?.metadata;
    if (
      knownMetadata &&
      knownMetadata.dTag === discussionInfo.dTag &&
      arePubkeysEqual(knownMetadata.authorPubkey, discussionInfo.authorPubkey)
    ) {
      setDiscussion(knownMetadata);
    }

    const relayUrls = selectRelayCandidates({
      hints: discussionInfo.relays,
      successful: knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays,
      configured: nostrServiceConfig.relays
        .filter((relay) => relay.read)
        .map((relay) => relay.url),
      defaults: [],
      limit: readStrategy.relayLimit,
    }).map((relay) => relay.url);

    try {
      const metadataResult = await nostrService.getEventsWithCompletion(
        [
          {
            kinds: [34550],
            authors: [discussionInfo.authorPubkey],
            "#d": [discussionInfo.dTag],
            limit: 1,
          },
        ],
        {
          idleTimeoutMs: readStrategy.idleTimeoutMs,
          hardTimeoutMs: readStrategy.hardTimeoutMs,
          relayUrls,
        }
      );
      if (readGenerationRef.current !== readGeneration) return;

      const parsedDiscussion = metadataResult.events
        .map(parseDiscussionEvent)
        .find(
          (candidate) =>
            candidate &&
            candidate.dTag === discussionInfo.dTag &&
            arePubkeysEqual(candidate.authorPubkey, discussionInfo.authorPubkey)
        );
      if (parsedDiscussion) setDiscussion(parsedDiscussion);

      const snapshot = await loadDiscussionModerationSnapshot(
        nostrService,
        readStrategy,
        {
          discussionId: discussionInfo.discussionId,
          hints: discussionInfo.relays,
          successful:
            knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays,
          configured: nostrServiceConfig.relays
            .filter((relay) => relay.read)
            .map((relay) => relay.url),
          defaults: [],
        }
      );
      if (readGenerationRef.current !== readGeneration) return;

      const parsedApprovals = snapshot.approvalEvents
        .map(parseApprovalEvent)
        .filter((approval): approval is PostApproval => approval !== null);
      const parsedPosts = snapshot.primaryEvents
        .map((event) => parsePostEvent(event, parsedApprovals))
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

      setApprovals(parsedApprovals);
      setPosts(parsedPosts);
      setApprovalState(snapshot.approvalState);
      setCompletionReason(
        metadataResult.completionReason === "eose"
          ? snapshot.completionReason
          : metadataResult.completionReason
      );
      const events = [...metadataResult.events, ...snapshot.primaryEvents, ...snapshot.approvalEvents];
      saveKnownDiscussionData(discussionInfo.discussionId, {
        metadata: parsedDiscussion ?? knownMetadata ?? null,
        eventIds: events.map((event) => event.id),
        attemptedRelayUrls: [
          ...metadataResult.relayUrls,
          ...snapshot.attemptedRelayUrls,
        ],
        successfulEventRelayUrls: snapshot.successfulRelayUrls,
        successfulRelays: [],
        events,
      });
    } catch (error) {
      if (readGenerationRef.current !== readGeneration) return;
      logger.error("Failed to load discussion management data:", error);
      setCompletionReason("hard-timeout");
    } finally {
      if (readGenerationRef.current === readGeneration) setIsLoading(false);
    }
  }, [discussionInfo]);

  useEffect(() => {
    void loadDiscussionData();
  }, [loadDiscussionData]);

  useEffect(() => {
    const qTagRefs = new Set<string>();
    posts.forEach((post) => {
      const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
      qTags.forEach((qTag) => {
        if (qTag[1] && qTag[1].startsWith("34550:")) {
          qTagRefs.add(qTag[1]);
        }
      });
    });

    if (qTagRefs.size === 0) {
      setReferencedDiscussions([]);
      return;
    }

    let cancelled = false;
    const loadReferencedDiscussions = async () => {
      try {
        const individualDiscussions =
          await nostrService.getReferencedUserDiscussions(
            Array.from(qTagRefs)
          );
        if (cancelled) return;

        const parsed = individualDiscussions
          .map(parseDiscussionEvent)
          .filter((d): d is Discussion => d !== null);
        setReferencedDiscussions(parsed);
      } catch (error) {
        if (!cancelled) {
          logger.error("Failed to load referenced discussions:", error);
        }
      }
    };

    loadReferencedDiscussions();

    return () => {
      cancelled = true;
    };
  }, [posts]);

  const handleApprovePost = async (post: DiscussionPost) => {
    if (!user.isLoggedIn || !discussion || !canManagePosts) return;

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

      // 楽観的な更新
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
    if (!user.isLoggedIn || !discussion || !canManagePosts) return;

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

      // 楽観的な更新
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

  // 無効な naddr をチェックしています
  if (!discussionInfo) {
    return (
      <div className="py-8">
        <div>
          <PageHeader
            title="無効な会話URL"
            description="指定された会話URLが無効です。"
          />
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
      <div className="py-8">
        <PageHeader
          title="投稿管理"
          description="この機能は現在利用できません。"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-8">
        <nav className="tabs tabs-box mb-6 w-full overflow-x-auto" role="tablist" aria-label="投稿承認">
          <button className="tab tab-active min-h-[44px] px-4" role="tab" aria-selected="true">
            <span className="ruby-text">承認待ち</span>
          </button>
          <button className="tab min-h-[44px] px-4" role="tab" aria-selected="false">
            <span className="ruby-text">承認済み</span>
          </button>
        </nav>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // qタグ引用があるもののみをフィルタリング
  const postsWithQTags = posts.filter((post) => {
    const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
    return qTags.some((qTag) => qTag[1] && qTag[1].startsWith("34550:"));
  });

  const pendingPosts = postsWithQTags.filter((post) => !post.approved);
  const pendingPostCount = pendingPosts.filter(
    (post) => post.approvalState !== "unknown"
  ).length;
  const approvedPosts = postsWithQTags.filter((post) => post.approved);

  return (
    <div className="py-8">
      <DiscussionReadStatus
        isLoading={false}
        completionReason={completionReason}
        hasData={posts.length > 0}
        approvalState={approvalState === "unknown" ? "unknown" : undefined}
        onReload={() => void loadDiscussionData()}
      />
      <nav className="tabs tabs-box mb-6 w-full overflow-x-auto" role="tablist">
        <button
          aria-selected={activeTab === "pending"}
          aria-controls="pending-panel"
          id="pending-tab"
          aria-label="承認待ちタブを開く"
          className={`tab min-h-[44px] px-4 ${
            activeTab === "pending" ? "tab-active" : ""
          }`}
          name="tab-options"
          role="tab"
          onClick={() => setActiveTab("pending")}
        >
          <span className="ruby-text">承認待ち</span>
          {pendingPostCount > 0 && (
            <span className="badge badge-warning ml-1">
              {pendingPostCount}
            </span>
          )}
        </button>
        <button
          aria-selected={activeTab === "approved"}
          aria-controls="approved-panel"
          id="approved-tab"
          aria-label="承認済みタブを開く"
          className={`tab min-h-[44px] px-4 ${
            activeTab === "approved" ? "tab-active" : ""
          }`}
          name="tab-options"
          role="tab"
          onClick={() => setActiveTab("approved")}
        >
          <span className="ruby-text">承認済み</span>
          {approvedPosts.length > 0 && (
            <span className="badge badge-success ml-1">
              {approvedPosts.length}
            </span>
          )}
        </button>
      </nav>

      <div
        aria-labelledby={`${activeTab}-tab`}
        id={`${activeTab}-panel`}
        role="tabpanel"
      >
        {activeTab === "pending" && (
          <section aria-labelledby="pending-posts-heading">
            <h2
              id="pending-posts-heading"
              className="text-xl font-semibold mb-4 ruby-text"
            >
              承認待ち投稿
            </h2>

            {pendingPosts.length > 0 ? (
              <div className="space-y-4">
                {pendingPosts.map((post) => (
                  <div
                    key={post.id}
                    className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {renderQTagReferences(post)}
                        </div>
                        <button
                          onClick={() => handleApprovePost(post)}
                          disabled={
                            !canManagePosts ||
                            post.approvalState === "unknown" ||
                            approvingIds.has(post.id)
                          }
                          className="ml-4 btn btn-primary rounded-full dark:rounded-sm"
                        >
                          <span className="ruby-text">
                            {approvingIds.has(post.id) ? "" : "承認"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="card-body">
                  <div className="py-8">
                    <CheckBadgeIcon
                      aria-label="承認待ちなし"
                      className="h-12 w-12 text-gray-400"
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
          <section aria-labelledby="approved-posts-heading">
            <h2
              id="approved-posts-heading"
              className="text-xl font-semibold mb-4 ruby-text"
            >
              承認済み投稿
            </h2>

            {approvedPosts.length > 0 ? (
              <div className="space-y-4">
                {approvedPosts.slice(0, 10).map((post) => (
                  <div
                    key={post.id}
                    className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 opacity-75"
                  >
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {renderQTagReferences(post)}
                        </div>
                        <div className="flex gap-2 ml-4">
                          {post.approved && (
                            <button
                              onClick={() => handleRevokeApproval(post)}
                              disabled={
                                !canManagePosts ||
                                !post.approvedBy?.includes(user.pubkey || "") ||
                                revokingIds.has(post.id)
                              }
                              className="btn btn-warning min-h-[44px] rounded-full dark:rounded-sm"
                            >
                              <span className="ruby-text">
                                {revokingIds.has(post.id) ? "" : "承認を撤回"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {approvedPosts.length > 10 && (
                  <p className="text-gray-500 text-sm">
                    最新10件を表示中（全{approvedPosts.length}件）
                  </p>
                )}
              </div>
            ) : (
              <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="card-body">
                  <div className="py-8">
                    <CheckBadgeIcon
                      aria-label="承認済みなし"
                      className="h-12 w-12 text-gray-400"
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
      </div>
    </div>
  );
}
