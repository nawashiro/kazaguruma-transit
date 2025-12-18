"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { AuditLogSection } from "@/components/discussion/AuditLogSection";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  formatRelativeTime,
} from "@/lib/nostr/nostr-utils";
import {
  buildNaddrFromDiscussion,
  extractDiscussionFromNaddr,
} from "@/lib/nostr/naddr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import type { Event } from "nostr-tools";

const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionsPage() {
  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // AuditLogSectionコンポーネントの参照
  const auditLogSectionRef = React.useRef<{ loadAuditData: () => void }>(null);
  const approvalStreamCleanupRef = useRef<(() => void) | null>(null);
  const discussionStreamCleanupRef = useRef<(() => void) | null>(null);
  const loadSequenceRef = useRef(0);

  const { user } = useAuth();

  // 会話一覧専用のデータ取得
  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled()) return;
    const loadSequence = ++loadSequenceRef.current;
    setIsLoading(true);
    setDiscussions([]);
    approvalStreamCleanupRef.current?.();
    approvalStreamCleanupRef.current = null;
    discussionStreamCleanupRef.current?.();
    discussionStreamCleanupRef.current = null;

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

      const parseDiscussionsFromEvents = (events: Event[]) => {
        const parsed = events
          .map(parseDiscussionEvent)
          .filter((d): d is Discussion => d !== null);
        const latestById = new Map<string, Discussion>();
        parsed.forEach((discussion) => {
          const existing = latestById.get(discussion.id);
          if (!existing || discussion.createdAt > existing.createdAt) {
            latestById.set(discussion.id, discussion);
          }
        });

        return Array.from(latestById.values()).sort(
          (a, b) => b.createdAt - a.createdAt
        );
      };

      const updateFromApprovals = async (events: Event[]) => {
        if (loadSequenceRef.current !== loadSequence) return;
        const listApprovals = events
          .map(parseApprovalEvent)
          .filter((a): a is PostApproval => a !== null);

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

        const individualDiscussionRefs = new Set<string>();
        listPosts.forEach((post) => {
          const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
          qTags.forEach((qTag) => {
            if (qTag[1] && qTag[1].startsWith("34550:")) {
              individualDiscussionRefs.add(qTag[1]);
            }
          });
        });

        const parsedIndividualDiscussions: Discussion[] = [];
        if (individualDiscussionRefs.size > 0) {
          discussionStreamCleanupRef.current?.();
          discussionStreamCleanupRef.current =
            nostrService.streamReferencedUserDiscussions(
              Array.from(individualDiscussionRefs),
              {
                onEvent: (discussionEvents) => {
                  if (loadSequenceRef.current !== loadSequence) return;
                  const parsed = parseDiscussionsFromEvents(discussionEvents);
                  if (parsed.length > 0) {
                    setDiscussions(parsed);
                    setIsLoading(false);
                  }
                },
                onEose: (discussionEvents) => {
                  if (loadSequenceRef.current !== loadSequence) return;
                  const parsed = parseDiscussionsFromEvents(discussionEvents);
                  setDiscussions(parsed);
                  setIsLoading(false);
                },
              }
            );

          return;
        }

        setDiscussions(parsedIndividualDiscussions);
        setIsLoading(false);
      };

      approvalStreamCleanupRef.current = nostrService.streamApprovals(
        discussionInfo.discussionId,
        {
          onEose: updateFromApprovals,
          onEvent: () => {},
        }
      );
    } catch (error) {
      logger.error("Failed to load discussion list:", error);
      setDiscussions([]);
      setIsLoading(false);
    } finally {
      logger.info("Finished loading discussion list");
    }
  }, []);


  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }

    return () => {
      approvalStreamCleanupRef.current?.();
      approvalStreamCleanupRef.current = null;
      discussionStreamCleanupRef.current?.();
      discussionStreamCleanupRef.current = null;
    };
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

  // 監査ログタブがアクティブになった時のデータ取得
  const handleTabChange = (tab: "main" | "audit") => {
    setActiveTab(tab);
    if (tab === "audit") {
      auditLogSectionRef.current?.loadAuditData();
    }
  };

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
          <AuditLogSection
            ref={auditLogSectionRef}
            discussion={null}
            discussionInfo={null}
            conversationAuditMode={true}
            referencedDiscussions={[]}
            isDiscussionList={true}
          />
        </main>
      )}

      {/* spec_v2.md要件: ログインモーダルも不要 */}
    </div>
  );
}
