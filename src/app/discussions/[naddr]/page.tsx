"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { AuditLogSection } from "@/components/discussion/AuditLogSection";
import { ModeratorCheck } from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parsePostEvent,
  parseApprovalEvent,
  parseEvaluationEvent,
  combinePostsWithStats,
  validatePostForm,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import {
  evaluationService,
  EvaluationAnalysisResult,
} from "@/lib/evaluation/evaluation-service";
import Button from "@/components/ui/Button";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  PostFormData,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import { loadTestData, isTestMode } from "@/lib/test/test-data-loader";
import type { Event } from "nostr-tools";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionDetailPage() {
  const params = useParams();
  const naddrParam = params.naddr as string;

  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [consensusTab, setConsensusTab] = useState<string>("group-consensus");
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [, setApprovals] = useState<PostApproval[]>([]);
  const [evaluations, setEvaluations] = useState<PostEvaluation[]>([]);
  const [userEvaluations, setUserEvaluations] = useState<Set<string>>(
    new Set()
  );
  const [analysisResult, setAnalysisResult] =
    useState<EvaluationAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const renderInlineLoading = (label: string) => (
    <div
      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ruby-text"
      role="status"
      aria-live="polite"
    >
      <div className="loading loading-spinner loading-sm" aria-hidden="true"></div>
      <span>{label}</span>
    </div>
  );

  // AuditLogSectionコンポーネントの参照
  const auditLogSectionRef = React.useRef<{ loadAuditData: () => void }>(null);
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
  const discussionStreamCleanupRef = useRef<(() => void) | null>(null);
  const loadSequenceRef = useRef(0);
  const analysisRunRef = useRef(false);

  useEffect(() => {
    logger.log("discussion", discussion);
  });

  const { user, signEvent } = useAuth();

  // Parse naddr and extract discussion info
  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);

  // メイン画面専用のデータ取得
  const loadApprovalsAndEvaluations = useCallback(
    async (loadSequence: number) => {
      if (!discussionInfo) return;
      setIsPostsLoading(true);
      try {
        const approvalsEvents = await nostrService.getApprovalsOnEose(
          discussionInfo.discussionId
        );
        if (loadSequenceRef.current !== loadSequence) return;

        const parsedApprovals = approvalsEvents
          .map(parseApprovalEvent)
          .filter((a): a is PostApproval => a !== null);

        // 承認イベントから投稿データを復元
        const parsedPosts = parsedApprovals
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

        setPosts(parsedPosts);
        setApprovals(parsedApprovals);

        const postIds = parsedPosts.map((post) => post.id);
        const evaluationsEvents = await nostrService.getEvaluationsForPosts(
          postIds
        );
        if (loadSequenceRef.current !== loadSequence) return;

        const parsedEvaluations = evaluationsEvents
          .map(parseEvaluationEvent)
          .filter((e): e is PostEvaluation => e !== null);

        setEvaluations(parsedEvaluations);
      } catch (error) {
        logger.error("Failed to load discussion:", error);
      } finally {
        if (loadSequenceRef.current === loadSequence) {
          setIsPostsLoading(false);
        }
      }
    },
    [discussionInfo]
  );


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
    if (!isDiscussionsEnabled() || !discussionInfo) return;
    const loadSequence = ++loadSequenceRef.current;
    analysisRunRef.current = false;
    setDiscussion(null);
    setPosts([]);
    setApprovals([]);
    setEvaluations([]);
    setAnalysisResult(null);
    setIsDiscussionLoading(true);
    setIsPostsLoading(true);

    discussionStreamCleanupRef.current?.();
    discussionStreamCleanupRef.current = null;

    if (isTestMode(discussionInfo.dTag)) {
      loadTestData()
        .then((testData) => {
          if (loadSequenceRef.current !== loadSequence) return;
          setDiscussion(testData.discussion);
          setPosts(testData.posts);
          setEvaluations(testData.evaluations);
        })
        .catch((error) => {
          logger.error("Failed to load discussion:", error);
        })
        .finally(() => {
          if (loadSequenceRef.current === loadSequence) {
            setIsDiscussionLoading(false);
            setIsPostsLoading(false);
          }
        });
      loadBusStops();
      return;
    }

    const pickLatestDiscussion = (events: Event[]) => {
      const parsed = events
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null);

      if (parsed.length === 0) {
        return null;
      }

      return parsed.reduce((latest, current) =>
        current.createdAt > latest.createdAt ? current : latest
      );
    };

    discussionStreamCleanupRef.current = nostrService.streamDiscussionMeta(
      discussionInfo.authorPubkey,
      discussionInfo.dTag,
      {
        onEvent: (events) => {
          if (loadSequenceRef.current !== loadSequence) return;
          const latest = pickLatestDiscussion(events);
          if (!latest) return;
          setDiscussion(latest);
          setIsDiscussionLoading(false);
        },
        onEose: (events) => {
          if (loadSequenceRef.current !== loadSequence) return;
          const latest = pickLatestDiscussion(events);
          if (latest) {
            setDiscussion(latest);
          }
          setIsDiscussionLoading(false);
        },
      }
    );

    loadApprovalsAndEvaluations(loadSequence);
    loadBusStops();

    return () => {
      discussionStreamCleanupRef.current?.();
      discussionStreamCleanupRef.current = null;
    };
  }, [discussionInfo, loadApprovalsAndEvaluations, loadBusStops]);

  useEffect(() => {
    if (user.pubkey && isDiscussionsEnabled()) {
      loadUserEvaluations();
    }
  }, [user.pubkey, loadUserEvaluations]);

  useEffect(() => {
    if (activeTab === "audit") {
      auditLogSectionRef.current?.loadAuditData();
    }
  }, [activeTab]);

  const approvedPosts = useMemo(() => posts.filter((p) => p.approved), [posts]);

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
    if (isPostsLoading || analysisRunRef.current) return;
    analysisRunRef.current = true;
    runConsensusAnalysis();
  }, [isPostsLoading, runConsensusAnalysis]);

  const postsWithStats = useMemo(
    () => combinePostsWithStats(approvedPosts, evaluations),
    [approvedPosts, evaluations]
  );

  // Check for invalid naddr
  if (!discussionInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">無効な会話URL</h1>
          <p className="text-gray-600 mb-4">指定された会話URLが無効です。</p>
          <Link
            href="/discussions"
            className="btn btn-primary rounded-full dark:rounded-sm"
          >
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

  if (isDiscussionLoading) {
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
          <Link
            href="/discussions"
            className="btn btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/discussions"
          className="btn btn-ghost btn-sm rounded-full dark:rounded-sm"
        >
          <span className="ruby-text">← 会話一覧に戻る</span>
        </Link>

        <h1 className="text-3xl font-bold mb-4 ruby-text">
          {discussion.title}
        </h1>

        {/* Only show aside if user is creator or moderator */}
        {(user.pubkey === discussion.authorPubkey ||
          discussion.moderators.some((m) => m.pubkey === user.pubkey)) && (
          <aside className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
            <p className="mb-4">
              あなたは
              {/* Priority: Creator > Moderator. Show creator if user is the author, otherwise show moderator */}
              {user.pubkey === discussion.authorPubkey ? (
                <span className="ruby-text">作成者</span>
              ) : (
                <span className="ruby-text">モデレーター</span>
              )}
              です。
            </p>

            <div className="flex items-center gap-4">
              {user.pubkey === discussion.authorPubkey && (
                <Link
                  href={`/discussions/${naddrParam}/edit`}
                  className="btn btn-primary rounded-full dark:rounded-sm min-h-8 h-fit"
                >
                  <span className="ruby-text">会話を編集</span>
                </Link>
              )}
              <ModeratorCheck
                moderators={discussion.moderators.map((m) => m.pubkey)}
                adminPubkey={ADMIN_PUBKEY}
                userPubkey={user.pubkey}
              >
                <Link
                  href={`/discussions/${naddrParam}/approve`}
                  className="btn btn-primary rounded-full dark:rounded-sm min-h-8 h-fit"
                >
                  <span className="ruby-text">投稿承認管理</span>
                </Link>
              </ModeratorCheck>
            </div>
          </aside>
        )}

        {discussion.description.split("\n").map((line, idx) => (
          <p key={idx} className="text-gray-600 dark:text-gray-400 ruby-text">
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
          aria-selected={activeTab === "main" ? "true" : "false"}
          onClick={() => setActiveTab("main")}
        >
          <span className="ruby-text">会話</span>
        </button>
        <button
          className={`join-item btn ruby-text ${
            activeTab === "audit" && "btn-active btn-primary"
          }`}
          name="tab-options"
          aria-label="監査ログを開く"
          role="tab"
          aria-selected={activeTab === "audit" ? "true" : "false"}
          onClick={() => {
            setActiveTab("audit");
          }}
        >
          <span className="ruby-text">監査ログ</span>
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
              {isPostsLoading
                ? renderInlineLoading("評価データを読み込み中...")
                : (
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

              <p className="text-gray-600 dark:text-gray-400 mb-4 ruby-text">
                投票を統計処理して、意見はグループ分けされます。どのグループでも共通した意見が評価されます。
              </p>

              {isPostsLoading ? (
                renderInlineLoading("分析データを読み込み中...")
              ) : (
                <>
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
                                  className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 break-all"
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
                                    <div className="text-gray-500 mt-2">
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
                                  className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 break-all"
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
                                    <div className="text-gray-500 mt-2">
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
                </>
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
                        <div className="text-gray-500 mt-1">
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
          <AuditLogSection
            ref={auditLogSectionRef}
            discussion={discussion}
            discussionInfo={discussionInfo}
            conversationAuditMode={false}
            referencedDiscussions={discussion ? [discussion] : []}
          />
        </main>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
