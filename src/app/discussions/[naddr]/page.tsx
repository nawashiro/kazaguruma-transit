"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layouts/PageHeader";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { PostPreview } from "@/components/discussion/PostPreview";
import { EvaluationComponent } from "@/components/discussion/EvaluationComponent";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";
import { useDiscussionMeta } from "@/components/discussion/DiscussionTabLayout";
import { useDiscussionDetail } from "@/components/discussion/DiscussionDetailProvider";
import { useDiscussionContentData } from "@/components/discussion/DiscussionContentDataProvider";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  combinePostsWithStats,
  validatePostForm,
  formatRelativeTime,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import {
  evaluationService,
  EvaluationAnalysisResult,
} from "@/lib/evaluation/evaluation-service";
import Button from "@/components/ui/Button";
import type {
  PostEvaluation,
  PostFormData,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import { isTestMode } from "@/lib/test/test-data-loader";
import { buildLoginRoute } from "@/lib/navigation/auth-route";

const nostrServiceConfig = getNostrServiceConfig();
const nostrService = createNostrService(nostrServiceConfig);

export default function DiscussionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const naddrParam = params.naddr as string;

  const [consensusTab, setConsensusTab] = useState<string>("group-consensus");
  const [optimisticEvaluations, setOptimisticEvaluations] = useState<PostEvaluation[]>([]);
  const [optimisticUserEvaluationIds, setOptimisticUserEvaluationIds] = useState<Set<string>>(new Set());
  const [analysisResult, setAnalysisResult] =
    useState<EvaluationAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const renderInlineLoading = (label: string) => (
    <div
      className="flex items-center gap-2 text-base text-base-content ruby-text"
      role="status"
      aria-live="polite"
    >
      <div className="loading loading-spinner loading-sm" aria-hidden="true"></div>
      <span>{label}</span>
    </div>
  );

  const [showPreview, setShowPreview] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [postForm, setPostForm] = useState<PostFormData>({
    content: "",
    busStopTag: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [busStops, setBusStops] = useState<
    { route: string; stops: string[] }[]
  >([]);

  const { user, signEvent } = useAuth();
  const detail = useDiscussionDetail();
  const discussionMeta = useDiscussionMeta();
  const legacyContent = useDiscussionContentData();
  const legacyStateOverridesDetail = Boolean(
    (discussionMeta && (discussionMeta.isLoading || discussionMeta.discussion === null)) ||
      legacyContent.isLoading,
  );
  const isNewDetailModel = detail.isFallback !== true;
  const newDetailLoading =
    isNewDetailModel && detail.state === "loading" && detail.snapshot === null;
  const newDetailError =
    isNewDetailModel && detail.state === "error" && detail.snapshot === null;
  const hasDetailSnapshot = !legacyStateOverridesDetail && Boolean(detail.snapshot);
  const discussion = hasDetailSnapshot
    ? detail.snapshot?.discussion ?? null
    : discussionMeta?.discussion ?? null;
  const posts = useMemo(
    () => (hasDetailSnapshot ? detail.snapshot?.posts ?? [] : legacyContent.posts),
    [detail.snapshot?.posts, hasDetailSnapshot, legacyContent.posts],
  );
  const evaluations = useMemo(
    () => [
      ...(hasDetailSnapshot ? detail.snapshot?.evaluations ?? [] : []),
      ...optimisticEvaluations,
    ],
    [detail.snapshot?.evaluations, hasDetailSnapshot, optimisticEvaluations],
  );
  const userEvaluations = useMemo(() => {
    const viewerEvaluations = evaluations.filter(
      (evaluation) => evaluation.evaluatorPubkey === user.pubkey,
    );
    return new Set([
      ...(hasDetailSnapshot ? detail.snapshot?.userEvaluationIds ?? [] : []),
      ...viewerEvaluations.flatMap((evaluation) => [evaluation.id, evaluation.postId]),
      ...optimisticUserEvaluationIds,
    ]);
  }, [
    detail.snapshot?.userEvaluationIds,
    evaluations,
    hasDetailSnapshot,
    optimisticUserEvaluationIds,
    user.pubkey,
  ]);
  const isDiscussionLoading = newDetailLoading
    ? true
    : hasDetailSnapshot
      ? detail.state === "loading"
      : discussionMeta?.isLoading ?? false;
  const discussionCompletionReason = hasDetailSnapshot
    ? detail.completionReason ??
      (detail.state === "partial"
        ? "idle-timeout"
        : detail.state === "error"
          ? "hard-timeout"
          : detail.state === "ready"
            ? "eose"
            : null)
    : discussionMeta?.completionReason ?? null;
  const isPostsLoading = newDetailLoading
    ? true
    : newDetailError
      ? false
      : hasDetailSnapshot
        ? detail.state === "loading"
        : legacyContent.isLoading;
  const postsLoadError = newDetailError
    ? detail.error
    : hasDetailSnapshot
      ? detail.error
      : legacyContent.error;
  const contentCompletionReason = newDetailError
    ? detail.completionReason
    : hasDetailSnapshot
      ? detail.completionReason ??
        (detail.state === "partial"
          ? "idle-timeout"
          : detail.state === "error"
            ? "hard-timeout"
            : detail.state === "ready"
              ? "eose"
              : null)
      : legacyContent.completionReason;
  const reloadContent = newDetailLoading || newDetailError
    ? detail.reload
    : hasDetailSnapshot && legacyContent.completionReason == null
      ? detail.reload
      : legacyContent.reload;
  const addPost = hasDetailSnapshot ? detail.addPost : legacyContent.addPost;

  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);

  const loadBusStops = useCallback(async () => {
    try {
      const response = await fetch("/api/bus-stops");
      const result = await response.json();

      if (result.success) {
        setBusStops(result.data);
      } else {
        logger.error("Failed to load bus stops:", result.error);
        setBusStops([]);
      }
    } catch (error) {
      logger.error("Failed to load bus stops:", error);
      setBusStops([]);
    }
  }, []);

  useEffect(() => {
    logger.log("discussion", discussion);
  }, [discussion]);

  useEffect(() => {
    if (!isDiscussionsEnabled() || !discussionInfo) return;
    void loadBusStops();
  }, [discussionInfo, loadBusStops]);

  const approvedPosts = useMemo(
    () => posts.filter((post) => post.approved && post.approvalState !== "unknown"),
    [posts],
  );

  const runConsensusAnalysis = useCallback(async () => {
    if (evaluations.length < 5 || approvedPosts.length < 2) {
      logger.log("コンセンサス分析をスキップ", {
        evaluations: evaluations.length,
        approvedPosts: approvedPosts.length,
        minRequired: { evaluations: 5, approvedPosts: 2 },
      });
      setAnalysisResult(null);
      return;
    }

    logger.log("コンセンサス分析開始", {
      evaluations: evaluations.length,
      approvedPosts: approvedPosts.length,
    });

    setIsAnalyzing(true);
    try {
      const result = await evaluationService.analyzeConsensus(
        evaluations,
        approvedPosts
      );
      setAnalysisResult(result);
    } catch (error) {
      logger.error("コンセンサス分析に失敗しました:", error);
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [evaluations, approvedPosts]);

  useEffect(() => {
    if (isPostsLoading) return;
    void runConsensusAnalysis();
  }, [isPostsLoading, runConsensusAnalysis]);

  const postsWithStats = useMemo(
    () => combinePostsWithStats(approvedPosts, evaluations),
    [approvedPosts, evaluations]
  );

  // Check for invalid naddr
  if (!discussionInfo) {
    return (
      <div className="py-8">
        <div>
          <PageHeader
            title="無効な会話URL"
            description="指定された会話URLが無効です。"
          />
          <Link
            href="/discussions"
            className="btn text-base btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!isDiscussionsEnabled()) {
    return (
      <div className="py-8">
        <PageHeader
          title="会話"
          description="この機能は現在利用できません。"
        />
      </div>
    );
  }

  const handlePostSubmit = async () => {
    if (!user.isLoggedIn || !discussion) {
      if (!user.isLoggedIn) {
        router.push(
          buildLoginRoute(
            `/discussions/${naddrParam}`,
            "投稿するにはログインが必要です。",
          ),
        );
      }
      return;
    }

    if (isTestMode(discussionInfo.dTag)) {
      setErrors(["テストモードでは投稿できません"]);
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

      const newPost = {
        id: signedEvent.id,
        content: postForm.content.trim(),
        authorPubkey: user.pubkey || "",
        discussionId: discussion.id,
        busStopTag: postForm.busStopTag || undefined,
        createdAt: signedEvent.created_at,
        approved: false,
        approvedBy: [],
        approvedAt: undefined,
        event: signedEvent,
      };

      addPost(newPost);
    } catch (error) {
      logger.error("Failed to submit post:", error);
      setErrors(["投稿の送信に失敗しました"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvaluate = async (postId: string, rating: "+" | "-") => {
    if (!user.isLoggedIn || !discussion) {
      if (!user.isLoggedIn) {
        router.push(
          buildLoginRoute(
            `/discussions/${naddrParam}`,
            "投稿を評価するにはログインが必要です。",
          ),
        );
      }
      return;
    }

    if (isTestMode(discussionInfo.dTag)) {
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

      setOptimisticUserEvaluationIds((prev) => new Set([...prev, postId]));

      const newEvaluation: PostEvaluation = {
        id: signedEvent.id,
        postId,
        evaluatorPubkey: user.pubkey || "",
        rating,
        discussionId: discussion.id,
        createdAt: signedEvent.created_at,
        event: signedEvent,
      };

      setOptimisticEvaluations((prev) => [...prev, newEvaluation]);
    } catch (error) {
      logger.error("Failed to evaluate post:", error);
    }
  };

  const handleRouteSelect = (routeName: string) => {
    setSelectedRoute(routeName);
    setPostForm((prev) => ({ ...prev, busStopTag: "" }));
  };

  if (isDiscussionLoading) {
    return (
      <div className="py-8">
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">会話データを読み込み中...</span>
          <div className="animate-pulse space-y-4" aria-hidden="true">
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
      </div>
    );
  }

  if (!discussion) {
    if (newDetailError) {
      return (
        <div className="py-8">
          <div
            className="alert alert-error alert-soft text-base-content!"
            role="status"
            aria-live="polite"
          >
            <span>{detail.error ?? "会話データの取得に失敗しました。"}</span>
            <button
              type="button"
              className="btn text-base btn-outline min-h-[44px] rounded-full dark:rounded-sm"
              onClick={() => void detail.reload()}
            >
              <span className="ruby-text">再読み込み</span>
            </button>
          </div>
        </div>
      );
    }
    if (
      discussionCompletionReason === "idle-timeout" ||
      discussionCompletionReason === "hard-timeout" ||
      discussionCompletionReason === "cancelled"
    ) {
      return (
        <div className="py-8">
          <div
            className="alert alert-warning alert-soft text-base-content! mb-4"
            role="status"
            aria-live="polite"
          >
            <span>
              会話データの取得に時間がかかっています（{discussionCompletionReason}）。
              受信待機中または relay 応答遅延の可能性があります。
            </span>
          </div>
          <button
            type="button"
            className="btn text-base btn-outline rounded-full dark:rounded-sm"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>
      );
    }

    return (
      <div className="py-8">
        <div>
          <PageHeader title="会話が見つかりません" />
          <Link
            href="/discussions"
            className="btn text-base btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

    return (
      <div className="py-8">
      {/* タブナビゲーションはlayout.tsxに移動 */}

      <DiscussionReadStatus
        isLoading={isPostsLoading}
        completionReason={contentCompletionReason}
        hasData={posts.length > 0}
        onReload={() => void reloadContent()}
      />

      <div className="space-y-8">
          <div className="space-y-6">
            <section aria-labelledby="evaluation-heading">
              {isPostsLoading
                ? renderInlineLoading("評価データを読み込み中...")
                : postsLoadError ? (
                  <div
                    className="alert alert-error alert-soft text-base-content!"
                    role="status"
                    aria-live="polite"
                  >
                    <span>{postsLoadError}</span>
                    <button
                      type="button"
                      className="btn text-base btn-outline min-h-[44px] rounded-full dark:rounded-sm"
                      onClick={() => void reloadContent()}
                    >
                      <span className="ruby-text">再読み込み</span>
                    </button>
                  </div>
                ) : (
                  <EvaluationComponent
                    posts={postsWithStats}
                    onEvaluate={handleEvaluate}
                    userEvaluations={userEvaluations}
                    isRandomOrder={true}
                  />
                )}
            </section>

            <section aria-labelledby="opinion-groups-heading">
              <h2
                id="opinion-groups-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                意見グループ
              </h2>

              <p className="text-base-content mb-4 ruby-text">
                投票を統計処理して、意見はグループ分けされます。どのグループでも共通した意見が評価されます。
              </p>

              {isPostsLoading ? (
                renderInlineLoading("分析データを読み込み中...")
              ) : postsLoadError ? (
                <div
                  className="alert alert-error alert-soft text-base-content!"
                  role="status"
                  aria-live="polite"
                >
                  <span>{postsLoadError}</span>
                </div>
              ) : (
                <>
                  {isAnalyzing && (
                    <div className="flex items-center justify-center p-4 mb-4">
                      <div className="loading loading-spinner loading-md mr-2"></div>
                      <span className="text-base text-base-content">
                        コンセンサス分析中...
                      </span>
                    </div>
                  )}

                  {analysisResult && !isAnalyzing ? (
                    <>
                      <div
                        className="flex flex-row flex-wrap gap-2 mb-4"
                        role="tablist"
                        aria-label="意見タブ"
                      >
                        <button
                          className={`btn text-base border px-3 py-1 h-auto min-h-0 rounded-md font-medium ruby-text ${
                            consensusTab === "group-consensus"
                              ? "btn-primary border-primary text-primary-content"
                              : "btn-outline hover:border-primary/50 hover:bg-primary/5"
                          }`}
                          onClick={() => setConsensusTab("group-consensus")}
                          role="tab"
                          aria-selected={consensusTab === "group-consensus"}
                          aria-label="共通の意見タブ"
                        >
                          <span>共通の意見</span>
                        </button>
                        {analysisResult.groupRepresentativeComments.map(
                          (group, index) => (
                            <button
                              key={group.groupId}
                              className={`btn text-base border px-3 py-1 h-auto min-h-0 rounded-md font-medium ${
                                consensusTab ===
                                `group-${String.fromCharCode(97 + index)}`
                                  ? "btn-primary border-primary text-primary-content"
                                  : "btn-outline hover:border-primary/50 hover:bg-primary/5"
                              }`}
                              onClick={() =>
                                setConsensusTab(
                                  `group-${String.fromCharCode(97 + index)}`
                                )
                              }
                              role="tab"
                              aria-selected={
                                consensusTab ===
                                `group-${String.fromCharCode(97 + index)}`
                              }
                              aria-label={`グループ ${String.fromCharCode(
                                65 + index
                              )}タブ`}
                            >
                              <span>
                                グループ {String.fromCharCode(65 + index)}
                              </span>
                            </button>
                          )
                        )}
                      </div>

                      {consensusTab === "group-consensus" ? (
                        <div className="space-y-4">
                          {analysisResult.groupAwareConsensus.length > 0 ? (
                            analysisResult.groupAwareConsensus
                              .slice(0, 5)
                              .map((item) => (
                                <div
                                  key={item.postId}
                                  className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 break-all"
                                >
                                  <div className="card-body p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <span className="badge badge-primary">
                                        {item.overallAgreePercentage}%の人が賛成
                                      </span>
                                    </div>
                                    {item.post?.busStopTag && (
                                      <div className="mb-2">
                                        <span className="badge badge-outline">
                                          {item.post.busStopTag}
                                        </span>
                                      </div>
                                    )}
                                    <div className="prose prose-sm dark:prose-invert max-w-none ruby-text">
                                      {item.post?.content ? (
                                        item.post.content
                                          .split("\n")
                                          .map((line, i) => (
                                            <p key={i} className="mb-1 last:mb-0">
                                              {line || "\u00A0"}
                                            </p>
                                          ))
                                      ) : (
                                        <p className="text-base-content">
                                          コンテンツがありません
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-base-content mt-2">
                                      {formatRelativeTime(
                                        item.post?.createdAt || 0
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <p className="text-base-content ruby-text">
                              コンセンサス意見がありません。
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {(() => {
                            const groupIndex =
                              consensusTab.charCodeAt(consensusTab.length - 1) - 97;
                            const group =
                              analysisResult.groupRepresentativeComments[
                                groupIndex
                              ];
                            return group?.comments.length > 0 ? (
                              group.comments.map((item) => (
                                <div
                                  key={item.postId}
                                  className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 break-all"
                                >
                                  <div className="card-body p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex gap-2">
                                        {item.voteType == "agree" ? (
                                          <span className="badge badge-primary">
                                            {String.fromCharCode(65 + groupIndex)}
                                            のうち
                                            {Math.round(item.agreeRatio * 100)}
                                            %が賛成
                                          </span>
                                        ) : (
                                          <span className="badge badge-warning">
                                            {String.fromCharCode(65 + groupIndex)}
                                            のうち
                                            {Math.round(item.disagreeRatio * 100)}
                                            %が反対
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {item.post?.busStopTag && (
                                      <div className="mb-2">
                                        <span className="badge badge-outline">
                                          {item.post.busStopTag}
                                        </span>
                                      </div>
                                    )}
                                    <div className="prose prose-sm dark:prose-invert max-w-none ruby-text">
                                      {item.post?.content ? (
                                        item.post.content
                                          .split("\n")
                                          .map((line, i) => (
                                            <p key={i} className="mb-1 last:mb-0">
                                              {line || "\u00A0"}
                                            </p>
                                          ))
                                      ) : (
                                        <p className="text-base-content">
                                          コンテンツがありません
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-base-content mt-2">
                                      {formatRelativeTime(
                                        item.post?.createdAt || 0
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-base-content ruby-text">
                                このグループの代表的意見がありません。
                              </p>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-base-content">
                      分析された投稿がまだありません。
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          <section aria-labelledby="new-post-heading">
              <h2
                id="new-post-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                新しい投稿
              </h2>

              <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="card-body">
                  {!showPreview ? (
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="post-content"
                          className="label ruby-text"
                        >
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
                          className="textarea w-full h-32"
                          placeholder="あなたの体験や意見を投稿してください"
                          required
                          disabled={isSubmitting}
                          maxLength={280}
                          autoComplete="off"
                        />
                        <div className="text-base-content mt-1">
                          {postForm.content.length}/280文字
                        </div>
                      </div>

                      <div>
                        <label className="label ruby-text">
                          <span className="label-text">バス停タグ（任意）</span>
                        </label>

                        <div className="space-y-2">
                          <select
                            value={selectedRoute}
                            onChange={(e) => handleRouteSelect(e.target.value)}
                            className="select w-full"
                            disabled={isSubmitting}
                            autoComplete="off"
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
                              className="select w-full"
                              disabled={isSubmitting}
                              autoComplete="off"
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
                        <div
                          className="alert alert-error alert-soft text-base-content!"
                          role="alert"
                          aria-live="assertive"
                        >
                          <ul className="text-base">
                            {errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button
                        onClick={() => setShowPreview(true)}
                        fullWidth
                        disabled={!postForm.content.trim()}
                      >
                        <span>プレビュー</span>
                      </Button>
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
          </section>
        </div>

    </div>
  );
}
