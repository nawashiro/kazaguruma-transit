"use client";

import React from "react";
import Button from "@/components/ui/Button";

interface PostPreviewProps {
  content: string;
  busStopTag?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PostPreview({
  content,
  busStopTag,
  onConfirm,
  onCancel,
  isLoading = false,
}: PostPreviewProps) {
  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
      role="region"
      aria-labelledby="preview-title"
    >
      <h3 id="preview-title" className="text-lg font-medium mb-3 ruby-text">
        投稿プレビュー
      </h3>

      <div className="mb-4">
        <div
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          role="article"
          aria-label="投稿内容プレビュー"
        >
          {busStopTag && (
            <div className="mb-2">
              <span className="badge badge-primary badge-sm">{busStopTag}</span>
            </div>
          )}

          <div
            className="prose prose-sm dark:prose-invert max-w-none ruby-text"
            role="document"
          >
            {content.split("\n").map((line, index) => (
              <p key={index} className="mb-2 last:mb-0">
                {line || "\u00A0"}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 ruby-text">
        <p>この投稿はモデレーターによる承認後に表示されます。</p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onCancel}
          className="flex-1"
          secondary
          disabled={isLoading}
        >
          <span>編集に戻る</span>
        </Button>
        <Button
          onClick={onConfirm}
          className="flex-1"
          disabled={isLoading}
          loading={isLoading}
        >
          <span>{isLoading ? "" : "投稿する"}</span>
        </Button>
      </div>
    </div>
  );
}
