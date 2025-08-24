"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import {
  AdminCheck,
  PermissionError,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import Button from "@/components/ui/Button";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import { logger } from "@/utils/logger";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import type { Discussion, DiscussionPost, PostApproval } from "@/types/discussion";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionManagePage() {
  // 会話一覧ページとほぼ同じstate管理
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "audit">("pending");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [allPosts, setAllPosts] = useState<DiscussionPost[]>([]);
  const [allApprovals, setAllApprovals] = useState<PostApproval[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const { user, signEvent } = useAuth();

  // Rubyfulライブラリ対応
  useRubyfulRun([discussions, allPosts, allApprovals], isLoaded);

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }
    setIsLoaded(true);
  }, []);

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話管理</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 会話一覧ページと全く同じロジック
      const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
      if (!discussionListNaddr) {
        logger.error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
        throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
      }

      const discussionInfo = extractDiscussionFromNaddr(discussionListNaddr);
      if (!discussionInfo) {
        throw new Error("Invalid DISCUSSION_LIST_NADDR format");
      }

      logger.info("Loading discussion list management with discussionId:", discussionInfo.discussionId);

      // 会話一覧ページと同じデータ取得
      const [discussionListEvents, discussionListPosts, discussionListApprovals] = await Promise.all([
        nostrService.getEvents([{
          kinds: [34550],
          authors: [discussionInfo.authorPubkey],
          "#d": [discussionInfo.dTag],
          limit: 1
        }]),
        nostrService.getDiscussionPosts(discussionInfo.discussionId),
        nostrService.getApprovals(discussionInfo.discussionId),
      ]);

      const discussionListMeta = discussionListEvents.length > 0 
        ? parseDiscussionEvent(discussionListEvents[0])
        : null;

      if (!discussionListMeta) {
        throw new Error("Discussion list metadata not found");
      }

      // 承認・未承認のkind:1111投稿を解析
      const listApprovals = discussionListApprovals
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const listPosts = discussionListPosts
        .map((event) => parsePostEvent(event, listApprovals))
        .filter((p): p is DiscussionPost => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      // qタグから個別会話の参照を取得
      const individualDiscussionRefs: string[] = [];
      listPosts.forEach(post => {
        const qTags = post.event?.tags?.filter(tag => tag[0] === "q") || [];
        qTags.forEach(qTag => {
          if (qTag[1] && qTag[1].startsWith("34550:")) {
            individualDiscussionRefs.push(qTag[1]);
          }
        });
      });

      // 個別会話のkind:34550を取得
      const individualDiscussions = await nostrService.getReferencedUserDiscussions(individualDiscussionRefs);
      
      const parsedIndividualDiscussions = individualDiscussions
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      setDiscussions(parsedIndividualDiscussions);
      setAllPosts(listPosts);
      setAllApprovals(listApprovals);

      // プロファイル取得（管理者のみ）
      if (user.pubkey === ADMIN_PUBKEY) {
        const uniquePubkeys = new Set<string>();
        uniquePubkeys.add(ADMIN_PUBKEY);
        
        parsedIndividualDiscussions.forEach((discussion) => {
          if (discussion.authorPubkey === ADMIN_PUBKEY ||
              discussion.moderators.some(m => m.pubkey === discussion.authorPubkey)) {
            uniquePubkeys.add(discussion.authorPubkey);
          }
          discussion.moderators.forEach((mod) =>
            uniquePubkeys.add(mod.pubkey)
          );
        });

        const profilePromises = Array.from(uniquePubkeys).map(async (pubkey) => {
          const profileEvent = await nostrService.getProfile(pubkey);
          if (profileEvent) {
            try {
              const profile = JSON.parse(profileEvent.content);
              return [pubkey, { name: profile.name || profile.display_name }];
            } catch {
              return [pubkey, {}];
            }
          }
          return [pubkey, {}];
        });

        const profileResults = await Promise.all(profilePromises);
        const profilesMap = Object.fromEntries(profileResults);
        setProfiles(profilesMap);
      }

      logger.info("Discussion management loaded:", {
        individualDiscussions: parsedIndividualDiscussions.length,
        listPosts: listPosts.length,
        listApprovals: listApprovals.length
      });

    } catch (error) {
      logger.error("Failed to load discussion management data:", error);
      setDiscussions([]);
      setAllPosts([]);
      setAllApprovals([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 承認待ちと承認済みの会話を分類
  const pendingPosts = allPosts.filter(post => !post.approved);
  const approvedPosts = allPosts.filter(post => post.approved);

  // 承認待ちの個別会話（qタグがある投稿）
  const pendingDiscussions = discussions.filter(discussion => {
    return pendingPosts.some(post => {
      const qTags = post.event?.tags?.filter(tag => tag[0] === "q") || [];
      return qTags.some(qTag => 
        qTag[1] === `34550:${discussion.authorPubkey}:${discussion.dTag}`
      );
    });
  });

  // 承認済みの個別会話
  const approvedDiscussions = discussions.filter(discussion => {
    return approvedPosts.some(post => {
      const qTags = post.event?.tags?.filter(tag => tag[0] === "q") || [];
      return qTags.some(qTag => 
        qTag[1] === `34550:${discussion.authorPubkey}:${discussion.dTag}`
      );
    });
  });


  // 会話一覧への追加承認
  const handleApproveDiscussion = async (discussion: Discussion) => {
    const correspondingPost = pendingPosts.find(post => {
      const qTags = post.event?.tags?.filter(tag => tag[0] === "q") || [];
      return qTags.some(qTag => 
        qTag[1] === `34550:${discussion.authorPubkey}:${discussion.dTag}`
      );
    });

    if (!correspondingPost) {
      setErrors(["対応する投稿が見つかりません"]);
      return;
    }

    setProcessingId(discussion.id);
    setErrors([]);
    try {
      // 投稿を承認するkind:4550イベントを作成
      const eventTemplate = nostrService.createApprovalEvent(
        correspondingPost.event!,
        `34550:${discussion.authorPubkey}:${discussion.dTag}`
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish approval event to relays");
      }

      await loadData();
    } catch (error) {
      logger.error("Failed to approve discussion:", error);
      setErrors(["承認に失敗しました"]);
    } finally {
      setProcessingId(null);
    }
  };

  // 会話一覧からの撤回
  const handleRevokeDiscussion = async (discussion: Discussion) => {
    const correspondingPost = approvedPosts.find(post => {
      const qTags = post.event?.tags?.filter(tag => tag[0] === "q") || [];
      return qTags.some(qTag => 
        qTag[1] === `34550:${discussion.authorPubkey}:${discussion.dTag}`
      );
    });

    if (!correspondingPost) {
      setErrors(["対応する投稿が見つかりません"]);
      return;
    }

    if (!confirm("この会話を一覧から削除してもよろしいですか？")) {
      return;
    }

    setProcessingId(discussion.id);
    setErrors([]);
    try {
      // 承認を撤回するkind:5イベントを作成
      const eventTemplate = nostrService.createRevocationEvent(
        correspondingPost.approvedBy?.[0] || '', // 最初の承認イベントIDを撤回
        `34550:${discussion.authorPubkey}:${discussion.dTag}`
      );
      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish revocation event to relays");
      }

      await loadData();
    } catch (error) {
      logger.error("Failed to revoke discussion:", error);
      setErrors(["撤回に失敗しました"]);
    } finally {
      setProcessingId(null);
    }
  };












  return (
    <AdminCheck
      adminPubkey={ADMIN_PUBKEY}
      userPubkey={user.pubkey}
      fallback={<PermissionError type="admin" />}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 ruby-text">
          <Link
            href="/discussions"
            className="btn btn-ghost btn-sm mb-4 rounded-full dark:rounded-sm"
          >
            <span>← 会話一覧に戻る</span>
          </Link>
          <h1 className="text-3xl font-bold">会話管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            ユーザー作成会話の一覧への追加を承認・撤回できます。
          </p>
        </div>

        {/* タブナビゲーション */}
        <nav role="tablist" className="tabs tabs-bordered mb-6">
          <button
            className={`tab tab-lg ruby-text ${
              activeTab === 'pending' ? 'tab-active' : ''
            }`}
            role="tab"
            onClick={() => setActiveTab('pending')}
          >
            承認待ち会話 ({pendingDiscussions.length}件)
          </button>
          <button
            className={`tab tab-lg ruby-text ${
              activeTab === 'approved' ? 'tab-active' : ''
            }`}
            role="tab"
            onClick={() => setActiveTab('approved')}
          >
            承認済み会話 ({approvedDiscussions.length}件)
          </button>
        </nav>

        {/* エラー表示 */}
        {errors.length > 0 && (
          <div className="alert alert-error mb-6 ruby-text">
            <ul className="text-sm">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'pending' ? (
          /* 承認待ち会話タブ */
          <div className="space-y-6">

            {/* 承認待ち会話一覧 */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : pendingDiscussions.length > 0 ? (
              <div className="space-y-4 ruby-text">
                {pendingDiscussions.map((discussion) => (
                  <div
                    key={discussion.id}
                    className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="card-title text-lg">
                            <span>{discussion.title}</span>
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {discussion.description.length > 70
                              ? `${discussion.description.slice(0, 70)}...`
                              : discussion.description}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <div className="text-xs text-gray-500 space-y-1">
                              <time
                                dateTime={new Date(
                                  discussion.createdAt * 1000
                                ).toISOString()}
                              >
                                {formatRelativeTime(discussion.createdAt)}
                              </time>
                              {/* 作成者が管理者・モデレーターの場合、名前を表示 */}
                              {(discussion.authorPubkey === ADMIN_PUBKEY ||
                                discussion.moderators.some(
                                  (m) => m.pubkey === discussion.authorPubkey
                                )) && (
                                <div className="text-xs">
                                  作成者:{" "}
                                  {profiles[discussion.authorPubkey]?.name ||
                                    "名前未設定"}
                                </div>
                              )}
                              {/* モデレーターの名前を表示 */}
                              {discussion.moderators.length > 0 && (
                                <div className="text-xs">
                                  モデレーター:{" "}
                                  {discussion.moderators
                                    .map(
                                      (mod) =>
                                        profiles[mod.pubkey]?.name ||
                                        "名前未設定"
                                    )
                                    .join(", ")}
                                </div>
                              )}
                            </div>
                            <span className="badge badge-outline badge-sm">
                              {discussion.moderators.length + 1} モデレーター
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleApproveDiscussion(discussion)}
                          disabled={processingId === discussion.id}
                          loading={processingId === discussion.id}
                          className="btn-sm ml-4"
                        >
                          <span>{processingId === discussion.id ? '' : '承認'}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 ruby-text">
                  承認待ちの会話はありません。
                </p>
              </div>
            )}
          </div>
        ) : (
          /* 承認済み会話タブ */
          <div className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : approvedDiscussions.length > 0 ? (
              <div className="space-y-4 ruby-text">
                {approvedDiscussions.map((discussion) => (
                  <div
                    key={discussion.id}
                    className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="card-title text-lg">
                            <span>{discussion.title}</span>
                            <span className="badge badge-sm badge-success ml-2">承認済み</span>
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {discussion.description.length > 70
                              ? `${discussion.description.slice(0, 70)}...`
                              : discussion.description}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <div className="text-xs text-gray-500 space-y-1">
                              <time
                                dateTime={new Date(
                                  discussion.createdAt * 1000
                                ).toISOString()}
                              >
                                作成: {formatRelativeTime(discussion.createdAt)}
                              </time>
                              {/* 作成者が管理者・モデレーターの場合、名前を表示 */}
                              {(discussion.authorPubkey === ADMIN_PUBKEY ||
                                discussion.moderators.some(
                                  (m) => m.pubkey === discussion.authorPubkey
                                )) && (
                                <div className="text-xs">
                                  作成者:{" "}
                                  {profiles[discussion.authorPubkey]?.name ||
                                    "名前未設定"}
                                </div>
                              )}
                              {/* モデレーターの名前を表示 */}
                              {discussion.moderators.length > 0 && (
                                <div className="text-xs">
                                  モデレーター:{" "}
                                  {discussion.moderators
                                    .map(
                                      (mod) =>
                                        profiles[mod.pubkey]?.name ||
                                        "名前未設定"
                                    )
                                    .join(", ")}
                                </div>
                              )}
                            </div>
                            <span className="badge badge-outline badge-sm">
                              {discussion.moderators.length + 1} モデレーター
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRevokeDiscussion(discussion)}
                          disabled={processingId === discussion.id}
                          loading={processingId === discussion.id}
                          className="btn-sm btn-error ml-4"
                        >
                          <span>{processingId === discussion.id ? '' : '一覧から削除'}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 ruby-text">
                  承認済みの会話はありません。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminCheck>
  );
}
