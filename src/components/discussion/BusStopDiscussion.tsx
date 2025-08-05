"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { LoginModal } from "./LoginModal";
import { PostPreview } from "./PostPreview";
import { EvaluationComponent } from "./EvaluationComponent";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  getDiscussionConfig,
  isDiscussionsEnabled,
} from "@/lib/config/discussion-config";
import {
  parsePostEvent,
  parseApprovalEvent,
  parseEvaluationEvent,
  combinePostsWithStats,
  sortPostsByScore,
  validatePostForm,
} from "@/lib/nostr/nostr-utils";
import type {
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  PostWithStats,
  PostFormData,
} from "@/types/discussion";

interface BusStopDiscussionProps {
  busStops: string[];
  className?: string;
}

export function BusStopDiscussion({
  busStops,
  className = "",
}: BusStopDiscussionProps) {
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [evaluations, setEvaluations] = useState<PostEvaluation[]>([]);
  const [userEvaluations, setUserEvaluations] = useState<Set<string>>(
    new Set()
  );
  const [topPostsByStop, setTopPostsByStop] = useState<
    Map<string, PostWithStats>
  >(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [postForm, setPostForm] = useState<PostFormData>({
    content: "",
    busStopTag: busStops[0] || "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  const { user, signEvent } = useAuth();
  const config = useMemo(() => getDiscussionConfig(), []);
  const discussionsEnabled = useMemo(() => isDiscussionsEnabled(), []);
  const nostrService = useMemo(
    () =>
      createNostrService({
        relays: config.relays,
        defaultTimeout: 5000,
      }),
    [config.relays]
  );

  const loadData = useCallback(async () => {
    if (busStops.length === 0) {
      setTopPostsByStop(new Map());
      return;
    }

    try {
      // Step 1: バス停タグ付きの投稿を取得
      const postsEvents = await nostrService.getDiscussionPosts(
        config.busStopDiscussionId,
        50,
        busStops
      );

      const postIds = postsEvents.map((event) => event.id);

      // Step 2: 該当する投稿に対する承認のみを取得（通信量削減）
      const approvalsEvents = await nostrService.getApprovalsForPosts(
        postIds,
        config.busStopDiscussionId
      );

      const parsedApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const parsedPosts = postsEvents
        .map((event) => parsePostEvent(event, parsedApprovals))
        .filter((p): p is DiscussionPost => p !== null)
        .filter(
          (p) => p.approved && p.busStopTag && busStops.includes(p.busStopTag)
        );

      // Step 3: 承認された投稿のIDのみに対する評価を取得
      const approvedPostIds = parsedPosts.map((p) => p.id);
      const evaluationsEvents = await nostrService.getEvaluationsForPosts(
        approvedPostIds,
        config.busStopDiscussionId
      );

      const parsedEvaluations = evaluationsEvents
        .map(parseEvaluationEvent)
        .filter((e): e is PostEvaluation => e !== null);

      setPosts(parsedPosts);
      setEvaluations(parsedEvaluations);

      const postsWithStats = combinePostsWithStats(
        parsedPosts,
        parsedEvaluations
      );

      // バス停ごとの最高評価投稿を取得
      const topPostsMap = new Map<string, PostWithStats>();
      busStops.forEach((stopName) => {
        const stopPosts = postsWithStats.filter(
          (p) => p.busStopTag === stopName
        );
        const sortedStopPosts = sortPostsByScore(stopPosts);
        if (sortedStopPosts.length > 0) {
          topPostsMap.set(stopName, sortedStopPosts[0]);
        }
      });
      setTopPostsByStop(topPostsMap);
    } catch (error) {
      console.error("Failed to load bus stop discussion:", error);
      setTopPostsByStop(new Map());
    }
  }, [busStops, config.busStopDiscussionId, nostrService]);

  const loadUserEvaluations = useCallback(async () => {
    if (!user.pubkey) return;

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
  }, [user.pubkey, nostrService]);

  useEffect(() => {
    if (discussionsEnabled) {
      loadData();
    }
  }, [discussionsEnabled, loadData]);

  useEffect(() => {
    if (user.pubkey) {
      loadUserEvaluations();
    }
  }, [user.pubkey, loadUserEvaluations]);

  const handlePostSubmit = async () => {
    if (!user.isLoggedIn) {
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
        config.busStopDiscussionId,
        postForm.busStopTag
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish post to relays");
      }

      setPostForm({ content: "", busStopTag: busStops[0] || "" });
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
    if (!user.isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    try {
      const eventTemplate = nostrService.createEvaluationEvent(
        postId,
        rating,
        config.busStopDiscussionId
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

  if (!discussionsEnabled || busStops.length === 0) {
    return null;
  }

  const approvedPosts = posts.filter((p) => p.approved);
  const postsWithStats = combinePostsWithStats(approvedPosts, evaluations);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top rated posts display */}
      {topPostsByStop.size > 0 && (
        <div className="space-y-3">
          {Array.from(topPostsByStop.entries()).map(
            ([busStopName, topPost]) => (
              <div
                key={busStopName}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    メモ
                  </span>
                  <span className="badge badge-primary badge-sm">
                    {busStopName}
                  </span>
                </div>
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {topPost.content}
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* Post form */}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">バス停での体験を投稿</h3>

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
                className="textarea textarea-bordered w-full h-24"
                placeholder="このバス停での体験や意見を投稿してください"
                required
                disabled={isSubmitting}
                maxLength={280}
              />
              <div className="text-xs text-gray-500 mt-1">
                {postForm.content.length}/280文字
              </div>
            </div>

            <div>
              <label htmlFor="bus-stop-tag" className="label">
                <span className="label-text">バス停 *</span>
              </label>
              <select
                id="bus-stop-tag"
                value={postForm.busStopTag}
                onChange={(e) =>
                  setPostForm((prev) => ({
                    ...prev,
                    busStopTag: e.target.value,
                  }))
                }
                className="select select-bordered w-full"
                required
                disabled={isSubmitting}
              >
                {busStops.map((stop) => (
                  <option key={stop} value={stop}>
                    {stop}
                  </option>
                ))}
              </select>
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

            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(true)}
                className="btn btn-primary flex-1 rounded-full dark:rounded-sm"
                disabled={!postForm.content.trim() || isSubmitting}
              >
                プレビュー
              </button>
            </div>
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

      {/* Evaluation component */}
      {postsWithStats.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">投稿を評価</h3>
          <EvaluationComponent
            posts={postsWithStats}
            onEvaluate={handleEvaluate}
            userEvaluations={userEvaluations}
            isRandomOrder={true}
            maxDisplayCount={3}
            title=""
          />
        </div>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
