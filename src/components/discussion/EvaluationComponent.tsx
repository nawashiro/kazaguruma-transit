"use client";

import React, { useState, useMemo } from "react";
import type { PostWithStats } from "@/types/discussion";
import { shuffleArray, filterUnevaluatedPosts } from "@/lib/nostr/nostr-utils";

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
  maxDisplayCount = 10,
  title = "投稿を評価",
}: EvaluationComponentProps) {
  const [evaluatingPost, setEvaluatingPost] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const limitedPosts = useMemo(() => {
    const availablePosts = filterUnevaluatedPosts(
      posts.filter((p) => p.approved),
      userEvaluations
    );
    const displayPosts = isRandomOrder
      ? shuffleArray(availablePosts)
      : availablePosts;
    return displayPosts.slice(0, maxDisplayCount);
  }, [posts, userEvaluations, isRandomOrder, maxDisplayCount]);

  const handleEvaluate = async (postId: string, rating: "+" | "-") => {
    if (evaluatingPost) return;

    setEvaluatingPost(postId);
    try {
      await onEvaluate(postId, rating);
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      console.error("Evaluation failed:", error);
    } finally {
      setEvaluatingPost(null);
    }
  };

  if (limitedPosts.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          評価可能な投稿がありません
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          すべての投稿を評価済みか、承認された投稿がありません。
        </p>
      </div>
    );
  }

  const currentPost = limitedPosts[currentIndex];
  const remainingCount = limitedPosts.length - currentIndex;

  if (!currentPost) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          評価完了
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          すべての投稿の評価が完了しました。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">{title}</h3>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          残り {remainingCount} 件
        </span>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {currentPost.busStopTag && (
          <div className="mb-3">
            <span className="badge badge-primary badge-sm">
              {currentPost.busStopTag}
            </span>
          </div>
        )}

        <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
          {currentPost.content.split("\n").map((line, index) => (
            <p key={index} className="mb-2 last:mb-0">
              {line || "\u00A0"}
            </p>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => handleEvaluate(currentPost.id, "+")}
            disabled={evaluatingPost !== null}
            className={`btn btn-success btn-lg flex-1 max-w-xs rounded-full dark:rounded-sm ${
              evaluatingPost === currentPost.id ? "loading" : ""
            }`}
          >
            {evaluatingPost === currentPost.id ? (
              ""
            ) : (
              <>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                  />
                </svg>
                賛成
              </>
            )}
          </button>
          <button
            onClick={() => handleEvaluate(currentPost.id, "-")}
            disabled={evaluatingPost !== null}
            className={`btn btn-error btn-lg flex-1 max-w-xs rounded-full dark:rounded-sm ${
              evaluatingPost === currentPost.id ? "loading" : ""
            }`}
          >
            {evaluatingPost === currentPost.id ? (
              ""
            ) : (
              <>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                  />
                </svg>
                反対
              </>
            )}
          </button>
        </div>
      </div>

      {remainingCount > 1 && (
        <div className="progress progress-primary w-full">
          <div
            className="progress-value"
            style={{
              width: `${((currentIndex + 1) / limitedPosts.length) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
