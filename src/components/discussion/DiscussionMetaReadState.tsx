"use client";

import type { CompletionReason } from "@/lib/nostr/nostr-service";
import type { Discussion } from "@/types/discussion";
import PageHeader from "@/components/layouts/PageHeader";

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
      {discussion && (
        <PageHeader
          title={discussion.title}
          description={discussion.description}
        />
      )}
      {isLoading && (
        <div role="status" aria-live="polite" className="mb-8">
          <p className="ruby-text">会話情報を読み込み中...</p>
        </div>
      )}
      {error && (
        <div className="alert alert-error alert-soft text-base-content! mb-8" role="status" aria-live="polite">
          <p className="ruby-text">{error}</p>
          <button
            type="button"
            className="btn text-base btn-outline gap-0 ruby-text min-h-[44px]"
            onClick={onReload}
          >
            再試行
          </button>
        </div>
      )}
      {completionReason && completionReason !== "eose" && !error && (
        <div role="status" aria-live="polite" className="alert alert-warning alert-soft text-base-content! mb-8">
          <p className="ruby-text">一部のrelayからの取得が完了していません。表示内容は暫定です。</p>
          <button
            type="button"
            className="btn text-base btn-outline gap-0 ruby-text min-h-[44px]"
            onClick={onReload}
          >
            再読み込み
          </button>
        </div>
      )}
      {children}
    </>
  );
}
