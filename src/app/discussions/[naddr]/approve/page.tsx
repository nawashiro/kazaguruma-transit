"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
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
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());

export default function PostApprovalPage() {
  const params = useParams();
  const naddrParam = params.naddr as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  const { user, signEvent } = useAuth();

  // Parse naddr and extract discussion info
  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);

  // Rubyfulライブラリ対応
  useRubyfulRun([discussion, posts, approvals], isLoaded);

  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled() || !discussionInfo) return;
    setIsLoading(true);
    try {
      const [discussionEvents, postsEvents, approvalsEvents] =
        await Promise.all([
          nostrService.getDiscussions(discussionInfo.authorPubkey),
          nostrService.getDiscussionPosts(discussionInfo.discussionId),
          nostrService.getApprovals(discussionInfo.discussionId),
        ]);

      const parsedDiscussion = discussionEvents
        .map(parseDiscussionEvent)
        .find((d) => d && d.dTag === discussionInfo.dTag);

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
      logger.error("Failed to load discussion:", error);
    } finally {
      setIsLoading(false);
    }
  }, [discussionInfo]);

  useEffect(() => {
    if (isDiscussionsEnabled() && discussionInfo) {
      loadData();
    }
    setIsLoaded(true);
  }, [loadData, discussionInfo]);

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
          <Link href="/discussions" className="btn btn-primary">
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

  return (
    <ModeratorCheck
      moderators={discussion?.moderators.map((m) => m.pubkey) || []}
      adminPubkey={ADMIN_PUBKEY}
      userPubkey={user.pubkey}
      fallback={<PermissionError type="moderator" />}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 ruby-text">
          <Link
            href={`/discussions/${naddrParam}`}
            className="btn btn-ghost btn-sm mb-4 rounded-full dark:rounded-sm"
          >
            <span>← 会話に戻る</span>
          </Link>
          <h1 className="text-3xl font-bold">投稿承認管理</h1>
          {discussion && (
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {discussion.title}
            </p>
          )}
        </div>

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
          <div className="space-y-8">
            <section aria-labelledby="pending-posts-heading">
              <h2
                id="pending-posts-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                承認待ち投稿
                <span className="badge badge-warning badge-sm ml-2">
                  {pendingPosts.length}
                </span>
              </h2>

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
                                <span className="badge badge-outline badge-sm">
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
                            disabled={approvingIds.has(post.id)}
                            className="ml-4 btn btn-primary rounded-full dark:rounded-sm"
                          >
                            <span>
                              {approvingIds.has(post.id) ? "" : "承認"}
                            </span>
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatRelativeTime(post.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 ruby-text">
                  承認待ちの投稿はありません。
                </p>
              )}
            </section>

            <section aria-labelledby="approved-posts-heading">
              <h2
                id="approved-posts-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                承認済み投稿
                <span className="badge badge-success badge-sm ml-2">
                  {approvedPosts.length}
                </span>
              </h2>

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
                                <span className="badge badge-outline badge-sm">
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
                            {approvals.some(
                              (a) =>
                                a.postId === post.id &&
                                a.moderatorPubkey === user.pubkey
                            ) && (
                              <button
                                onClick={() => handleRevokeApproval(post)}
                                disabled={revokingIds.has(post.id)}
                                className="btn btn-warning rounded-full dark:rounded-sm"
                              >
                                <span>
                                  {revokingIds.has(post.id) ? "" : "承認を撤回"}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
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
                <p className="text-gray-600 dark:text-gray-400 ruby-text">
                  承認済みの投稿はありません。
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </ModeratorCheck>
  );
}
