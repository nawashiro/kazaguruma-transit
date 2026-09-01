"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import PageHeader from "@/components/layouts/PageHeader";
import { formatRelativeTime } from "@/lib/nostr/nostr-utils";
import { buildNaddrFromDiscussion } from "@/lib/nostr/naddr-utils";
import { resolveDiscussionReferences } from "@/lib/discussion/discussion-reference-resolver";
import { useDiscussionManagement } from "@/components/discussion/DiscussionManagementProvider";

export default function DiscussionsPage() {
  const { user } = useAuth();
  const management = useDiscussionManagement();
  const snapshot = management.snapshot;
  const posts = snapshot?.listingPosts;
  const referencedDiscussions = snapshot?.referencedDiscussions;
  const discussions = useMemo(() => {
    const listingPosts = posts ?? [];
    const referenced = referencedDiscussions ?? [];
    const approvedReferenceIds = new Set(
      listingPosts
        .filter((post) => post.approved && post.approvalState === "approved")
        .flatMap((post) =>
          resolveDiscussionReferences(post.event?.tags ?? []).references,
        )
        .map((reference) => reference.discussionId),
    );
    return referenced
      .filter((discussion) => approvedReferenceIds.has(discussion.id))
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [posts, referencedDiscussions]);
  const isLoading = management.state === "loading";
  const isPartialRead = management.state === "partial";
  const loadError = management.state === "error" ? management.error : null;
  const reload = management.reload;

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
    <div className="space-y-6 py-8">
            <section aria-labelledby="discussions-list-heading">
              <h2
                id="discussions-list-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                会話一覧
              </h2>

              {isLoading ? (
                <div role="status" aria-live="polite" className="space-y-4">
                  <span className="sr-only">会話一覧を読み込み中...</span>
                  <div className="animate-pulse space-y-4" aria-hidden="true">
                    {[...Array(3)].map((_, i) => (
                      <div key={i}>
                        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : loadError ? (
                <div className="alert alert-error alert-soft text-base-content!" role="status" aria-live="polite">
                  <p>{loadError}</p>
                  <button
                    type="button"
                    className="btn text-base btn-outline ruby-text gap-0 min-h-[44px] rounded-full dark:rounded-sm"
                    onClick={() => void reload()}
                  >
                    再読み込み
                  </button>
                </div>
              ) : discussions.length > 0 ? (
                <>
                  {isPartialRead && (
                    <div className="alert alert-warning alert-soft text-base-content! mb-4" role="status" aria-live="polite">
                      <p>会話一覧を完全に取得できませんでした。再読み込みしてください。</p>
                      <button
                        type="button"
                        className="btn text-base btn-outline ruby-text gap-0 min-h-[44px] rounded-full dark:rounded-sm"
                        onClick={() => void reload()}
                      >
                        再読み込み
                      </button>
                    </div>
                  )}
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
                            <h3 className="card-title text-lg ruby-text gap-0">
                              {discussion.title}
                            </h3>
                            <p className="text-base text-base-content ruby-text">
                              {discussion.description.length > 70
                                ? `${discussion.description.slice(0, 70)}...`
                                : discussion.description}
                            </p>
                            <div className="flex justify-between items-center mt-2">
                              <div className="text-base-content space-y-1">
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
                                  <p className="badge badge-primary badge-md">参加中</p>
                                )}
                                <p className="text-base">
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
                </>
              ) : isPartialRead ? (
                <div className="alert alert-warning alert-soft text-base-content!" role="status" aria-live="polite">
                  <p>会話一覧を完全に取得できませんでした。再読み込みしてください。</p>
                  <button
                    type="button"
                    className="btn text-base btn-outline ruby-text gap-0 min-h-[44px] rounded-full dark:rounded-sm"
                    onClick={() => void reload()}
                  >
                    再読み込み
                  </button>
                </div>
              ) : (
                <div className="py-8">
                  <p className="text-base-content ruby-text">
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
                  <p className="text-base text-base-content ruby-text mb-4">
                    誰でも新しい会話を作成できます。
                  </p>
                  <Link
                    href="/discussions/create"
                    className="btn text-base btn-primary ruby-text gap-0 w-full rounded-full dark:rounded-sm"
                  >
                    新しい会話を作成
                  </Link>
                </div>
              </div>
            </section>
    </div>
  );
}
