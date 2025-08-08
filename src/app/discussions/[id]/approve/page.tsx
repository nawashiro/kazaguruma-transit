"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import {
  ModeratorCheck,
  PermissionError,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  formatRelativeTime,
  hexToNpub,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const RELAYS = [
  { url: "wss://relay.damus.io", read: true, write: true },
  { url: "wss://relay.nostr.band", read: true, write: true },
  { url: "wss://nos.lol", read: true, write: true },
];

const nostrService = createNostrService({
  relays: RELAYS,
  defaultTimeout: 5000,
});


export default function PostApprovalPage() {
  const params = useParams();
  const discussionId = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPostId, setProcessingPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [isLoaded, setIsLoaded] = useState(false);

  const { user, signEvent } = useAuth();

  // Rubyfulライブラリ対応
  useRubyfulRun([discussion, posts, approvals], isLoaded);

  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled()) return;
    setIsLoading(true);
    try {
      const [discussionEvents, postsEvents, approvalsEvents] =
        await Promise.all([
          nostrService.getDiscussions(ADMIN_PUBKEY),
          nostrService.getDiscussionPosts(
            `34550:${ADMIN_PUBKEY}:${discussionId}`
          ),
          nostrService.getApprovals(`34550:${ADMIN_PUBKEY}:${discussionId}`),
        ]);

      const parsedDiscussion = discussionEvents
        .map(parseDiscussionEvent)
        .find((d) => d && d.dTag === discussionId);

      if (!parsedDiscussion) {
        throw new Error("Discussion not found");
      }

      const parsedApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const parsedPosts = postsEvents
        .map((event) => parsePostEvent(event, parsedApprovals))
        .filter((p): p is DiscussionPost => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      setDiscussion(parsedDiscussion);
      setPosts(parsedPosts);
      setApprovals(parsedApprovals);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [discussionId]);

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }
    setIsLoaded(true);
  }, [loadData]);

  // Check if discussions are enabled and render accordingly
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

  const handleApprove = async (post: DiscussionPost) => {
    if (!discussion || !user.isLoggedIn) return;

    setProcessingPostId(post.id);
    try {
      const approvalEvent = nostrService.createApprovalEvent(
        post.event,
        discussion.id
      );

      const signedEvent = await signEvent(approvalEvent);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish approval to relays");
      }
      await loadData();
    } catch (error) {
      console.error("Failed to approve post:", error);
    } finally {
      setProcessingPostId(null);
    }
  };

  const handleReject = async (post: DiscussionPost) => {
    if (!discussion || !user.isLoggedIn) return;

    const approval = approvals.find(
      (a) => a.postId === post.id && a.moderatorPubkey === user.pubkey
    );

    if (!approval) return;

    setProcessingPostId(post.id);
    try {
      const deleteEvent = nostrService.createDeleteEvent(approval.event.id);
      const signedEvent = await signEvent(deleteEvent);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish approval revocation to relays");
      }
      await loadData();
    } catch (error) {
      console.error("Failed to reject post:", error);
    } finally {
      setProcessingPostId(null);
    }
  };

  const pendingPosts = posts.filter((p) => !p.approved);
  const approvedPosts = posts.filter((p) => p.approved);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話が見つかりません</h1>
          <Link href="/discussions" className="btn btn-primary">
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ModeratorCheck
      moderators={discussion.moderators.map((m) => m.pubkey)}
      adminPubkey={ADMIN_PUBKEY}
      userPubkey={user.pubkey}
      fallback={<PermissionError type="moderator" />}
    >
      <div className="container mx-auto px-4 py-8 ruby-text">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href={`/discussions/${discussionId}`}
              className="btn btn-ghost btn-sm rounded-full dark:rounded-sm"
            >
              <span>← 会話に戻る</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold mb-2">投稿承認管理</h1>
          <p className="text-gray-600 dark:text-gray-400">{discussion.title}</p>
        </div>

        <nav role="tablist" aria-label="投稿管理メニュー" className="join mb-6">
          <input
            className="join-item btn"
            type="radio"
            name="post-status"
            aria-label={`未承認投稿 (${pendingPosts.length})`}
            role="tab"
            checked={activeTab === "pending"}
            onChange={() => setActiveTab("pending")}
          />
          <input
            className="join-item btn"
            type="radio"
            name="post-status"
            aria-label={`承認済み投稿 (${approvedPosts.length})`}
            role="tab"
            checked={activeTab === "approved"}
            onChange={() => setActiveTab("approved")}
          />
        </nav>

        {activeTab === "pending" ? (
          <main role="tabpanel" aria-labelledby="pending-tab">
            <section aria-labelledby="pending-posts-heading">
              <h2 id="pending-posts-heading" className="text-xl font-semibold mb-4">未承認投稿</h2>

              {pendingPosts.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-label="すべて承認済み"
                  role="img"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                  未承認の投稿はありません
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  すべての投稿が承認済みです。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPosts.map((post) => (
                  <div
                    key={post.id}
                    className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <div className="card-body">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-warning badge-sm">
                            未承認
                          </span>
                          {post.busStopTag && (
                            <span className="badge badge-outline badge-sm">
                              {post.busStopTag}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatRelativeTime(post.createdAt)}
                        </span>
                      </div>

                      <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                        {post.content.split("\n").map((line, index) => (
                          <p key={index} className="mb-2 last:mb-0">
                            {line || "\u00A0"}
                          </p>
                        ))}
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-gray-500">
                          投稿者: {hexToNpub(post.authorPubkey).slice(0, 12)}...
                          {hexToNpub(post.authorPubkey).slice(-8)}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(post)}
                            disabled={processingPostId === post.id}
                            className="btn btn-success rounded-full dark:rounded-sm"
                          >
                            <span>{processingPostId === post.id ? "" : "承認"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </section>
          </main>
        ) : (
          <main role="tabpanel" aria-labelledby="approved-tab">
            <section aria-labelledby="approved-posts-heading">
              <h2 id="approved-posts-heading" className="text-xl font-semibold mb-4">承認済み投稿</h2>

            {approvedPosts.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-label="投稿なし"
                  role="img"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                  承認済みの投稿はありません
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  まだ投稿が承認されていません。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvedPosts.map((post) => {
                  const userApproval = approvals.find(
                    (a) =>
                      a.postId === post.id && a.moderatorPubkey === user.pubkey
                  );
                  const canReject = !!userApproval;

                  return (
                    <div
                      key={post.id}
                      className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <div className="card-body">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <span className="badge badge-success badge-sm">
                              承認済み
                            </span>
                            {post.busStopTag && (
                              <span className="badge badge-outline badge-sm">
                                {post.busStopTag}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(post.createdAt)}
                          </span>
                        </div>

                        <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                          {post.content.split("\n").map((line, index) => (
                            <p key={index} className="mb-2 last:mb-0">
                              {line || "\u00A0"}
                            </p>
                          ))}
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-500">
                            <div>
                              投稿者: {hexToNpub(post.authorPubkey).slice(0, 12)}...
                              {hexToNpub(post.authorPubkey).slice(-8)}
                            </div>
                            <div>承認者: {post.approvedBy?.length || 0}人</div>
                            {post.approvedAt && (
                              <div>
                                承認日時: {formatRelativeTime(post.approvedAt)}
                              </div>
                            )}
                          </div>

                          {canReject && (
                            <button
                              onClick={() => handleReject(post)}
                              disabled={processingPostId === post.id}
                              className="btn btn-error rounded-full dark:rounded-sm"
                            >
                              <span>{processingPostId === post.id ? "" : "承認撤回"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </section>
          </main>
        )}
      </div>
    </ModeratorCheck>
  );
}
