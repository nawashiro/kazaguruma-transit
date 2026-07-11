"use client";

import React from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon,
  PencilIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import type { Discussion } from "@/types/discussion";
import type { AuditTimelineDTO } from "@/lib/discussion/audit-timeline-mapper";
import { formatRelativeTime } from "@/lib/nostr/nostr-utils";

interface AuditTimelineProps {
  items: AuditTimelineDTO[];
  profiles?: Record<string, { name?: string }>;
  referencedDiscussions?: Discussion[];
  conversationAuditMode?: boolean;
}

const getTypeLabel = (type: AuditTimelineDTO["type"]): string => {
  switch (type) {
    case "listing-requested":
      return "一覧掲載リクエスト";
    case "promotion-requested":
      return "モデレーター昇格リクエスト";
    case "post-submitted":
      return "投稿提出";
    default:
      return "監査イベント";
  }
};

const getTypeIcon = (type: AuditTimelineDTO["type"]) => {
  switch (type) {
    case "listing-requested":
      return <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />;
    case "promotion-requested":
      return <UserPlusIcon className="h-4 w-4" aria-hidden="true" />;
    case "post-submitted":
      return <PencilIcon className="h-4 w-4" aria-hidden="true" />;
    default:
      return <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />;
  }
};

export function AuditTimeline({ items }: AuditTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 ruby-text">
        <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          履歴がありません
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          まだ操作履歴がありません。
        </p>
      </div>
    );
  }

  return (
    <ul
      className="timeline timeline-snap-icon timeline-compact timeline-vertical"
      role="list"
    >
      {items.map((item) => (
        <li key={item.id}>
          <hr />
          <div className="timeline-middle">
            <div className="badge badge-neutral p-2">{getTypeIcon(item.type)}</div>
          </div>
          <div className="timeline-end mb-6 card bg-base-100 border border-base-300">
            <div className="card-body p-4 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-outline">{getTypeLabel(item.type)}</span>
                <span
                  className={`badge ${
                    item.approvalState === "approved" ? "badge-success" : "badge-ghost"
                  }`}
                >
                  {item.approvalState === "approved" ? (
                    <>
                      <CheckCircleIcon className="h-3 w-3" aria-hidden="true" /> 承認済み
                    </>
                  ) : (
                    "未承認"
                  )}
                </span>
              </div>

              <div className="text-sm ruby-text">
                実行者: <span className="font-medium">{item.actorMnemonic}</span>
              </div>

              {item.approvedByMnemonic ? (
                <div className="text-sm ruby-text">
                  承認者: <span className="font-medium">{item.approvedByMnemonic}</span>
                </div>
              ) : null}

              {item.targetRef ? (
                <div className="text-sm opacity-70 break-all">
                  target: <code>{item.targetRef}</code>
                </div>
              ) : null}

              <time className="text-sm opacity-70">
                {formatRelativeTime(item.timestamp)}
              </time>
            </div>
          </div>
          <hr />
        </li>
      ))}
    </ul>
  );
}
