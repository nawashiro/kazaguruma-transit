"use client";

import React, { useState, useMemo } from "react";
import { CircleCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import type { PostWithStats } from "@/types/discussion";
import { shuffleArray, filterUnevaluatedPosts } from "@/lib/nostr/nostr-utils";
import { logger } from "@/utils/logger";

interface EvaluationComponentProps {
  posts: PostWithStats[];
  onEvaluate: (postId: string, rating: "+" | "-") => Promise<void>;
  userEvaluations: Set<string>;
  isRandomOrder?: boolean;
  maxDisplayCount?: number;
  title?: string;
}

export function EvaluationComponent({
  posts,
  onEvaluate,
  userEvaluations,
  isRandomOrder = false,
  title = "この論点は参考になりますか？",
}: EvaluationComponentProps) {
  const [evaluatingPost, setEvaluatingPost] = useState<string | null>(null);

  const limitedPosts = useMemo(() => {
    const availablePosts = filterUnevaluatedPosts(
      posts.filter((p) => p.approved && p.approvalState !== "unknown"),
      userEvaluations
    );

    // 初回のみシャッフル、その後は順序を保持
    return isRandomOrder ? shuffleArray(availablePosts) : availablePosts;
  }, [posts, userEvaluations, isRandomOrder]);

  const handleEvaluate = async (postId: string, rating: "+" | "-") => {
    if (evaluatingPost) return;

    setEvaluatingPost(postId);
    try {
      await onEvaluate(postId, rating);
      // filterUnevaluatedPostsが自動的に評価済み投稿を除外するため、
      // インデックスを手動で進める必要はない
    } catch (error) {
      logger.error("Evaluation failed:", error);
    } finally {
      setEvaluatingPost(null);
    }
  };

  if (limitedPosts.length === 0) {
    return (
      <div className="py-8 ruby-text">
        <CircleCheck className="h-12 w-12 text-gray-400" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          評価可能な投稿がありません
        </h3>
        <p className="mt-2 text-base text-base-content">
          すべての投稿を評価済みか、承認された投稿がありません。
        </p>
      </div>
    );
  }

  const currentPost = limitedPosts[0];

  // 全承認済み投稿数と評価済み投稿数からプログレスを計算
  const allApprovedPosts = posts.filter((p) => p.approved && p.approvalState !== "unknown");
  const totalCount = allApprovedPosts.length;
  const evaluatedCount = userEvaluations.size;
  const progressPercentage =
    totalCount > 0 ? (evaluatedCount / totalCount) * 100 : 0;

  if (!currentPost) {
    return (
      <div className="py-8 ruby-text">
        <CircleCheck className="h-12 w-12 text-green-400" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          評価完了
        </h3>
        <p className="mt-2 text-base text-base-content">
          すべての投稿の評価が完了しました。
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      aria-live="polite"
      role="region"
      aria-labelledby="evaluation-title"
    >
      <div className="flex justify-between items-center">
        <h2 id="evaluation-title" className="text-xl font-bold ruby-text">
          {title}
        </h2>
      </div>
      <p>論点が妥当だと思う、賛成できるなどの投稿は「はい」を押してください。</p>
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
        role="article"
        aria-labelledby="current-post-label"
      >
        <div id="current-post-label" className="sr-only">
          現在評価中の投稿
        </div>
        {currentPost.busStopTag && (
          <div className="mb-3">
            <span className="badge badge-primary badge-md">
              {currentPost.busStopTag}
            </span>
          </div>
        )}

        <div
          className="prose prose-sm dark:prose-invert max-w-none mb-6"
          role="document"
        >
          {(currentPost.content || "").split("\n").map((line, index) => (
            <p
              key={index}
              className="mb-2 last:mb-0 ruby-text text-balance break-all"
            >
              {line || "\u00A0"}
            </p>
          ))}
        </div>

        <div
          className="flex gap-4 justify-center"
          role="group"
          aria-label="投稿の評価"
        >
          <button
            onClick={() => handleEvaluate(currentPost.id, "+")}
            disabled={evaluatingPost !== null}
            className={`btn text-base btn-primary gap-0 ruby-text min-h-[44px] min-w-[44px] flex-1 max-w-xs rounded-full dark:rounded-sm ${evaluatingPost === currentPost.id ? "loading" : ""
              }`}
            type="button"
          >
            {evaluatingPost === currentPost.id ? (
              ""
            ) : (
              <>
                <ThumbsUp className="w-6 h-6 mr-2" aria-hidden="true" />
                はい
              </>
            )}
          </button>
          <button
            onClick={() => handleEvaluate(currentPost.id, "-")}
            disabled={evaluatingPost !== null}
            className={`btn text-base btn-warning gap-0 ruby-text min-h-[44px] min-w-[44px] flex-1 max-w-xs rounded-full dark:rounded-sm ${evaluatingPost === currentPost.id ? "loading" : ""
              }`}
            type="button"
          >
            {evaluatingPost === currentPost.id ? (
              ""
            ) : (
              <>
                <ThumbsDown className="w-6 h-6 mr-2" aria-hidden="true" />
                いいえ
              </>
            )}
          </button>
        </div>
      </div>

      {totalCount > 0 && (
        <progress
          className="progress progress-primary w-full"
          value={progressPercentage}
          max="100"
          aria-label={`評価進捗: ${Math.round(progressPercentage)}%完了`}
        ></progress>
      )}
    </div>
  );
}
