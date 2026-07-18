"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckBadgeIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import PageHeader from "@/components/layouts/PageHeader";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { formatRelativeTime } from "@/lib/nostr/nostr-utils";
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";
import { ApprovalStatusTabs } from "@/components/discussion/ApprovalStatusTabs";
import { buildNaddrFromRef } from "@/lib/nostr/naddr-utils";
import type { Discussion, DiscussionPost, PostApproval } from "@/types/discussion";
import { logger } from "@/utils/logger";
import { useDiscussionMeta } from "@/components/discussion/DiscussionTabLayout";
import { useDiscussionManagementData } from "@/components/discussion/DiscussionManagementDataProvider";

const nostrServiceConfig = getNostrServiceConfig();
const nostrService = createNostrService(nostrServiceConfig);

export default function DiscussionManagePage() {
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");

  const { user, signEvent } = useAuth();
  const discussionMeta = useDiscussionMeta();
  const discussion = discussionMeta?.discussion;
  const {
    posts,
    approvals,
    referencedDiscussions,
    isModerationLoading: isLoading,
    completionReason,
    approvalState,
    reloadModeration,
    addApproval,
    removeApproval,
  } = useDiscussionManagementData();

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

      removeApproval(approval.id, post.id, user.pubkey || "");
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

  if (!discussion && discussionMeta?.isLoading === false) {
    return (
      <div className="py-8">
        <div className="alert alert-error" role="alert">
          <span className="ruby-text">
            {discussionMeta.error ?? "掲載一覧の会話情報が見つかりませんでした。"}
          </span>
          <button
            type="button"
            className="btn btn-outline min-h-[44px] rounded-full dark:rounded-sm"
            onClick={() => void discussionMeta.reload()}
          >
            <span className="ruby-text">再読み込み</span>
          </button>
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

  if (isLoading || discussionMeta?.isLoading) {
    return (
      <div className="py-8">
        <div
          className="tabs tabs-box mb-6 w-full overflow-x-auto"
          aria-hidden="true"
        >
          <span className="tab tab-active min-h-[44px] px-4">
            <span className="ruby-text">承認待ち</span>
          </span>
          <span className="tab min-h-[44px] px-4">
            <span className="ruby-text">承認済み</span>
          </span>
        </div>
        <div className="animate-pulse space-y-4" aria-hidden="true">
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
        onReload={() => void reloadModeration()}
      />
      {!canManagePosts && (
        <div className="card bg-base-100 shadow-sm mb-6" role="status">
          <div className="card-body">
            <div className="flex flex-nowrap gap-2 items-center">
              <InformationCircleIcon
                className="h-6 w-6 shrink-0 text-info"
                aria-hidden="true"
              />
              <p className="ruby-text">
                掲載依頼を承認するにはモデレーターになる必要があります。
                <Link
                  href="/discussions/moderator#become-moderator"
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
        idPrefix="discussion-manage-approval"
        onTabChange={setActiveTab}
        pendingCount={pendingPostCount}
      />

      <div
        aria-labelledby={`discussion-manage-approval-${activeTab}-tab`}
        id={`discussion-manage-approval-${activeTab}-panel`}
        role="tabpanel"
        tabIndex={0}
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
