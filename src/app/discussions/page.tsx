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
  createAuditTimeline,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { buildNaddrFromDiscussion } from "@/lib/nostr/naddr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type { Discussion } from "@/types/discussion";
import { logger } from "@/utils/logger";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());
const ITEMS_PER_PAGE = 10;

export default function DiscussionsPage() {
  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
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
  useRubyfulRun([discussions], isLoaded);

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
      // Calculate until timestamp for pagination (last discussion's created_at - 1)
      let until: number | undefined;
      if (page > 1 && discussions.length > 0) {
        const lastDiscussion = discussions[discussions.length - 1];
        until = (lastDiscussion.approvedAt || lastDiscussion.createdAt) - 1;
      }

      // spec_v2.md要件: 管理者作成のKind:34550で承認されたユーザー作成会話を取得（ページネーション対応）
      const approvedUserDiscussions =
        await nostrService.getApprovedUserDiscussions(ADMIN_PUBKEY, { 
          limit: ITEMS_PER_PAGE + 1, // +1 to check if there are more items
          until 
        });

      // Check if there are more items
      const hasMoreItems = approvedUserDiscussions.length > ITEMS_PER_PAGE;
      const discussionsToProcess = hasMoreItems 
        ? approvedUserDiscussions.slice(0, ITEMS_PER_PAGE)
        : approvedUserDiscussions;

      const parsedDiscussions = discussionsToProcess
        .map(({ userDiscussion, approvalEvent, approvedAt }) => {
          const discussion = parseDiscussionEvent(userDiscussion);
          if (!discussion) return null;

          // 承認情報を追加
          return {
            ...discussion,
            approvedAt,
            approvalReference: `34550:${approvalEvent.pubkey}:${
              approvalEvent.tags.find((tag) => tag[0] === "d")?.[1] || ""
            }`,
          };
        })
        .filter((d): d is any => d !== null)
        .sort(
          (a: any, b: any) => {
            const aTime = a?.approvedAt || a?.createdAt || 0;
            const bTime = b?.approvedAt || b?.createdAt || 0;
            return bTime - aTime;
          }
        );

      if (append && page > 1) {
        setDiscussions(prev => [...prev, ...parsedDiscussions as Discussion[]]);
      } else {
        setDiscussions(parsedDiscussions as Discussion[]);
      }
      
      setHasMore(hasMoreItems);
      setCurrentPage(page);

      // spec_v2.md要件: 管理者・モデレーターのプロファイルを取得
      const uniquePubkeys = new Set<string>();
      uniquePubkeys.add(ADMIN_PUBKEY);

      parsedDiscussions.forEach((discussion) => {
        if (discussion) {
          // 作成者が管理者・モデレーターの場合のみプロファイル取得
          if (
            discussion.authorPubkey === ADMIN_PUBKEY ||
            discussion.moderators.some(
              (m: any) => m.pubkey === discussion.authorPubkey
            )
          ) {
            uniquePubkeys.add(discussion.authorPubkey);
          }
          // モデレーターのプロファイル取得
          discussion.moderators.forEach((mod: any) => uniquePubkeys.add(mod.pubkey));
        }
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
    } catch (error) {
      logger.error("Failed to load discussions:", error);
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

  const auditItems = createAuditTimeline(discussions, [], [], []);

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
                      'さらに読み込む'
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
                    誰でも新しい会話を作成できます。会話一覧への掲載は管理者による承認が必要です。
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
                    shouldLoadProfiles={false}
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
