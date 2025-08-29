"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/24/solid";
import type { AuditTimelineItem, Discussion } from "@/types/discussion";
import { formatRelativeTime, hexToNpub } from "@/lib/nostr/nostr-utils";
import { buildNaddrFromRef } from "@/lib/nostr/naddr-utils";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";

interface AuditTimelineProps {
  items: AuditTimelineItem[];
  profiles?: Record<string, { name?: string }>;
  referencedDiscussions?: Discussion[];
  conversationAuditMode?: boolean;
}

export function AuditTimeline({
  items,
  profiles = {},
  referencedDiscussions = [],
  conversationAuditMode = false,
}: AuditTimelineProps) {
  // qタグから参照されている会話を検索
  const findReferencedDiscussion = (qRef: string): Discussion | null => {
    return (
      referencedDiscussions.find((d) => {
        const expectedRef = `34550:${d.authorPubkey}:${d.dTag}`;
        return expectedRef === qRef;
      }) || null
    );
  };

  // qタグを持つアイテムかどうかを判断
  const hasQTag = (item: AuditTimelineItem): boolean => {
    if (item.type !== "post-submitted" && item.type !== "post-approved")
      return false;
    const qTags = item.event?.tags?.filter((tag) => tag[0] === "q") || [];
    return qTags.some((qTag) => qTag[1] && qTag[1].startsWith("34550:"));
  };

  // 会話監査モードに基づいてアイテムをフィルタリング
  const filteredItems = useMemo(() => {
    if (!conversationAuditMode) return items;
    return items.filter((item) => {
      // 承認イベントは常に含める
      if (item.type === "post-approved") return true;
      // その他のイベントはqタグの有無で判断
      return hasQTag(item);
    });
  }, [items, conversationAuditMode]);

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

  // 参照された会話の作成者またはモデレーターかどうかを判断
  const isActorFromReferencedConversation = (actorPubkey: string) => {
    return referencedDiscussions.some(
      (discussion) =>
        discussion.authorPubkey === actorPubkey ||
        discussion.moderators.some((mod) => mod.pubkey === actorPubkey)
    );
  };

  const getActorDisplayName = (actorPubkey: string) => {
    // 参照された会話の作成者・モデレーターの名前を表示
    if (isActorFromReferencedConversation(actorPubkey)) {
      return profiles[actorPubkey]?.name;
    }
    return null;
  };

  const getActorBadge = (actorPubkey: string) => {
    // 参照された会話での役割を表示
    const referencedConversation = referencedDiscussions.find(
      (discussion) => discussion.authorPubkey === actorPubkey
    );

    if (referencedConversation) {
      return "作成者";
    }

    const isModeratorInReferencedConversation = referencedDiscussions.some(
      (discussion) =>
        discussion.moderators.some((mod) => mod.pubkey === actorPubkey)
    );

    if (isModeratorInReferencedConversation) {
      return "モデレーター";
    }

    return null;
  };

  // qタグ引用をレンダリング（会話一覧風）
  const renderQTagReferences = (item: AuditTimelineItem) => {
    if (item.type !== "post-submitted" && item.type !== "post-approved")
      return null;

    let qTags: string[][] = [];

    switch (item.type) {
      case "post-submitted":
        // post-submitted の場合は event.tags から直接取得
        qTags = item.event?.tags?.filter((tag) => tag[0] === "q") || [];
        break;

      case "post-approved":
        // post-approved の場合は content 内の承認された投稿のqタグを取得
        try {
          const approvedPost = JSON.parse(item.event.content);
          if (approvedPost.tags) {
            qTags = approvedPost.tags.filter((tag: string[]) => tag[0] === "q");
          }
        } catch {
          // JSON パースに失敗した場合は空配列
          qTags = [];
        }
        break;

      default:
        qTags = [];
        break;
    }

    if (qTags.length === 0) return null;

    return (
      <div className="space-y-3">
        {qTags.map((qTag, index) => {
          if (!qTag[1] || !qTag[1].startsWith("34550:")) return null;

          const referencedDiscussion = findReferencedDiscussion(qTag[1]);
          if (!referencedDiscussion) {
            // 内部参照形式をnaddr形式に変換してユーザーに表示
            try {
              const naddr = buildNaddrFromRef(qTag[1]);
              return (
                <div
                  key={index}
                  className="text-sm text-gray-400 italic ruby-text"
                >
                  会話が見つかりません。参照: {naddr}
                </div>
              );
            } catch {
              return (
                <div
                  key={index}
                  className="text-sm text-gray-400 italic ruby-text"
                >
                  無効な参照形式。参照: {qTag[1]}
                </div>
              );
            }
          }

          const naddr = buildNaddrFromRef(qTag[1]);
          return (
            <div key={index} className="ruby-text">
              <Link
                href={`/discussions/${naddr}`}
                className="block hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-3 -m-3 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {referencedDiscussion.title}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {referencedDiscussion.description.length > 100
                    ? `${referencedDiscussion.description.slice(0, 100)}...`
                    : referencedDiscussion.description}
                </p>
              </Link>
            </div>
          );
        })}
      </div>
    );
  };

  useRubyfulRun([selectedEvent], true);

  const getDetailContent = (item: AuditTimelineItem) => {
    const qTagContent = renderQTagReferences(item);

    switch (item.type) {
      case "discussion-request":
        // リクエストの場合、contentを表示
        return item.event.content ? (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm ruby-text">
            <div className="whitespace-pre-wrap">{item.event.content}</div>
          </div>
        ) : null;

      case "post-submitted":
        // 投稿提出の場合、qタグ引用とcontentを表示

        if (qTagContent) {
          return qTagContent;
        } else {
          return (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm ruby-text">
              <div className="whitespace-pre-wrap">
                {item.event.content || "内容なし"}
              </div>
            </div>
          );
        }

      case "post-approved":
        // 承認の場合、qタグ引用と承認された投稿の内容を表示
        try {
          const approvedPost = JSON.parse(item.event.content);

          if (qTagContent) {
            return qTagContent;
          } else {
            return (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm ruby-text">
                <div className="whitespace-pre-wrap">
                  {approvedPost.content || "内容なし"}
                </div>
              </div>
            );
          }
        } catch {
          return qTagContent;
        }

      default:
        return null;
    }
  };

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-8 ruby-text">
        <ClockIcon
          className="mx-auto h-12 w-12 text-gray-400"
          aria-label="履歴なし"
          role="img"
        />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          {conversationAuditMode
            ? "会話関連の履歴がありません"
            : "履歴がありません"}
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {conversationAuditMode
            ? "会話を参照する投稿履歴がありません。"
            : "まだ操作履歴がありません。"}
        </p>
      </div>
    );
  }

  const getIconByType = (type: AuditTimelineItem["type"]) => {
    switch (type) {
      case "discussion-request":
        return <ChatBubbleLeftRightIcon className="w-4 h-4" aria-hidden="true" />;
      case "discussion-created":
        return <PlusIcon className="w-4 h-4" aria-hidden="true" />;
      case "discussion-deleted":
        return <TrashIcon className="w-4 h-4" aria-hidden="true" />;
      case "post-submitted":
        return <PencilIcon className="w-4 h-4" aria-hidden="true" />;
      case "post-approved":
        return <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />;
      case "post-rejected":
        return <XCircleIcon className="w-4 h-4" aria-hidden="true" />;
      default:
        return <InformationCircleIcon className="w-4 h-4" aria-hidden="true" />;
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
        {filteredItems.map((item, index) => (
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
              <div className="timeline-box break-all">
                {getActorDisplayName(item.actorPubkey) && (
                  <div className="flex items-center gap-2 mb-1">
                    {getActorBadge(item.actorPubkey) && (
                      <span className="badge badge-neutral badge-sm">
                        {getActorBadge(item.actorPubkey)}
                      </span>
                    )}
                    <span className="text-sm ruby-text">
                      {getActorDisplayName(item.actorPubkey)}
                    </span>
                  </div>
                )}

                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {`${hexToNpub(item.actorPubkey).slice(0, 12)}...`}
                </span>

                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300 ruby-text">
                    {item.description}
                  </p>
                  {item.type === "post-submitted" &&
                    (() => {
                      const approvalStatus = getApprovalStatus(item);
                      return approvalStatus === "approved" ? (
                        <span className="badge badge-primary badge-sm">
                          承認済み
                        </span>
                      ) : (
                        <span className="badge badge-warning badge-sm">
                          未承認
                        </span>
                      );
                    })()}
                </div>
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

            {index < filteredItems.length - 1 && <hr />}
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
                <XMarkIcon className="w-4 h-4" />
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
