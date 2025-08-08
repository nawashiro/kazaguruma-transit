"use client";

import React, { useState } from "react";
import type { AuditTimelineItem } from "@/types/discussion";
import { formatRelativeTime, hexToNpub } from "@/lib/nostr/nostr-utils";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";

interface AuditTimelineProps {
  items: AuditTimelineItem[];
  profiles?: Record<string, { name?: string }>;
}

export function AuditTimeline({ items, profiles = {} }: AuditTimelineProps) {
  // 投稿IDと承認状況のマッピングを作成
  const getApprovalStatus = (item: AuditTimelineItem) => {
    if (item.type !== "post-submitted") return null;

    // post-submitted の場合、item.id が投稿のIDになる
    // post-approved の場合、item.targetId が承認対象の投稿のIDになる
    const postId = item.id;
    const hasApproval = items.some(
      (approvalItem) =>
        approvalItem.type === "post-approved" &&
        approvalItem.targetId === postId
    );

    return hasApproval ? "approved" : "pending";
  };
  const [selectedEvent, setSelectedEvent] = useState<AuditTimelineItem | null>(
    null
  );

  useRubyfulRun([selectedEvent], true);

  const getDetailContent = (item: AuditTimelineItem) => {
    switch (item.type) {
      case "discussion-request":
        // リクエストの場合、contentを表示
        return item.event.content ? (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm ruby-text">
            <div className="whitespace-pre-wrap">{item.event.content}</div>
          </div>
        ) : null;

      case "post-submitted":
        // 投稿提出の場合、contentを表示
        return item.event.content ? (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm ruby-text">
            <div className="whitespace-pre-wrap">{item.event.content}</div>
          </div>
        ) : null;

      case "post-approved":
        // 承認の場合、承認された投稿の内容を表示
        try {
          const approvedPost = JSON.parse(item.event.content);
          return (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm ruby-text">
              <div className="whitespace-pre-wrap">
                {approvedPost.content || "内容なし"}
              </div>
            </div>
          );
        } catch {
          return null;
        }

      default:
        return null;
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 ruby-text">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="履歴なし"
          role="img"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          履歴がありません
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          まだ操作履歴がありません。
        </p>
      </div>
    );
  }

  const getIconByType = (type: AuditTimelineItem["type"]) => {
    switch (type) {
      case "discussion-request":
        return (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        );
      case "discussion-created":
        return (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        );
      case "discussion-deleted":
        return (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        );
      case "post-submitted":
        return (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        );
      case "post-approved":
        return (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "post-rejected":
        return (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getColorByType = (type: AuditTimelineItem["type"]) => {
    switch (type) {
      case "discussion-request":
        return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900";
      case "discussion-created":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900";
      case "discussion-deleted":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900";
      case "post-submitted":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900";
      case "post-approved":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900";
      case "post-rejected":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900";
    }
  };

  return (
    <>
      <ul
        className="timeline timeline-snap-icon timeline-compact timeline-vertical"
        role="list"
        aria-label="監査タイムライン"
      >
        {items.map((item, index) => (
          <li key={item.id} role="listitem">
            {index != 0 && <hr />}

            <div className="timeline-middle">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${getColorByType(
                  item.type
                )}`}
                role="img"
                aria-label={`${item.type}アイコン`}
              >
                {getIconByType(item.type)}
              </div>
            </div>

            <div className="timeline-start mb-10 pt-2.5">
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <time dateTime={new Date(item.timestamp).toISOString()}>
                  {formatRelativeTime(item.timestamp)}
                </time>
              </p>
              <div className="timeline-box">
                {profiles[item.actorPubkey]?.name && (
                  <p className="text-sm ruby-text">
                    {profiles[item.actorPubkey].name}
                  </p>
                )}
                <div className="join items-start mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {`${hexToNpub(item.actorPubkey).slice(0, 12)}...`}
                  </span>
                  {item.type === "post-submitted" &&
                    (() => {
                      const approvalStatus = getApprovalStatus(item);
                      return approvalStatus === "approved" ? (
                        <span className="badge badge-primary badge-sm ml-2">
                          承認済み
                        </span>
                      ) : (
                        <span className="badge badge-warning badge-sm ml-2">
                          未承認
                        </span>
                      );
                    })()}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 ruby-text">
                  {item.description}
                </p>
                {getDetailContent(item)}
                <button
                  onClick={() => setSelectedEvent(item)}
                  className="btn btn-sm btn-outline rounded-full dark:rounded-sm mt-2 ruby-text h-fit min-h-8"
                  type="button"
                  aria-label={`${item.type}の技術情報を表示`}
                >
                  <span>技術情報</span>
                </button>
              </div>
            </div>

            {index < items.length - 1 && <hr />}
          </li>
        ))}
      </ul>

      {/* イベントJSONモーダル */}
      {selectedEvent && (
        <dialog
          className="modal modal-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
        >
          <div className="modal-box max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <h3
                id="event-modal-title"
                className="font-bold text-lg ruby-text"
              >
                技術情報 - Nostrイベント
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="btn btn-sm btn-circle btn-ghost"
                type="button"
                aria-label="モーダルを閉じる"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <div className="badge badge-primary mb-2">
                {selectedEvent.type}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 ruby-text">
                {selectedEvent.description}
              </p>
            </div>

            <div className="mockup-code">
              {JSON.stringify(selectedEvent.event, null, 2)
                .split("\n")
                .map((line, idx) => (
                  <pre data-prefix={idx + 1} key={idx}>
                    <code className="text-sm">{line}</code>
                  </pre>
                ))}
            </div>

            <div className="modal-action">
              <button
                onClick={() => setSelectedEvent(null)}
                className="btn rounded-full dark:rounded-sm ruby-text"
                type="button"
              >
                <span>閉じる</span>
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setSelectedEvent(null)}
            role="button"
            tabIndex={0}
            aria-label="モーダルの背景をクリックして閉じる"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setSelectedEvent(null);
              }
            }}
          />
        </dialog>
      )}
    </>
  );
}
