"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  validatePostForm,
} from "@/lib/nostr/nostr-utils";
import type {
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  PostFormData,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import type { Event } from "nostr-tools";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [postForm, setPostForm] = useState<PostFormData>({
    content: "",
    busStopTag: busStops[0] || "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const postsEventsRef = useRef<Event[]>([]);
  const approvalEventsRef = useRef<Event[]>([]);
  const approvalsStreamCleanupRef = useRef<() => void>();
  const approvalsForDiscussionCleanupRef = useRef<() => void>();

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

  const updateFromEvents = useCallback(
    async (
      postEvents: Event[],
      approvalsEvents: Event[],
      fetchEvaluations: boolean
    ) => {
      const parsedApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const parsedPosts = postEvents
        .map((event) => parsePostEvent(event, parsedApprovals))
        .filter((p): p is DiscussionPost => p !== null)
        .filter(
          (p) => p.approved && p.busStopTag && busStops.includes(p.busStopTag)
        );

      setPosts(parsedPosts);
      if (!fetchEvaluations || parsedPosts.length === 0) {
        return;
      }

      const approvedPostIds = parsedPosts.map((p) => p.id);
      const evaluationsEvents = await nostrService.getEvaluationsForPosts(
        approvedPostIds
      );

      const parsedEvaluations = evaluationsEvents
        .map(parseEvaluationEvent)
        .filter((e): e is PostEvaluation => e !== null);
      setEvaluations(parsedEvaluations);
    },
    [busStops, nostrService]
  );

  const startStreaming = useCallback(() => {
    if (busStops.length === 0) {
      return;
    }

    approvalsStreamCleanupRef.current?.();
    approvalsForDiscussionCleanupRef.current?.();
    postsEventsRef.current = [];
    approvalEventsRef.current = [];

    const postFilters =
      busStops.length > 0
        ? busStops.map((stop) => ({
            kinds: [1111, 1],
            "#a": [config.busStopDiscussionId],
            "#t": [stop],
          }))
        : [
            {
              kinds: [1111, 1],
              "#a": [config.busStopDiscussionId],
            },
          ];

    const postStream = nostrService.streamEventsOnEvent(postFilters, {
      onEvent: (events) => {
        postsEventsRef.current = events;
        updateFromEvents(events, approvalEventsRef.current, false);
      },
      onEose: (events) => {
        postsEventsRef.current = events;
        updateFromEvents(events, approvalEventsRef.current, true);
      },
      timeoutMs: config.defaultTimeout ?? 5000,
    });

    const approvalsStream = nostrService.streamApprovals(
      config.busStopDiscussionId,
      {
        onEvent: (events) => {
          approvalEventsRef.current = events;
          updateFromEvents(postsEventsRef.current, events, false);
        },
        onEose: (events) => {
          approvalEventsRef.current = events;
          updateFromEvents(postsEventsRef.current, events, true);
        },
        timeoutMs: config.defaultTimeout ?? 5000,
      }
    );

    approvalsStreamCleanupRef.current = postStream;
    approvalsForDiscussionCleanupRef.current = approvalsStream;
    updateFromEvents([], [], false);
  }, [
    busStops,
    config.busStopDiscussionId,
    config.defaultTimeout,
    nostrService,
    updateFromEvents,
  ]);

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
      logger.error("Failed to load user evaluations:", error);
    }
  }, [user.pubkey, nostrService]);

  useEffect(() => {
    if (discussionsEnabled) {
      startStreaming();
    }

    return () => {
      approvalsStreamCleanupRef.current?.();
      approvalsForDiscussionCleanupRef.current?.();
    };
  }, [discussionsEnabled, startStreaming]);

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
      startStreaming();
    } catch (error) {
      logger.error("Failed to submit post:", error);
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
      startStreaming();
    } catch (error) {
      logger.error("Failed to evaluate post:", error);
    }
  };

  if (!discussionsEnabled || busStops.length === 0) {
    return null;
  }

  const approvedPosts = posts.filter((p) => p.approved);
  const postsWithStats = combinePostsWithStats(approvedPosts, evaluations);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Evaluation component */}
      {postsWithStats.length > 0 && (
        <div>
          <EvaluationComponent
            posts={postsWithStats}
            onEvaluate={handleEvaluate}
            userEvaluations={userEvaluations}
            isRandomOrder={true}
            title="メモを評価"
          />
        </div>
      )}

      {/* Post form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4 ruby-text">バス停メモを投稿</h3>

        {!showPreview ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="post-content" className="label">
                <span className="label-text ruby-text">投稿内容 *</span>
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
                placeholder="このバス停での体験など、メモを投稿してください"
                required
                disabled={isSubmitting}
                maxLength={280}
              />
              <div className="text-gray-500 mt-1 ruby-text">
                {postForm.content.length}/280文字
              </div>
            </div>

            <div>
              <label htmlFor="bus-stop-tag" className="label">
                <span className="label-text ruby-text">バス停 *</span>
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

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
