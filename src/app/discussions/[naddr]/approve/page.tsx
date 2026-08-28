"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layouts/PageHeader";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscussionDetail } from "@/components/discussion/DiscussionDetailProvider";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";

import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";
import { ApprovalStatusTabs } from "@/components/discussion/ApprovalStatusTabs";
import {
  buildDisabledActionState,
  DisabledReasonText,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
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
import { BadgeCheck, Info } from "lucide-react";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrServiceConfig = getNostrServiceConfig();
const nostrService = createNostrService(nostrServiceConfig);

export default function PostApprovalPage() {
  const params = useParams();
  const naddrParam = params.naddr as string;
  const detail = useDiscussionDetail();
  const discussion = detail.snapshot?.discussion ?? null;
  const isDiscussionLoading = detail.state === "loading";
  const discussionCompletionReason =
    detail.completionReason ??
    (detail.state === "partial"
      ? "idle-timeout"
      : detail.state === "error"
        ? "hard-timeout"
        : detail.state === "ready"
          ? "eose"
          : null);

  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const { user, signEvent } = useAuth();
  const posts = detail.snapshot?.posts ?? [];
  const approvals = detail.snapshot?.approvals ?? [];
  const isLoading = detail.state === "loading";
  const completionReason = discussionCompletionReason;
  const approvalState = posts.some((post) => post.approvalState === "unknown")
    ? "unknown"
    : detail.state === "ready"
      ? "approved"
      : "unknown";
  const reload = detail.reload;
  const addApproval = detail.addApproval;
  const removeApproval = detail.removeApproval;

  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);

  const handleReload = useCallback(() => {
    void reload();
  }, [reload]);

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

      addApproval(newApproval);
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

      removeApproval(approval.id);
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
      <div className="py-8">
        <div>
          <PageHeader
            title="無効な会話URL"
            description="指定された会話URLが無効です。"
          />
          <Link
            href="/discussions"
            className="btn text-base btn-primary rounded-full dark:rounded-sm"
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
          title="投稿承認"
          description="この機能は現在利用できません。"
        />
      </div>
    );
  }

  if (detail.state === "loading") {
    return (
      <div role="status">
        <span className="ruby-text">会話情報を読み込み中...</span>
      </div>
    );
  }

  const pendingPosts = posts.filter(
    (post) => !post.approved || post.approvalState === "unknown",
  );
  const approvedPosts = posts.filter(
    (post) => post.approved && post.approvalState !== "unknown",
  );
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
    <div className="py-8">
      {discussion && detail.state !== "error" && !hasApprovalPermission && (
        <div className="card bg-base-100 shadow-sm mb-6" role="status">
          <div className="card-body">
            <div className="flex flex-nowrap gap-2 items-center">
              <Info
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
      <ApprovalStatusTabs
        activeTab={activeTab}
        approvedCount={approvedPosts.length}
        badgeClassName="badge-md"
        idPrefix="post-approval"
        onTabChange={setActiveTab}
        pendingCount={pendingPosts.length}
      />

      <div
        aria-labelledby={`post-approval-${activeTab}-tab`}
        id={`post-approval-${activeTab}-panel`}
        role="tabpanel"
        tabIndex={0}
      >
        {isDiscussionLoading || isLoading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        ) : detail.state === "error" ? (
            <div
              className="alert alert-error alert-soft text-base-content!"
              role="status"
              aria-live="polite"
            >
              <span>{detail.error ?? "会話データの取得に失敗しました。"}</span>
              <button
                type="button"
                className="btn text-base btn-outline min-h-[44px] rounded-full dark:rounded-sm"
                onClick={() => void reload()}
              >
                <span className="ruby-text">再読み込み</span>
              </button>
            </div>
        ) : !discussion ? (
          detail.state === "partial" ? (
            <div
              className="alert alert-warning alert-soft text-base-content!"
              role="status"
              aria-live="polite"
            >
              <span>
                会話データの取得に時間がかかっています（{discussionCompletionReason}）。
                受信待機中または relay 応答遅延の可能性があります。
              </span>
              <button
                type="button"
                className="btn text-base btn-outline min-h-[44px] rounded-full dark:rounded-sm"
                onClick={() => void reload()}
              >
                <span className="ruby-text">再読み込み</span>
              </button>
            </div>
          ) : (
            <div
              className="alert alert-warning alert-soft text-base-content!"
              role="status"
              aria-live="polite"
            >
              <span>会話が見つかりません。</span>
              <button
                type="button"
                className="btn text-base btn-outline min-h-[44px] rounded-full dark:rounded-sm"
                onClick={() => void reload()}
              >
                <span className="ruby-text">再読み込み</span>
              </button>
            </div>
          )
        ) : (
          <>
            <DiscussionReadStatus
              isLoading={false}
              completionReason={completionReason}
              hasData={posts.length > 0}
              approvalState={approvalState === "unknown" ? "unknown" : undefined}
              onReload={handleReload}
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
                                !hasApprovalPermission ||
                                post.approvalState === "unknown" ||
                                approvingIds.has(post.id)
                              }
                              className="ml-4 btn text-base btn-primary min-h-[44px] rounded-full dark:rounded-sm"
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
                          <div className="text-base-content">
                            {formatRelativeTime(post.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="card-body">
                      <div className="py-8 ruby-text">
                        <BadgeCheck
                          aria-label="承認待ちなし"
                          className="h-12 w-12 text-gray-400"
                        />
                        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                          承認待ちの投稿はありません
                        </h3>
                        <p className="mt-2 text-base text-base-content">
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
                                    className="btn text-base btn-warning min-h-[44px] rounded-full dark:rounded-sm"
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
                          <div className="text-base-content">
                            承認:{" "}
                            {formatRelativeTime(
                              post.approvedAt || post.createdAt
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {approvedPosts.length > 10 && (
                      <p className="text-base-content text-base">
                        最新10件を表示中（全{approvedPosts.length}件）
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="card-body">
                      <div className="py-8 ruby-text">
                        <BadgeCheck
                          aria-label="承認済みなし"
                          className="h-12 w-12 text-gray-400"
                        />
                        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                          承認済みの投稿はありません
                        </h3>
                        <p className="mt-2 text-base text-base-content">
                          投稿が承認されると、ここに表示されます。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
