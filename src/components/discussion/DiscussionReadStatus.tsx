"use client";

import type { CompletionReason } from "@/lib/nostr/nostr-service";

interface DiscussionReadStatusProps {
  isLoading: boolean;
  completionReason: CompletionReason | null;
  hasData: boolean;
  onReload?: () => void;
  approvalState?: "unknown";
}

export function DiscussionReadStatus({ isLoading, completionReason, hasData, onReload, approvalState }: DiscussionReadStatusProps) {
  if (isLoading) return <div role="status" aria-live="polite" className="flex items-center gap-2 text-base"><span className="loading loading-spinner loading-sm" aria-hidden="true" />会話データを読み込み中...</div>;
  if (approvalState === "unknown") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="alert alert-warning alert-soft text-base-content! my-4"
      >
        <p className="ruby-text">承認情報を確認中です。表示内容は暫定です。</p>
        {onReload && (
          <button
            type="button"
            aria-label="承認情報を再確認"
            className="btn text-base btn-outline gap-0 ruby-text min-h-[44px] rounded-full dark:rounded-sm"
            onClick={onReload}
          >
            再読み込み
          </button>
        )}
      </div>
    );
  }
  if (completionReason === "eose" || !completionReason) return null;
  const message = hasData
    ? "一部のrelayからの取得が完了していません。表示内容は暫定です。"
    : "会話データを取得できませんでした。relayの応答を待てなかった可能性があります。";
  return (
    <div
      role="status"
      aria-live="polite"
      className="alert alert-warning alert-soft text-base-content! my-4"
    >
      <p className="ruby-text">{message}</p>
      {onReload && (
        <button
          type="button"
          aria-label="再読み込み"
          className="btn text-base btn-outline gap-0 ruby-text min-h-[44px] rounded-full dark:rounded-sm"
          onClick={onReload}
        >
          再読み込み
        </button>
      )}
    </div>
  );
}
