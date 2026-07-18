"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { DiscussionListTabLayout } from "@/components/discussion/DiscussionListTabLayout";
import PageHeader from "@/components/layouts/PageHeader";
import { formatRelativeTime } from "@/lib/nostr/nostr-utils";
import { buildNaddrFromDiscussion } from "@/lib/nostr/naddr-utils";
import { useDiscussionManagementData } from "@/components/discussion/DiscussionManagementDataProvider";

export default function DiscussionsPage() {
  const { user } = useAuth();
  const {
    posts,
    referencedDiscussions,
    isModerationLoading,
    isReferencedDiscussionsLoading,
    moderationError: loadError,
  } = useDiscussionManagementData();
  const visibleDiscussionReferences = useMemo(
    () =>
      new Set(
        posts
          .filter(
            (post) => post.approved || post.approvalState === "unknown",
          )
          .flatMap((post) =>
            (post.event?.tags ?? [])
              .filter(
                (tag) => tag[0] === "q" && tag[1]?.startsWith("34550:"),
              )
              .map((tag) => tag[1]),
          ),
      ),
    [posts],
  );
  const discussions = useMemo(
    () =>
      referencedDiscussions
        .filter((discussion) =>
          visibleDiscussionReferences.has(
            `34550:${discussion.authorPubkey}:${discussion.dTag}`,
          ),
        )
        .sort((left, right) => right.createdAt - left.createdAt),
    [referencedDiscussions, visibleDiscussionReferences],
  );
  const isLoading =
    isModerationLoading || isReferencedDiscussionsLoading;

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
    <DiscussionListTabLayout baseHref="/discussions">
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
