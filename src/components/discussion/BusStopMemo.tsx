"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  getDiscussionConfig,
  isDiscussionsEnabled,
} from "@/lib/config/discussion-config";
import { readBusStopModerationSnapshot, useBusStopModeration } from "./useBusStopModeration";
import { DiscussionReadStatus } from "./DiscussionReadStatus";
import type { PostWithStats } from "@/types/discussion";
import { projectBusStopSnapshot } from "@/lib/discussion/bus-stop-projection";
import { logger } from "@/utils/logger";
import type { Event } from "@/lib/nostr/nostr-service";

interface BusStopMemoProps {
  busStops: string[];
  className?: string;
}

export function BusStopMemo({ busStops, className = "" }: BusStopMemoProps) {
  const [topPostsByStop, setTopPostsByStop] = useState<
    Map<string, PostWithStats>
  >(new Map());

  const config = useMemo(() => getDiscussionConfig(), []);
  const discussionsEnabled = useMemo(() => isDiscussionsEnabled(), []);
  const nostrService = useMemo(
    () =>
      createNostrService({
        relays: config.relays,
        defaultTimeout: 5000,
      }),
    [config.relays]
  );
  const { snapshot, isLoading, error, reload } = useBusStopModeration(busStops);


  const updateFromEvents = useCallback(
    async (
      postEvents: Event[],
      approvalsEvents: Event[],
      fetchEvaluations: boolean
    ) => {
      let evaluationEvents: Event[] = [];
      const approvalState = "approved" as const;
      const initialProjection = projectBusStopSnapshot({ primaryEvents: postEvents, approvalEvents: approvalsEvents, busStops, approvalState });
      if (fetchEvaluations && initialProjection.posts.length > 0) {
        const approvedPostIds = initialProjection.posts.map((p) => p.id);
        const evaluationsEvents = await nostrService.getEvaluationsForPosts(
          approvedPostIds
        );
        evaluationEvents = evaluationsEvents;
      }
      setTopPostsByStop(projectBusStopSnapshot({ primaryEvents: postEvents, approvalEvents: approvalsEvents, evaluationEvents, busStops, approvalState }).topPostsByStop);
    },
    [busStops, nostrService]
  );

  useEffect(() => {
    if (!discussionsEnabled || !snapshot) {
      setTopPostsByStop(new Map());
      return;
    }
    void updateFromEvents(
      snapshot.primaryEvents,
      snapshot.approvalEvents,
      snapshot.approvalState === "approved",
    );
  }, [discussionsEnabled, snapshot, updateFromEvents]);

  if (!discussionsEnabled || busStops.length === 0) {
    return null;
  }
  const isApprovalCheckPending =
    snapshot?.approvalState === "unknown" && snapshot.primaryEvents.length > 0;

  if (isLoading || error || isApprovalCheckPending) {
    return error ? (
      <div role="alert" className="alert alert-error"><span>{error}</span></div>
    ) : (
      <DiscussionReadStatus
        isLoading={isLoading}
        completionReason={snapshot?.completionReason ?? null}
        hasData={Boolean(snapshot?.primaryEvents.length)}
        approvalState={snapshot?.approvalState === "unknown" ? "unknown" : undefined}
        onReload={reload}
      />
    );
  }
  if (topPostsByStop.size === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from(topPostsByStop.entries()).map(([busStopName, topPost]) => (
        <div
          key={busStopName}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2 justify-between">
            <span className="text-sm truncate">{busStopName}</span>
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200 break-keep">
              コミュニティによるメモ
            </span>
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-100 ruby-text">
            {topPost.content}
          </p>
        </div>
      ))}
    </div>
  );
}

// メモデータを取得するためのユーティリティ関数（PDF出力用）
export async function getBusStopMemoData(
  busStops: string[]
): Promise<Map<string, PostWithStats>> {
  if (!isDiscussionsEnabled() || busStops.length === 0) {
    return new Map();
  }

  const config = getDiscussionConfig();
  const nostrService = createNostrService({
    relays: config.relays,
    defaultTimeout: config.defaultTimeout ?? 5000,
  });

  try {
    const snapshot = await readBusStopModerationSnapshot(busStops, config);
    const projection = projectBusStopSnapshot({ primaryEvents: snapshot.primaryEvents, approvalEvents: snapshot.approvalEvents, busStops, approvalState: snapshot.approvalState });
    const approvedPostIds = projection.posts.map((p) => p.id);
    if (approvedPostIds.length === 0) return new Map();
    const evaluationsEvents = await nostrService.getEvaluationsForPosts(
      approvedPostIds
    );
    return projectBusStopSnapshot({ primaryEvents: snapshot.primaryEvents, approvalEvents: snapshot.approvalEvents, evaluationEvents: evaluationsEvents, busStops, approvalState: snapshot.approvalState }).topPostsByStop;
  } catch (error) {
    logger.error("Failed to load bus stop memo data:", error);
    return new Map();
  }
}
