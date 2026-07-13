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
  if (isLoading) return <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm"><span className="loading loading-spinner loading-sm" aria-hidden="true" />会話データを読み込み中...</div>;
  if (approvalState === "unknown") return <div role="status" aria-live="polite" className="alert alert-warning my-4"><span>承認情報を確認中です。表示内容は暫定です。</span>{onReload && <button type="button" aria-label="承認情報を再確認" className="btn btn-outline min-h-[44px] rounded-full dark:rounded-sm" onClick={onReload}><span className="ruby-text">再読み込み</span></button>}</div>;
  if (completionReason === "eose" || !completionReason) return null;
  const message = hasData
    ? "一部のrelayからの取得が完了していません。表示内容は暫定です。"
    : "会話データを取得できませんでした。relayの応答を待てなかった可能性があります。";
  return <div role="status" aria-live="polite" className="alert alert-warning my-4"><span>{message}</span>{onReload && <button type="button" aria-label="再読み込み" className="btn btn-outline min-h-[44px] rounded-full dark:rounded-sm" onClick={onReload}><span className="ruby-text">再読み込み</span></button>}</div>;
}
