"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
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
  createAuditTimeline,
  validatePostForm,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import {
  extractDiscussionFromNaddr,
} from "@/lib/nostr/naddr-utils";
import {
  evaluationService,
  EvaluationAnalysisResult,
} from "@/lib/evaluation/evaluation-service";
import Button from "@/components/ui/Button";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  PostFormData,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import { loadTestData, isTestMode } from "@/lib/test/test-data-loader";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionDetailPage() {
  const params = useParams();
  const naddrParam = params.naddr as string;

  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [consensusTab, setConsensusTab] = useState<string>("group-consensus");
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [approvals, setApprovals] = useState<PostApproval[]>([]);
  const [evaluations, setEvaluations] = useState<PostEvaluation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
    {}
  );
  const [userEvaluations, setUserEvaluations] = useState<Set<string>>(
    new Set()
  );
  const [analysisResult, setAnalysisResult] =
    useState<EvaluationAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
  const [busStops, setBusStops] = useState<
    { route: string; stops: string[] }[]
  >([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const { user, signEvent } = useAuth();

  // Parse naddr and extract discussion info
  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);

  // Rubyfulライブラリ対応
  useRubyfulRun(
    [discussion, posts, approvals, evaluations, consensusTab],
    isLoaded
  );

  const loadData = useCallback(async () => {
    if (!isDiscussionsEnabled() || !discussionInfo) return;
    setIsLoading(true);
    try {
      // Check if this is test mode (for backward compatibility)
      if (isTestMode(discussionInfo.dTag)) {
        const testData = await loadTestData();
        setDiscussion(testData.discussion);
        setPosts(testData.posts);
        setApprovals([]);
        setEvaluations(testData.evaluations);
        setProfiles({});
        return;
      }

      const [discussionEvents, postsEvents, approvalsEvents] =
        await Promise.all([
          nostrService.getDiscussions(discussionInfo.authorPubkey),
          nostrService.getDiscussionPosts(discussionInfo.discussionId),
          nostrService.getApprovals(discussionInfo.discussionId),
        ]);

      const parsedDiscussion = discussionEvents
        .map(parseDiscussionEvent)
        .find((d) => d && d.dTag === discussionInfo.dTag);

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

      const postIds = parsedPosts.map((post) => post.id);
      const evaluationsEvents = await nostrService.getEvaluationsForPosts(
        postIds,
        discussionInfo.discussionId
      );

      const parsedEvaluations = evaluationsEvents
        .map(parseEvaluationEvent)
        .filter((e): e is PostEvaluation => e !== null);

      setDiscussion(parsedDiscussion);
      setPosts(parsedPosts);
      setApprovals(parsedApprovals);
      setEvaluations(parsedEvaluations);

      // Profile loading logic - only load profiles if user is moderator
      const shouldLoadProfiles = user.pubkey && (
        user.pubkey === ADMIN_PUBKEY || 
        parsedDiscussion?.moderators.some(m => m.pubkey === user.pubkey)
      );

      if (shouldLoadProfiles) {
        const uniquePubkeys = new Set<string>();
        parsedApprovals.forEach((approval) =>
          uniquePubkeys.add(approval.moderatorPubkey)
        );
        if (parsedDiscussion) {
          uniquePubkeys.add(parsedDiscussion.authorPubkey);
          parsedDiscussion.moderators.forEach((mod) =>
            uniquePubkeys.add(mod.pubkey)
          );
        }

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
    } catch (error) {
      logger.error("Failed to load discussion:", error);
    } finally {
      setIsLoading(false);
    }
  }, [discussionInfo, user.pubkey]);

  const loadUserEvaluations = useCallback(async () => {
    if (!user.pubkey || !isDiscussionsEnabled() || !discussionInfo) return;

    if (isTestMode(discussionInfo.dTag)) {
      setUserEvaluations(new Set());
      return;
    }

    try {
      const userEvals = await nostrService.getEvaluations(user.pubkey);
      const evalPostIds = new Set(
        userEvals
          .map((e) => e.tags.find((t) => t[0] === "e")?.[1])
          .filter((id): id is string => Boolean(id))
      );
      setUserEvaluations(evalPostIds);
    } catch (error) {
      logger.error("Failed to load user evaluations:", error);
    }
  }, [user.pubkey, discussionInfo]);

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
    if (isDiscussionsEnabled() && discussionInfo) {
      loadData();
      loadBusStops();
    }
    setIsLoaded(true);
  }, [loadData, loadBusStops, discussionInfo]);

  useEffect(() => {
    if (user.pubkey && isDiscussionsEnabled()) {
      loadUserEvaluations();
    }
  }, [user.pubkey, loadUserEvaluations]);

  const approvedPosts = useMemo(() => posts.filter((p) => p.approved), [posts]);

  const runConsensusAnalysis = useCallback(async () => {
    if (evaluations.length < 5 || approvedPosts.length < 2) {
      setAnalysisResult(null);
      return;
    }

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
    if (evaluations.length > 0 && approvedPosts.length > 0) {
      runConsensusAnalysis();
    }
  }, [runConsensusAnalysis, evaluations.length, approvedPosts.length]);

  const postsWithStats = useMemo(
    () => combinePostsWithStats(approvedPosts, evaluations),
    [approvedPosts, evaluations]
  );
  const auditItems = useMemo(
    () =>
      createAuditTimeline(discussion ? [discussion] : [], [], posts, approvals),
    [discussion, posts, approvals]
  );

  // Check for invalid naddr
  if (!discussionInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">無効な会話URL</h1>
          <p className="text-gray-600 mb-4">指定された会話URLが無効です。</p>
          <Link href="/discussions" className="btn btn-primary">
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話</h1>
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

      setPosts((prev) => [newPost, ...prev]);
    } catch (error) {
      logger.error("Failed to submit post:", error);
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

      setUserEvaluations((prev) => new Set([...prev, postId]));

      const newEvaluation = {
        id: signedEvent.id,
        postId,
        evaluatorPubkey: user.pubkey || "",
        rating,
        discussionId: discussion.id,
        createdAt: signedEvent.created_at,
        event: signedEvent,
      };

      setEvaluations((prev) => [...prev, newEvaluation]);
    } catch (error) {
      logger.error("Failed to evaluate post:", error);
    }
  };

  const handleRouteSelect = (routeName: string) => {
    setSelectedRoute(routeName);
    setPostForm((prev) => ({ ...prev, busStopTag: "" }));
  };

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
          <h1 className="text-2xl font-bold mb-4">会話が見つかりません</h1>
          <Link href="/discussions" className="btn btn-primary">
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 ruby-text">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/discussions"
            className="btn btn-ghost btn-sm rounded-full dark:rounded-sm"
          >
            <span>← 会話一覧に戻る</span>
          </Link>
          {user.pubkey === discussion.authorPubkey && (
            <Link
              href={`/discussions/${naddrParam}/edit`}
              className="btn btn-outline btn-sm rounded-full dark:rounded-sm min-h-8 h-fit"
            >
              <span>会話を編集</span>
            </Link>
          )}
          <ModeratorCheck
            moderators={discussion.moderators.map((m) => m.pubkey)}
            adminPubkey={ADMIN_PUBKEY}
            userPubkey={user.pubkey}
          >
            <Link
              href={`/discussions/${naddrParam}/approve`}
              className="btn btn-outline btn-sm rounded-full dark:rounded-sm min-h-8 h-fit"
            >
              <span>投稿承認管理</span>
            </Link>
          </ModeratorCheck>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold">{discussion.title}</h1>
          {discussion.moderators.some(m => m.pubkey === discussion.authorPubkey) ? (
            <span className="badge badge-secondary">モデレーター</span>
          ) : (
            <span className="badge badge-outline">作成者</span>
          )}
        </div>
        {discussion.description.split("\n").map((line, idx) => (
          <p key={idx} className="text-gray-600 dark:text-gray-400">
            {line}
          </p>
        ))}
      </div>

      <nav role="tablist" aria-label="会話メニュー" className="join mb-6">
        <button
          className={`join-item btn ruby-text ${
            activeTab === "main" && "btn-active btn-primary"
          }`}
          name="tab-options"
          aria-label="会話タブを開く"
          role="tab"
          area-selected={activeTab === "main" ? "true" : "false"}
          onClick={() => setActiveTab("main")}
        >
          <span>会話</span>
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
        <main
          role="tabpanel"
          aria-labelledby="main-tab"
          className="grid lg:grid-cols-2 gap-8"
        >
          <div className="space-y-6">
            <section aria-labelledby="evaluation-heading">
              <h2
                id="evaluation-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                投稿を評価
              </h2>
              <EvaluationComponent
                posts={postsWithStats}
                onEvaluate={handleEvaluate}
                userEvaluations={userEvaluations}
                isRandomOrder={true}
              />
            </section>

            <section aria-labelledby="opinion-groups-heading">
              <h2
                id="opinion-groups-heading"
                className="text-xl font-semibold mb-4 ruby-text"
              >
                意見グループ
              </h2>

              <p className="text-gray-600 dark:text-gray-400 mb-4 ruby-text">
                投票を統計処理して、意見はグループ分けされます。どのグループでも共通した意見が評価されます。
              </p>

              {isAnalyzing && (
                <div className="flex items-center justify-center p-4 mb-4">
                  <div className="loading loading-spinner loading-md mr-2"></div>
                  <span className="text-sm text-gray-600">
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
                      className={`btn border px-3 py-1 h-auto min-h-0 rounded-md font-medium ruby-text ${
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
                          className={`btn border px-3 py-1 h-auto min-h-0 rounded-md font-medium ${
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
                              className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                            >
                              <div className="card-body p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <span className="badge badge-sm badge-primary">
                                    {item.overallAgreePercentage}%の人が賛成
                                  </span>
                                </div>
                                {item.post?.busStopTag && (
                                  <div className="mb-2">
                                    <span className="badge badge-outline badge-sm">
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
                                    <p className="text-gray-500">
                                      コンテンツがありません
                                    </p>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  {formatRelativeTime(
                                    item.post?.createdAt || 0
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400 ruby-text">
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
                              className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                            >
                              <div className="card-body p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex gap-2">
                                    {item.voteType == "agree" ? (
                                      <span className="badge badge-sm badge-primary">
                                        {String.fromCharCode(65 + groupIndex)}
                                        のうち
                                        {Math.round(item.agreeRatio * 100)}
                                        %が賛成
                                      </span>
                                    ) : (
                                      <span className="badge badge-sm badge-warning">
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
                                    <span className="badge badge-outline badge-sm">
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
                                    <p className="text-gray-500">
                                      コンテンツがありません
                                    </p>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  {formatRelativeTime(
                                    item.post?.createdAt || 0
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-600 dark:text-gray-400 ruby-text">
                            このグループの代表的意見がありません。
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  分析された投稿がまだありません。
                </p>
              )}
            </section>
          </div>

          <aside>
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
                          className="textarea textarea-bordered w-full h-32"
                          placeholder="あなたの体験や意見を投稿してください"
                          required
                          disabled={isSubmitting}
                          maxLength={280}
                          autoComplete="off"
                        />
                        <div className="text-xs text-gray-500 mt-1">
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
                            className="select select-bordered w-full"
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
                              className="select select-bordered w-full"
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
                        <div className="alert alert-error">
                          <ul className="text-sm">
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
          </aside>
        </main>
      ) : (
        <main role="tabpanel" aria-labelledby="audit-tab">
          <section aria-labelledby="audit-screen-heading">
            <h2
              id="audit-screen-heading"
              className="text-xl font-semibold mb-4 ruby-text"
            >
              監査画面
            </h2>
            <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="card-body">
                <AuditTimeline 
                  items={auditItems} 
                  profiles={profiles}
                  adminPubkey={ADMIN_PUBKEY}
                  moderators={discussion.moderators.map(m => m.pubkey)}
                  viewerPubkey={user.pubkey}
                  discussionAuthorPubkey={discussion.authorPubkey}
                  shouldLoadProfiles={user.pubkey === ADMIN_PUBKEY || discussion.moderators.some(m => m.pubkey === user.pubkey)}
                />
              </div>
            </div>
          </section>
        </main>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}