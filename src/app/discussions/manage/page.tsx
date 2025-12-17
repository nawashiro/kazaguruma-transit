"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Event } from "nostr-tools";
import Link from "next/link";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { PermissionError } from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  formatRelativeTime,
} from "@/lib/nostr/nostr-utils";
import {
  extractDiscussionFromNaddr,
  buildNaddrFromRef,
} from "@/lib/nostr/naddr-utils";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";

const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionManagePage() {
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [referencedDiscussions, setReferencedDiscussions] = useState<
    Discussion[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const approvalsStreamCleanup = useRef<(() => void) | null>(null);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");

  const { user, signEvent } = useAuth();

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
            <div key={index} className="">
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
                  <span className="badge badge-outline badge-sm">
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

  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled() || !discussionInfo) return;
    setIsLoading(true);
    try {
      const [discussionEvents, postsEvents] = await Promise.all([
        nostrService.getDiscussions(discussionInfo.authorPubkey),
        nostrService.getDiscussionPosts(discussionInfo.discussionId),
      ]);

      const parsedDiscussion = discussionEvents
        .map(parseDiscussionEvent)
        .find((d) => d && d.dTag === discussionInfo.dTag);

      if (!parsedDiscussion) {
        throw new Error("Discussion not found");
      }

      const parsedPosts = postsEvents
        .map((event) => parsePostEvent(event, []))
        .filter((p): p is DiscussionPost => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      // qタグから参照されている個別会話のkind:34550を取得
      const individualDiscussionRefs: string[] = [];
      parsedPosts.forEach((post) => {
        const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
        qTags.forEach((qTag) => {
          if (qTag[1] && qTag[1].startsWith("34550:")) {
            individualDiscussionRefs.push(qTag[1]);
          }
        });
      });

      let referencedDiscussionsData: Discussion[] = [];
      if (individualDiscussionRefs.length > 0) {
        const individualDiscussions =
          await nostrService.getReferencedUserDiscussions(
            individualDiscussionRefs
          );
        referencedDiscussionsData = individualDiscussions
          .map(parseDiscussionEvent)
          .filter((d): d is Discussion => d !== null);
      }

      setDiscussion(parsedDiscussion);
      setPosts(parsedPosts);
      approvalsStreamCleanup.current?.();
      approvalsStreamCleanup.current = await nostrService.streamApprovals(
        discussionInfo.discussionId,
        (approvalEvents: Event[]) => {
          const parsedApprovals = approvalEvents
            .map(parseApprovalEvent)
            .filter((a): a is PostApproval => a !== null);

          setApprovals(parsedApprovals);
          setPosts((prev) =>
            prev
              .map((event) => parsePostEvent(event.event ?? event, parsedApprovals))
              .filter((p): p is DiscussionPost => p !== null)
              .sort((a, b) => b.createdAt - a.createdAt)
          );
        },
        {
          onEose: (approvalEvents: Event[]) => {
            const parsedApprovals = approvalEvents
              .map(parseApprovalEvent)
              .filter((a): a is PostApproval => a !== null);

            setApprovals(parsedApprovals);
            setPosts((prev) =>
              prev
                .map((event) =>
                  parsePostEvent(event.event ?? event, parsedApprovals)
                )
                .filter((p): p is DiscussionPost => p !== null)
                .sort((a, b) => b.createdAt - a.createdAt)
            );
          },
        }
      );
      setReferencedDiscussions(referencedDiscussionsData);
    } catch (error) {
      logger.error("Failed to load discussion:", error);
    } finally {
      setIsLoading(false);
    }
  }, [discussionInfo]);


  useEffect(() => {
    if (isDiscussionsEnabled() && discussionInfo) {
      loadData();
    }
  }, [loadData, discussionInfo]);

  useEffect(() => {
    return () => {
      approvalsStreamCleanup.current?.();
    };
  }, []);

  const handleApprovePost = async (post: DiscussionPost) => {
    if (!user.isLoggedIn || !discussion) return;

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
    if (!user.isLoggedIn || !discussion) return;

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
          <h1 className="text-2xl font-bold mb-4">投稿管理</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  if (isLoading || !discussion) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-600 dark:text-gray-300">
          ロード中です…
        </p>
      </div>
    );
  }

  // qタグ引用があるもののみをフィルタリング
  const postsWithQTags = posts.filter((post) => {
    const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
    return qTags.some((qTag) => qTag[1] && qTag[1].startsWith("34550:"));
  });

  const pendingPosts = postsWithQTags.filter((post) => !post.approved);
  const approvedPosts = postsWithQTags.filter((post) => post.approved);

  // 会話一覧の作成者またはモデレーターのみアクセス可能
  const hasPermission =
    discussion &&
    (user.pubkey === discussion.authorPubkey ||
      discussion.moderators.some((m) => m.pubkey === user.pubkey));

  if (!hasPermission) {
    return <PermissionError type="moderator" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/discussions"
          className="btn btn-ghost btn-sm mb-4 rounded-full dark:rounded-sm"
        >
          <span className="ruby-text">← 会話一覧に戻る</span>
        </Link>
        <h1 className="text-3xl font-bold ruby-text">投稿承認管理</h1>
        {discussion && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {discussion.title}
          </p>
        )}
      </div>

      <nav className="join mb-6" role="tablist">
        <button
          aria-selected={activeTab === "pending"}
          aria-label="承認待ちタブを開く"
          className={`join-item btn  ${
            activeTab === "pending" ? "btn-active btn-primary" : "false"
          }`}
          name="tab-options"
          role="tab"
          onClick={() => setActiveTab("pending")}
        >
          <span className="ruby-text">承認待ち</span>
          {pendingPosts.length > 0 && (
            <span className="badge badge-warning badge-sm ml-1">
              {pendingPosts.length}
            </span>
          )}
        </button>
        <button
          aria-selected={activeTab === "approved"}
          aria-label="承認済みタブを開く"
          className={`join-item btn  ${
            activeTab === "approved" ? "btn-active btn-primary" : "false"
          }`}
          name="tab-options"
          role="tab"
          onClick={() => setActiveTab("approved")}
        >
          <span className="ruby-text">承認済み</span>
          {approvedPosts.length > 0 && (
            <span className="badge badge-success badge-sm ml-1">
              {approvedPosts.length}
            </span>
          )}
        </button>
      </nav>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 dark:bg-gray-700 rounded"
            ></div>
          ))}
        </div>
      ) : (
        <main aria-labelledby={`${activeTab}-tab`} role="tabpanel">
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
                            disabled={approvingIds.has(post.id)}
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
                    <div className="text-center py-8">
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
                            {post.approved &&
                              post.approvedBy?.includes(user.pubkey || "") && (
                                <button
                                  onClick={() => handleRevokeApproval(post)}
                                  disabled={revokingIds.has(post.id)}
                                  className="btn btn-warning rounded-full dark:rounded-sm"
                                >
                                  <span className="ruby-text">
                                    {revokingIds.has(post.id)
                                      ? ""
                                      : "承認を撤回"}
                                  </span>
                                </button>
                              )}
                          </div>
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
                    <div className="text-center py-8">
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
