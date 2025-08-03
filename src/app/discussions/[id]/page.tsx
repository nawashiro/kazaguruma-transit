"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { LoginModal } from "@/components/discussion/LoginModal";
import { PostPreview } from "@/components/discussion/PostPreview";
import { EvaluationComponent } from "@/components/discussion/EvaluationComponent";
import { AuditTimeline } from "@/components/discussion/AuditTimeline";
import { ModeratorCheck } from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  parseEvaluationEvent,
  combinePostsWithStats,
  sortPostsByScore,
  createAuditTimeline,
  validatePostForm,
  formatRelativeTime,
} from "@/lib/nostr/nostr-utils";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  PostFormData,
} from "@/types/discussion";

const ADMIN_PUBKEY = process.env.NEXT_PUBLIC_ADMIN_PUBKEY || "";
const RELAYS = [
  { url: "wss://relay.damus.io", read: true, write: true },
  { url: "wss://relay.nostr.band", read: true, write: true },
  { url: "wss://nos.lol", read: true, write: true },
];

const nostrService = createNostrService({
  relays: RELAYS,
  defaultTimeout: 5000,
});

const busStops = [
  {
    route: "A線",
    stops: ["千代田区役所", "東日本銀行神田支店", "千代田保健所"],
  },
  { route: "B線", stops: ["大手町", "神保町", "九段下"] },
  { route: "C線", stops: ["秋葉原", "湯島", "上野"] },
];

export default function DiscussionDetailPage() {
  const params = useParams();
  const discussionId = params.id as string;

  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [evaluations, setEvaluations] = useState<PostEvaluation[]>([]);
  const [userEvaluations, setUserEvaluations] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [postForm, setPostForm] = useState<PostFormData>({
    content: "",
    busStopTag: "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  const { user, signEvent } = useAuth();

  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled()) return;
    setIsLoading(true);
    try {
      const [
        discussionEvents,
        postsEvents,
        approvalsEvents,
        evaluationsEvents,
      ] = await Promise.all([
        nostrService.getDiscussions(ADMIN_PUBKEY),
        nostrService.getDiscussionPosts(
          `34550:${ADMIN_PUBKEY}:${discussionId}`
        ),
        nostrService.getApprovals(`34550:${ADMIN_PUBKEY}:${discussionId}`),
        nostrService.getEvaluations(
          user.pubkey || "",
          `34550:${ADMIN_PUBKEY}:${discussionId}`
        ),
      ]);

      const parsedDiscussion = discussionEvents
        .map(parseDiscussionEvent)
        .find((d) => d && d.dTag === discussionId);

      if (!parsedDiscussion) {
        throw new Error("Discussion not found");
      }

      const parsedApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const parsedPosts = postsEvents
        .map((event) => parsePostEvent(event, parsedApprovals))
        .filter((p): p is DiscussionPost => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      const parsedEvaluations = evaluationsEvents
        .map(parseEvaluationEvent)
        .filter((e): e is PostEvaluation => e !== null);

      setDiscussion(parsedDiscussion);
      setPosts(parsedPosts);
      setApprovals(parsedApprovals);
      setEvaluations(parsedEvaluations);
    } catch (error) {
      console.error("Failed to load discussion:", error);
    } finally {
      setIsLoading(false);
    }
  }, [discussionId, user.pubkey]);

  const loadUserEvaluations = useCallback(async () => {
    if (!user.pubkey || !isDiscussionsEnabled()) return;

    try {
      const userEvals = await nostrService.getEvaluations(user.pubkey);
      const evalPostIds = new Set(
        userEvals
          .map((e) => e.tags.find((t) => t[0] === "e")?.[1])
          .filter((id): id is string => Boolean(id))
      );
      setUserEvaluations(evalPostIds);
    } catch (error) {
      console.error("Failed to load user evaluations:", error);
    }
  }, [user.pubkey]);

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }
  }, [loadData]);

  useEffect(() => {
    if (user.pubkey && isDiscussionsEnabled()) {
      loadUserEvaluations();
    }
  }, [user.pubkey, loadUserEvaluations]);

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">ディスカッション</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const handlePostSubmit = async () => {
    if (!user.isLoggedIn || !discussion) {
      setShowLoginModal(true);
      return;
    }

    const validationErrors = validatePostForm(postForm);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      const eventTemplate = nostrService.createPostEvent(
        postForm.content.trim(),
        discussion.id,
        postForm.busStopTag || undefined
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish post to relays");
      }

      setPostForm({ content: "", busStopTag: "" });
      setSelectedRoute("");
      setShowPreview(false);
      await loadData();
    } catch (error) {
      console.error("Failed to submit post:", error);
      setErrors(["投稿の送信に失敗しました"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvaluate = async (postId: string, rating: "+" | "-") => {
    if (!user.isLoggedIn || !discussion) {
      setShowLoginModal(true);
      return;
    }

    try {
      const eventTemplate = nostrService.createEvaluationEvent(
        postId,
        rating,
        discussion.id
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish evaluation to relays");
      }

      setUserEvaluations((prev) => new Set([...prev, postId]));
      await loadData();
    } catch (error) {
      console.error("Failed to evaluate post:", error);
    }
  };

  const handleRouteSelect = (routeName: string) => {
    setSelectedRoute(routeName);
    setPostForm((prev) => ({ ...prev, busStopTag: "" }));
  };

  const approvedPosts = posts.filter((p) => p.approved);
  const postsWithStats = combinePostsWithStats(approvedPosts, evaluations);
  const topPosts = sortPostsByScore(postsWithStats).slice(0, 10);
  const auditItems = createAuditTimeline(
    discussion ? [discussion] : [],
    [],
    posts,
    approvals
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            ディスカッションが見つかりません
          </h1>
          <Link href="/discussions" className="btn btn-primary">
            ディスカッション一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/discussions" className="btn btn-ghost btn-sm">
            ← ディスカッション一覧
          </Link>
          <ModeratorCheck
            moderators={discussion.moderators.map((m) => m.pubkey)}
            adminPubkey={ADMIN_PUBKEY}
            userPubkey={user.pubkey}
          >
            <Link
              href={`/discussions/${discussionId}/approve`}
              className="btn btn-outline btn-sm"
            >
              投稿承認管理
            </Link>
          </ModeratorCheck>
        </div>
        <h1 className="text-3xl font-bold mb-2">{discussion.title}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {discussion.description}
        </p>
      </div>

      <div className="tabs tabs-lifted mb-6">
        <button
          className={`tab ${activeTab === "main" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("main")}
        >
          ディスカッション
        </button>
        <button
          className={`tab ${activeTab === "audit" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          監査画面
        </button>
      </div>

      {activeTab === "main" ? (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">高評価投稿</h2>
              {topPosts.length > 0 ? (
                <div className="space-y-4">
                  {topPosts.map((post, index) => (
                    <div
                      key={post.id}
                      className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <div className="card-body p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="badge badge-primary badge-sm">
                            #{index + 1}
                          </span>
                        </div>
                        {post.busStopTag && (
                          <div className="mb-2">
                            <span className="badge badge-outline badge-sm">
                              {post.busStopTag}
                            </span>
                          </div>
                        )}
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {post.content.split("\n").map((line, i) => (
                            <p key={i} className="mb-1 last:mb-0">
                              {line || "\u00A0"}
                            </p>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {formatRelativeTime(post.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  承認された投稿がまだありません。
                </p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">投稿を評価</h2>
              <EvaluationComponent
                posts={postsWithStats}
                onEvaluate={handleEvaluate}
                userEvaluations={userEvaluations}
                isRandomOrder={true}
                maxDisplayCount={5}
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">新しい投稿</h2>

            <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="card-body">
                {!showPreview ? (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="post-content" className="label">
                        <span className="label-text">投稿内容 *</span>
                      </label>
                      <textarea
                        id="post-content"
                        value={postForm.content}
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            content: e.target.value,
                          }))
                        }
                        className="textarea textarea-bordered w-full h-32"
                        placeholder="あなたの体験や意見を投稿してください"
                        required
                        disabled={isSubmitting}
                        maxLength={280}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {postForm.content.length}/280文字
                      </div>
                    </div>

                    <div>
                      <label className="label">
                        <span className="label-text">バス停タグ（任意）</span>
                      </label>

                      <div className="space-y-2">
                        <select
                          value={selectedRoute}
                          onChange={(e) => handleRouteSelect(e.target.value)}
                          className="select select-bordered w-full"
                          disabled={isSubmitting}
                        >
                          <option value="">ルートを選択してください</option>
                          {busStops.map((route) => (
                            <option key={route.route} value={route.route}>
                              {route.route}
                            </option>
                          ))}
                        </select>

                        {selectedRoute && (
                          <select
                            value={postForm.busStopTag}
                            onChange={(e) =>
                              setPostForm((prev) => ({
                                ...prev,
                                busStopTag: e.target.value,
                              }))
                            }
                            className="select select-bordered w-full"
                            disabled={isSubmitting}
                          >
                            <option value="">バス停を選択してください</option>
                            {busStops
                              .find((route) => route.route === selectedRoute)
                              ?.stops.map((stop) => (
                                <option key={stop} value={stop}>
                                  {stop}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {errors.length > 0 && (
                      <div className="alert alert-error">
                        <ul className="text-sm">
                          {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => setShowPreview(true)}
                      className="btn btn-primary w-full"
                      disabled={!postForm.content.trim()}
                    >
                      プレビュー
                    </button>
                  </div>
                ) : (
                  <PostPreview
                    content={postForm.content}
                    busStopTag={postForm.busStopTag}
                    onConfirm={handlePostSubmit}
                    onCancel={() => setShowPreview(false)}
                    isLoading={isSubmitting}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">監査画面</h2>
          <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="card-body">
              <AuditTimeline items={auditItems} />
            </div>
          </div>
        </div>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
