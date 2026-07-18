"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { getDiscussionReadStrategyConfig, isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { DiscussionListTabLayout } from "@/components/discussion/DiscussionListTabLayout";
import PageHeader from "@/components/layouts/PageHeader";
import {
  createDiscussionNdkGateway,
  type NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import {
  buildNaddrFromDiscussion,
  extractDiscussionFromNaddr,
} from "@/lib/nostr/naddr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { loadDiscussionModerationSnapshot } from "@/lib/discussion/discussion-moderation-snapshot";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { saveKnownDiscussionData } from "@/lib/discussion/discussion-known-data-cache";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import type { DiscussionRole } from "@/components/discussion/DiscussionRoleCard";

const nostrServiceConfig = getNostrServiceConfig();
const readStrategy =
  typeof getDiscussionReadStrategyConfig === "function"
    ? getDiscussionReadStrategyConfig()
    : { relayLimit: 3, idleTimeoutMs: nostrServiceConfig.defaultTimeout, hardTimeoutMs: nostrServiceConfig.defaultTimeout * 3, dedupWindowMs: 250 };
const discussionGateway = createDiscussionNdkGateway(nostrServiceConfig);
const nostrService = createNostrService(nostrServiceConfig);

export default function DiscussionsPage() {
  const [discussions, setDiscussions] = React.useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const { user } = useAuth();
  const discussionRole: DiscussionRole = arePubkeysEqual(user.pubkey, getAdminPubkeyHex())
    ? "admin"
    : discussions.some((discussion) =>
        discussion.moderators.some((moderator) =>
          arePubkeysEqual(user.pubkey, moderator.pubkey),
        ),
      )
      ? "moderator"
      : "user";

  // 会話一覧専用のデータ取得
  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled()) return;
    setIsLoading(true);
    setLoadError(null);
    setDiscussions([]);

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

      const parseDiscussionsFromEvents = (events: NostrEventDTO[]) => {
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

      const moderation = typeof nostrService.getEventsWithCompletion === "function"
        ? await loadDiscussionModerationSnapshot(nostrService, readStrategy, {
            discussionId: discussionInfo.discussionId,
            hints: discussionInfo.relays,
            configured: nostrServiceConfig.relays.filter((relay) => relay.read).map((relay) => relay.url),
            defaults: [],
          })
        : null;
      logger.info("discussions-list approvals fetch completed", {
        discussionId: discussionInfo.discussionId,
        completionReason: moderation?.completionReason ?? "eose",
        eventCount: moderation?.approvalEvents.length ?? 0,
      });
      if (moderation) {
        const events = [...moderation.primaryEvents, ...moderation.approvalEvents];
        saveKnownDiscussionData(discussionInfo.discussionId, {
          metadata: null,
          eventIds: events.map((event) => event.id),
          attemptedRelayUrls: moderation.attemptedRelayUrls,
          successfulEventRelayUrls: moderation.successfulRelayUrls,
          successfulRelays: [],
          events,
        });
      }

      const listApprovals = (moderation?.approvalEvents ?? (await discussionGateway.queryWithCompletion([{ kinds: [4550], "#a": [discussionInfo.discussionId], limit: 50 }], { idleTimeoutMs: readStrategy.idleTimeoutMs, hardTimeoutMs: readStrategy.hardTimeoutMs, relayUrls: [] })).events)
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const listPosts = moderation
        ? moderation.primaryEvents.map((event) => parsePostEvent(event, listApprovals)).filter((p): p is DiscussionPost => p !== null)
        : listApprovals.map((approval) => {
            try { return parsePostEvent(JSON.parse(approval.event.content), [approval]); } catch { return null; }
          }).filter((p): p is DiscussionPost => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
      const visibleListPosts = moderation
        ? listPosts.filter((post) => post.approved || moderation.approvalState === "unknown")
        : listPosts;

      const individualDiscussionRefs = new Set<string>();
      visibleListPosts.forEach((post) => {
        const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
        qTags.forEach((qTag) => {
          if (qTag[1] && qTag[1].startsWith("34550:")) {
            individualDiscussionRefs.add(qTag[1]);
          }
        });
      });

      if (individualDiscussionRefs.size === 0) {
        setDiscussions([]);
        setIsLoading(false);
        return;
      }

      const discussionFilters = Array.from(individualDiscussionRefs)
        .map((ref) => {
          const parts = ref.split(":");
          if (parts.length !== 3 || parts[0] !== "34550") {
            return null;
          }
          const [, pubkey, dTag] = parts;
          return {
            kinds: [34550],
            authors: [pubkey],
            "#d": [dTag],
            limit: 1,
          };
        })
        .filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));

      if (discussionFilters.length === 0) {
        setDiscussions([]);
        setIsLoading(false);
        return;
      }

      const discussionsResult = await discussionGateway.queryWithCompletion(
        discussionFilters,
        {
          idleTimeoutMs: nostrServiceConfig.defaultTimeout,
          hardTimeoutMs: nostrServiceConfig.defaultTimeout * 3,
        }
      );
      logger.info("discussions-list metadata fetch completed", {
        discussionId: discussionInfo.discussionId,
        completionReason: discussionsResult.completionReason,
        eventCount: discussionsResult.eventCount,
        elapsedMs: discussionsResult.elapsedMs,
      });
      setDiscussions(parseDiscussionsFromEvents(discussionsResult.events));
      setIsLoading(false);
    } catch (error) {
      logger.error("Failed to load discussion list:", error);
      setLoadError("会話一覧の取得に失敗しました。時間をおいて再度お試しください。");
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
  }, [loadData]);

  // ディスカッション機能が有効になっているか確認し、それに応じて表示を切り替える
  if (!isDiscussionsEnabled()) {
    return (
      <div className="py-8 ruby-text">
        <PageHeader
          title="意見交換機能"
          description="この機能は現在利用できません。"
        />
      </div>
    );
  }

  return (
    <DiscussionListTabLayout baseHref="/discussions" role={discussionRole}>
      <div className="space-y-6 py-8">
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
              ) : loadError ? (
                <div className="alert alert-error" role="alert">
                  <span>{loadError}</span>
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
                                  <p className="badge badge-primary">
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
                <div className="py-8">
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
                    className="btn btn-primary w-full rounded-full dark:rounded-sm"
                  >
                    <span className="ruby-text">新しい会話を作成</span>
                  </Link>
                </div>
              </div>
            </section>
      </div>
    </DiscussionListTabLayout>
  );
}
