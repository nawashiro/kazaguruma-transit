"use client";

import type { CompletionReason } from "@/lib/nostr/nostr-service";
import type { Discussion } from "@/types/discussion";

interface DiscussionMetaReadStateProps {
  discussion: Discussion | null;
  isLoading: boolean;
  error: string | null;
  completionReason: CompletionReason | null;
  onReload: () => void;
  children?: React.ReactNode;
}

export function DiscussionMetaReadState({
  discussion,
  isLoading,
  error,
  completionReason,
  onReload,
  children,
}: DiscussionMetaReadStateProps) {
  return (
    <>
      {isLoading && (
        <div role="status" aria-live="polite" className="mb-8">
          会話情報を読み込み中...
        </div>
      )}
      {discussion && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 ruby-text">{discussion.title}</h1>
          {discussion.description.split("\n").map((line) => (
            <p key={line} className="text-gray-600 dark:text-gray-400 ruby-text">
              {line}
            </p>
          ))}
        </div>
      )}
      {error && (
        <div className="alert alert-error mb-8" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-outline min-h-[44px]" onClick={onReload}>
            <span className="ruby-text">再試行</span>
          </button>
        </div>
      )}
      {completionReason && completionReason !== "eose" && !error && (
        <div role="status" aria-live="polite" className="alert alert-warning mb-8">
          <span>一部のrelayからの取得が完了していません。表示内容は暫定です。</span>
          <button type="button" className="btn btn-outline min-h-[44px]" onClick={onReload}>
            <span className="ruby-text">再読み込み</span>
          </button>
        </div>
      )}
      {children}
    </>
  );
}
