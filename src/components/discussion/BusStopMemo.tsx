"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  getDiscussionConfig,
  isDiscussionsEnabled,
} from "@/lib/config/discussion-config";
import {
  parsePostEvent,
  parseApprovalEvent,
  parseEvaluationEvent,
  combinePostsWithStats,
  sortPostsByScore,
} from "@/lib/nostr/nostr-utils";
import type {
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  PostWithStats,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import type { Event } from "nostr-tools";

interface BusStopMemoProps {
  busStops: string[];
  className?: string;
}

export function BusStopMemo({ busStops, className = "" }: BusStopMemoProps) {
  const [topPostsByStop, setTopPostsByStop] = useState<
    Map<string, PostWithStats>
  >(new Map());
  const postsEventsRef = useRef<Event[]>([]);
  const approvalEventsRef = useRef<Event[]>([]);
  const approvalsStreamCleanupRef = useRef<() => void>();
  const approvalsForDiscussionCleanupRef = useRef<() => void>();

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


  const updateFromEvents = useCallback(
    async (
      postEvents: Event[],
      approvalsEvents: Event[],
      fetchEvaluations: boolean
    ) => {
      const parsedApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const parsedPosts = postEvents
        .map((event) => parsePostEvent(event, parsedApprovals))
        .filter((p): p is DiscussionPost => p !== null)
        .filter(
          (p) => p.approved && p.busStopTag && busStops.includes(p.busStopTag)
        );

      let parsedEvaluations: PostEvaluation[] = [];
      if (fetchEvaluations && parsedPosts.length > 0) {
        const approvedPostIds = parsedPosts.map((p) => p.id);
        const evaluationsEvents = await nostrService.getEvaluationsForPosts(
          approvedPostIds
        );

        parsedEvaluations = evaluationsEvents
          .map(parseEvaluationEvent)
          .filter((e): e is PostEvaluation => e !== null);
      }

      const postsWithStats = combinePostsWithStats(
        parsedPosts,
        parsedEvaluations
      );

      const topPostsMap = new Map<string, PostWithStats>();
      busStops.forEach((stopName) => {
        const stopPosts = postsWithStats.filter(
          (p) => p.busStopTag === stopName
        );
        const sortedStopPosts = sortPostsByScore(stopPosts);
        if (sortedStopPosts.length > 0) {
          topPostsMap.set(stopName, sortedStopPosts[0]);
        }
      });
      setTopPostsByStop(topPostsMap);
    },
    [busStops, nostrService]
  );

  const loadMemoData = useCallback(() => {
    if (busStops.length === 0) {
      setTopPostsByStop(new Map());
      return;
    }

    approvalsStreamCleanupRef.current?.();
    approvalsForDiscussionCleanupRef.current?.();
    approvalEventsRef.current = [];
    postsEventsRef.current = [];

    const postFilters =
      busStops.length > 0
        ? busStops.map((stop) => ({
            kinds: [1111, 1],
            "#a": [config.busStopDiscussionId],
            "#t": [stop],
          }))
        : [
            {
              kinds: [1111, 1],
              "#a": [config.busStopDiscussionId],
            },
          ];

    const postStreamCleanup = nostrService.streamEventsOnEvent(postFilters, {
      onEvent: (events) => {
        postsEventsRef.current = events;
        updateFromEvents(events, approvalEventsRef.current, false);
      },
      onEose: (events) => {
        postsEventsRef.current = events;
        updateFromEvents(events, approvalEventsRef.current, true);
      },
      timeoutMs: config.defaultTimeout ?? 5000,
    });

    const approvalsStreamCleanup = nostrService.streamApprovals(
      config.busStopDiscussionId,
      {
        onEvent: (events) => {
          approvalEventsRef.current = events;
          updateFromEvents(postsEventsRef.current, events, false);
        },
        onEose: (events) => {
          approvalEventsRef.current = events;
          updateFromEvents(postsEventsRef.current, events, true);
        },
        timeoutMs: config.defaultTimeout ?? 5000,
      }
    );

    approvalsStreamCleanupRef.current = postStreamCleanup;
    approvalsForDiscussionCleanupRef.current = approvalsStreamCleanup;
    updateFromEvents([], [], false);
  }, [
    busStops,
    config.busStopDiscussionId,
    config.defaultTimeout,
    nostrService,
    updateFromEvents,
  ]);

  useEffect(() => {
    if (discussionsEnabled) {
      loadMemoData();
    }

    return () => {
      approvalsStreamCleanupRef.current?.();
      approvalsForDiscussionCleanupRef.current?.();
    };
  }, [discussionsEnabled, loadMemoData]);

  if (
    !discussionsEnabled ||
    busStops.length === 0 ||
    topPostsByStop.size === 0
  ) {
    return null;
  }

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
    defaultTimeout: 5000,
  });

  try {
    const postsEvents = await nostrService.getDiscussionPosts(
      config.busStopDiscussionId,
      busStops
    );

    const postIds = postsEvents.map((event) => event.id);

    const approvalsEvents = await nostrService.getApprovalsForPosts(
      postIds,
      config.busStopDiscussionId
    );

    const parsedApprovals = approvalsEvents
      .map(parseApprovalEvent)
      .filter((a): a is PostApproval => a !== null);

    const parsedPosts = postsEvents
      .map((event) => parsePostEvent(event, parsedApprovals))
      .filter((p): p is DiscussionPost => p !== null)
      .filter(
        (p) => p.approved && p.busStopTag && busStops.includes(p.busStopTag)
      );

    const approvedPostIds = parsedPosts.map((p) => p.id);
    const evaluationsEvents = await nostrService.getEvaluationsForPosts(
      approvedPostIds
    );

    const parsedEvaluations = evaluationsEvents
      .map(parseEvaluationEvent)
      .filter((e): e is PostEvaluation => e !== null);

    const postsWithStats = combinePostsWithStats(
      parsedPosts,
      parsedEvaluations
    );

    const topPostsMap = new Map<string, PostWithStats>();
    busStops.forEach((stopName) => {
      const stopPosts = postsWithStats.filter((p) => p.busStopTag === stopName);
      const sortedStopPosts = sortPostsByScore(stopPosts);
      if (sortedStopPosts.length > 0) {
        topPostsMap.set(stopName, sortedStopPosts[0]);
      }
    });

    return topPostsMap;
  } catch (error) {
    logger.error("Failed to load bus stop memo data:", error);
    return new Map();
  }
}
