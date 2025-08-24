"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { AuditTimeline } from "@/components/discussion/AuditTimeline";
import { AdminCheck } from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  createAuditTimeline,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { buildNaddrFromDiscussion, extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type { Discussion, DiscussionPost, PostApproval } from "@/types/discussion";
import { logger } from "@/utils/logger";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());
const ITEMS_PER_PAGE = 10;

export default function DiscussionsPage() {
  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { user } = useAuth();

  // Rubyfulライブラリ対応
  useRubyfulRun([discussions, posts, approvals], isLoaded);

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }
    setIsLoaded(true);
  }, []);

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8 ruby-text">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">意見交換機能</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const loadData = async (page: number = 1, append: boolean = false) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // spec_v2.md要件: 個別会話ページと全く同じ実装。環境変数のnaddrを使用。
      const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
      if (!discussionListNaddr) {
        logger.error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
        throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
      }

      // 個別会話ページと同じ：naddrからdiscussionInfoを取得
      const discussionInfo = extractDiscussionFromNaddr(discussionListNaddr);
      if (!discussionInfo) {
        throw new Error("Invalid DISCUSSION_LIST_NADDR format");
      }

      logger.info("Loading discussion list with discussionId:", discussionInfo.discussionId);

      // spec_v2.md仕様: 会話一覧管理用のkind:34550から、承認されたkind:1111を取得
      const [discussionListEvents, discussionListPosts, discussionListApprovals] = await Promise.all([
        // 会話一覧管理用のkind:34550（メタデータ）
        nostrService.getEvents([{
          kinds: [34550],
          authors: [discussionInfo.authorPubkey],
          "#d": [discussionInfo.dTag],
          limit: 1
        }]),
        // 会話一覧管理用の会話のkind:1111投稿
        nostrService.getDiscussionPosts(discussionInfo.discussionId),
        // 会話一覧管理用の会話のkind:4550承認
        nostrService.getApprovals(discussionInfo.discussionId),
      ]);

      const discussionListMeta = discussionListEvents.length > 0 
        ? parseDiscussionEvent(discussionListEvents[0])
        : null;

      if (!discussionListMeta) {
        throw new Error("Discussion list metadata not found");
      }

      // 承認されたkind:1111投稿を特定
      const listApprovals = discussionListApprovals
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const listPosts = discussionListPosts
        .map((event) => parsePostEvent(event, listApprovals))
        .filter((p): p is DiscussionPost => p !== null && p.approved)
        .sort((a, b) => b.createdAt - a.createdAt);

      logger.info("Discussion list posts:", {
        totalPosts: discussionListPosts.length,
        approvedPosts: listPosts.length,
        posts: listPosts.map(p => ({ content: p.content.slice(0, 50) }))
      });

      // spec_v2.md仕様: 承認されたkind:1111のqタグから個別会話のnaddrを取得
      const individualDiscussionRefs: string[] = [];
      listPosts.forEach(post => {
        // qタグから個別会話の参照を取得
        const qTags = post.event?.tags?.filter(tag => tag[0] === "q") || [];
        qTags.forEach(qTag => {
          if (qTag[1] && qTag[1].startsWith("34550:")) {
            individualDiscussionRefs.push(qTag[1]);
          }
        });
      });

      logger.info("Individual discussion refs:", individualDiscussionRefs);

      // 個別会話のkind:34550を取得
      const individualDiscussions = await nostrService.getReferencedUserDiscussions(individualDiscussionRefs);
      
      const parsedIndividualDiscussions = individualDiscussions
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      // 表示用データを設定
      setDiscussions(parsedIndividualDiscussions);
      setPosts(discussionListPosts.map((event) => parsePostEvent(event, listApprovals)).filter((p): p is DiscussionPost => p !== null));
      setApprovals(listApprovals);

      // プロファイル取得（管理者・モデレーターのみ）
      const shouldLoadProfiles = user.pubkey === ADMIN_PUBKEY;

      if (shouldLoadProfiles) {
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
      } else {
        setProfiles({});
      }

      logger.info("Individual discussions loaded:", {
        count: parsedIndividualDiscussions.length,
        discussions: parsedIndividualDiscussions.map(d => d.title)
      });

    } catch (error) {
      logger.error("Failed to load discussion list:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = async () => {
    if (!isLoadingMore && hasMore) {
      await loadData(currentPage + 1, true);
    }
  };


  // spec_v2.md要件: リクエスト機能は完全オミット

  const auditItems = createAuditTimeline(discussions, [], posts, approvals);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 ruby-text">
        <h1 className="text-3xl font-bold mb-4">意見交換</h1>
        <p className="text-gray-600 dark:text-gray-400">
          風ぐるまの利用体験について意見交換を行う場所です。
        </p>
      </div>

      <nav role="tablist" className="join mb-6">
        <button
          className={`join-item btn ruby-text ${
            activeTab === "main" && "btn-active btn-primary"
          }`}
          name="tab-options"
          aria-label="意見交換タブを開く"
          role="tab"
          area-selected={activeTab === "main" ? "true" : "false"}
          onClick={() => setActiveTab("main")}
        >
          <span>意見交換</span>
        </button>
        <button
          className={`join-item btn ruby-text ${
            activeTab === "audit" && "btn-active btn-primary"
          }`}
          name="tab-options"
          aria-label="監査ログを開く"
          role="tab"
          area-selected={activeTab === "audit" ? "true" : "false"}
          onClick={() => setActiveTab("audit")}
        >
          <span>監査ログ</span>
        </button>
      </nav>

      {activeTab === "main" ? (
        <main role="tabpanel" aria-labelledby="main-tab" className="space-y-6">
          <AdminCheck adminPubkey={ADMIN_PUBKEY} userPubkey={user.pubkey}>
            <aside className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="mb-4">あなたは管理者です。</p>
              <Link
                href="/discussions/manage"
                className="btn btn-primary rounded-full dark:rounded-sm ruby-text"
              >
                <span>会話管理</span>
              </Link>
            </aside>
          </AdminCheck>

          <div className="grid lg:grid-cols-2 gap-6">
            <section aria-labelledby="discussions-list-heading">
              <h2
                id="discussions-list-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                会話一覧
              </h2>

              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : discussions.length > 0 ? (
                <div className="space-y-4 ruby-text">
                  {discussions.map((discussion) => (
                    <article key={discussion.id}>
                      <Link
                        href={`/discussions/${buildNaddrFromDiscussion(
                          discussion
                        )}`}
                        className="block"
                      >
                        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
                          <div className="card-body p-4">
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
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400 ruby-text">
                    会話がまだありません。
                  </p>
                </div>
              )}

              {/* ページネーション */}
              {hasMore && !isLoading && discussions.length > 0 && (
                <div className="text-center mt-6">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="btn btn-outline rounded-full dark:rounded-sm"
                  >
                    {isLoadingMore ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        読み込み中...
                      </>
                    ) : (
                      "さらに読み込む"
                    )}
                  </button>
                </div>
              )}
            </section>

            {/* spec_v2.md要件: 会話作成ページへのリンクを表示 */}
            <section aria-labelledby="create-discussion-section">
              <h2
                id="create-discussion-section"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                会話を作成
              </h2>

              <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="card-body">
                  <p className="text-sm text-gray-600 dark:text-gray-400 ruby-text mb-4">
                    誰でも新しい会話を作成できます。
                  </p>
                  <Link
                    href="/discussions/create"
                    className="btn btn-primary rounded-full dark:rounded-sm ruby-text w-full"
                  >
                    <span>新しい会話を作成</span>
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </main>
      ) : (
        <main role="tabpanel" aria-labelledby="audit-tab">
          <section aria-labelledby="audit-log-heading">
            <h2
              id="audit-log-heading"
              className="text-xl font-semibold mb-4 ruby-text"
            >
              監査ログ
            </h2>
            <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="card-body">
                {isLoading ? (
                  <div className="animate-pulse space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                      ></div>
                    ))}
                  </div>
                ) : (
                  <AuditTimeline
                    items={auditItems}
                    profiles={profiles}
                    adminPubkey={ADMIN_PUBKEY}
                    viewerPubkey={user.pubkey}
                    shouldLoadProfiles={
                      user.pubkey === ADMIN_PUBKEY ||
                      discussions.some(d => d.moderators.some(m => m.pubkey === user.pubkey))
                    }
                  />
                )}
              </div>
            </div>
          </section>
        </main>
      )}

      {/* spec_v2.md要件: ログインモーダルも不要 */}
    </div>
  );
}
