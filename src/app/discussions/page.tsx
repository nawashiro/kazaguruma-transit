"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { AuditTimeline } from "@/components/discussion/AuditTimeline";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  createAuditTimeline,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import {
  buildNaddrFromDiscussion,
  extractDiscussionFromNaddr,
} from "@/lib/nostr/naddr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionsPage() {
  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // 監査ログ用の独立した状態
  const [auditPosts, setAuditPosts] = useState<DiscussionPost[]>([]);
  const [auditApprovals, setAuditApprovals] = useState<PostApproval[]>([]);
  const [auditReferencedDiscussions, setAuditReferencedDiscussions] = useState<
    Discussion[]
  >([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [isAuditLoaded, setIsAuditLoaded] = useState(false);

  const { user } = useAuth();

  // 会話一覧専用のデータ取得
  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled()) return;
    setIsLoading(true);

    try {
      const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
      if (!discussionListNaddr) {
        logger.error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
        throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
      }

      const discussionInfo = extractDiscussionFromNaddr(discussionListNaddr);
      if (!discussionInfo) {
        throw new Error("Invalid DISCUSSION_LIST_NADDR format");
      }

      logger.info(
        "Loading discussion list with discussionId:",
        discussionInfo.discussionId
      );

      // 会話一覧管理用のデータを取得
      const [discussionListEvents, discussionListApprovals] = await Promise.all(
        [
          nostrService.getEvents([
            {
              kinds: [34550],
              authors: [discussionInfo.authorPubkey],
              "#d": [discussionInfo.dTag],
              limit: 1,
            },
          ]),
          nostrService.getApprovals(discussionInfo.discussionId),
        ]
      );

      const discussionListMeta =
        discussionListEvents.length > 0
          ? parseDiscussionEvent(discussionListEvents[0])
          : null;

      if (!discussionListMeta) {
        throw new Error("Discussion list metadata not found");
      }

      // 承認されたkind:1111投稿を特定
      const listApprovals = discussionListApprovals
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      // 承認イベントから投稿データを復元
      const listPosts = listApprovals
        .map((approval) => {
          try {
            const approvedPost = JSON.parse(approval.event.content);
            return parsePostEvent(approvedPost, [approval]);
          } catch {
            return null;
          }
        })
        .filter((p): p is DiscussionPost => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      // 承認されたkind:1111のqタグから個別会話のnaddrを取得（重複排除）
      const individualDiscussionRefs = new Set<string>();
      listPosts.forEach((post) => {
        const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
        qTags.forEach((qTag) => {
          if (qTag[1] && qTag[1].startsWith("34550:")) {
            individualDiscussionRefs.add(qTag[1]);
          }
        });
      });

      // 個別会話のkind:34550を取得
      const individualDiscussions =
        await nostrService.getReferencedUserDiscussions(
          Array.from(individualDiscussionRefs)
        );

      const parsedIndividualDiscussions = individualDiscussions
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      // 会話一覧データを設定
      setDiscussions(parsedIndividualDiscussions);

      // プロファイル取得（管理者・モデレーターのみ）
      const shouldLoadProfiles = user.pubkey === ADMIN_PUBKEY;

      if (shouldLoadProfiles) {
        const uniquePubkeys = new Set<string>();
        uniquePubkeys.add(ADMIN_PUBKEY);

        parsedIndividualDiscussions.forEach((discussion) => {
          if (
            discussion.authorPubkey === ADMIN_PUBKEY ||
            discussion.moderators.some(
              (m) => m.pubkey === discussion.authorPubkey
            )
          ) {
            uniquePubkeys.add(discussion.authorPubkey);
          }
          discussion.moderators.forEach((mod) => uniquePubkeys.add(mod.pubkey));
        });

        const profilePromises = Array.from(uniquePubkeys).map(
          async (pubkey) => {
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
          }
        );

        const profileResults = await Promise.all(profilePromises);
        const profilesMap = Object.fromEntries(profileResults);
        setProfiles(profilesMap);
      } else {
        setProfiles({});
      }

      logger.info("Individual discussions loaded:", {
        count: parsedIndividualDiscussions.length,
        discussions: parsedIndividualDiscussions.map((d) => d.title),
      });
    } catch (error) {
      logger.error("Failed to load discussion list:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user.pubkey]);

  // Rubyfulライブラリ対応
  useRubyfulRun([discussions], isLoaded);

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }
    setIsLoaded(true);
  }, [loadData]);

  // ディスカッション機能が有効になっているか確認し、それに応じて表示を切り替える
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

  // 監査ログ専用のデータ取得
  const loadAuditData = async () => {
    if (isAuditLoaded || isAuditLoading) return;

    setIsAuditLoading(true);

    try {
      const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
      if (!discussionListNaddr) {
        logger.error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
        throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
      }

      const discussionInfo = extractDiscussionFromNaddr(discussionListNaddr);
      if (!discussionInfo) {
        throw new Error("Invalid DISCUSSION_LIST_NADDR format");
      }

      logger.info(
        "Loading audit data for discussionId:",
        discussionInfo.discussionId
      );

      // 監査ログ用のデータを取得
      const [discussionListPosts, discussionListApprovals] = await Promise.all([
        nostrService.getDiscussionPosts(discussionInfo.discussionId),
        nostrService.getApprovals(discussionInfo.discussionId),
      ]);

      const listApprovals = discussionListApprovals
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const listPosts = discussionListPosts
        .map((event) => parsePostEvent(event, listApprovals))
        .filter((p): p is DiscussionPost => p !== null);

      // qタグから参照されている個別会話のIDを収集（重複排除）
      const individualDiscussionRefs = new Set<string>();
      listPosts.forEach((post) => {
        const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
        qTags.forEach((qTag) => {
          if (qTag[1] && qTag[1].startsWith("34550:")) {
            individualDiscussionRefs.add(qTag[1]);
          }
        });
      });

      // 参照されている個別会話のkind:34550を取得
      let referencedDiscussions: Discussion[] = [];
      if (individualDiscussionRefs.size > 0) {
        const individualDiscussions =
          await nostrService.getReferencedUserDiscussions(
            Array.from(individualDiscussionRefs)
          );
        referencedDiscussions = individualDiscussions
          .map(parseDiscussionEvent)
          .filter((d): d is Discussion => d !== null);
      }

      // 監査ログ用のプロファイル取得（参照された会話の作成者・モデレーターのみ）
      const shouldLoadAuditProfiles = user.pubkey === ADMIN_PUBKEY;

      if (shouldLoadAuditProfiles && referencedDiscussions.length > 0) {
        const auditUniquePubkeys = new Set<string>();
        auditUniquePubkeys.add(ADMIN_PUBKEY);

        referencedDiscussions.forEach((discussion) => {
          // 会話作成者を追加
          auditUniquePubkeys.add(discussion.authorPubkey);
          // モデレーターを追加
          discussion.moderators.forEach((mod) =>
            auditUniquePubkeys.add(mod.pubkey)
          );
        });

        const auditProfilePromises = Array.from(auditUniquePubkeys).map(
          async (pubkey) => {
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
          }
        );

        const auditProfileResults = await Promise.all(auditProfilePromises);
        const auditProfilesMap = Object.fromEntries(auditProfileResults);

        // プロファイルをメイン状態に統合（監査ログデータと合わせる）
        setProfiles((prevProfiles) => ({
          ...prevProfiles,
          ...auditProfilesMap,
        }));
      }

      // 監査ログデータを設定
      setAuditPosts(listPosts);
      setAuditApprovals(listApprovals);
      setAuditReferencedDiscussions(referencedDiscussions);
      setIsAuditLoaded(true);

      logger.info("Audit data loaded:", {
        posts: listPosts.length,
        approvals: listApprovals.length,
        referencedDiscussions: referencedDiscussions.length,
        profilesLoaded: shouldLoadAuditProfiles,
      });
    } catch (error) {
      logger.error("Failed to load audit data:", error);
    } finally {
      setIsAuditLoading(false);
    }
  };

  // 監査ログタブがアクティブになった時のデータ取得
  const handleTabChange = (tab: "main" | "audit") => {
    setActiveTab(tab);
    if (tab === "audit") {
      loadAuditData();
    }
  };

  // spec_v2.md要件: リクエスト機能は完全オミット
  const auditItems = createAuditTimeline(
    auditReferencedDiscussions,
    [],
    auditPosts,
    auditApprovals
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 ruby-text">
        <h1 className="text-3xl font-bold mb-4">意見交換</h1>
        <p className="text-gray-600 dark:text-gray-400">
          意見交換を行うために自由に利用していい場所です。誰でも新しい会話を作成できます。
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
          onClick={() => handleTabChange("main")}
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
          onClick={() => handleTabChange("audit")}
        >
          <span>監査ログ</span>
        </button>
      </nav>

      {activeTab === "main" ? (
        <main role="tabpanel" aria-labelledby="main-tab" className="space-y-6">
          {/* 作成者またはモデレーターの場合のみ表示 */}
          {(discussions.some((d) => user.pubkey === d.authorPubkey) ||
            discussions.some((d) =>
              d.moderators.some((m) => m.pubkey === user.pubkey)
            )) && (
            <aside className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="mb-4">
                あなたは
                {/* Priority: Creator > Moderator */}
                {discussions.some((d) => user.pubkey === d.authorPubkey) ? (
                  <span>作成者</span>
                ) : (
                  <span>モデレーター</span>
                )}
                です。
              </p>
              <Link
                href="/discussions/manage"
                className="btn btn-primary rounded-full dark:rounded-sm ruby-text"
              >
                <span>会話管理</span>
              </Link>
            </aside>
          )}

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
                <div className="space-y-4">
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
                            <h3 className="card-title text-lg ruby-text">
                              <span>{discussion.title}</span>
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 ruby-text">
                              {discussion.description.length > 70
                                ? `${discussion.description.slice(0, 70)}...`
                                : discussion.description}
                            </p>
                            <div className="flex justify-between items-center mt-2">
                              <div className="text-gray-500 space-y-1">
                                <time
                                  dateTime={new Date(
                                    discussion.createdAt * 1000
                                  ).toISOString()}
                                >
                                  {formatRelativeTime(discussion.createdAt)}
                                </time>
                              </div>
                              <div className="flex items-center gap-2">
                                {(user.pubkey === discussion.authorPubkey ||
                                  discussion.moderators.some(
                                    (m) => m.pubkey === user.pubkey
                                  )) && (
                                  <p className="badge badge-primary badge-sm">
                                    <span>参加中</span>
                                  </p>
                                )}
                                <p className="text-sm">
                                  {discussion.moderators.length + 1}
                                  モデレーター
                                </p>
                              </div>
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
                {isAuditLoading ? (
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
                    referencedDiscussions={auditReferencedDiscussions}
                    conversationAuditMode={true}
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
