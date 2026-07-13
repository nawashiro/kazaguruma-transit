"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getDiscussionConfig } from "@/lib/config/discussion-config";
import {
  createDiscussionModerationSnapshot,
  loadDiscussionModerationSnapshot,
  type DiscussionModerationSnapshot,
} from "@/lib/discussion/discussion-moderation-snapshot";
import {
  loadKnownDiscussionData,
  saveKnownDiscussionData,
} from "@/lib/discussion/discussion-known-data-cache";
import { createNostrService, type Event } from "@/lib/nostr/nostr-service";

interface UseBusStopModerationResult {
  snapshot: DiscussionModerationSnapshot | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const pendingReads = new Map<string, Promise<DiscussionModerationSnapshot>>();

const getCachedEvents = (discussionId: string): Event[] => {
  const cached = loadKnownDiscussionData<null, Event>(discussionId);
  return cached?.events ?? [];
};

export function readBusStopModerationSnapshot(
  busStops: string[],
  config: ReturnType<typeof getDiscussionConfig>,
): Promise<DiscussionModerationSnapshot> {
  const key = `${config.busStopDiscussionId}:${[...busStops].sort().join("|")}`;
  const pending = pendingReads.get(key);
  if (pending) return pending;

  const service = createNostrService({
    relays: config.relays,
    defaultTimeout: config.defaultTimeout ?? 5000,
  });
  const read = loadDiscussionModerationSnapshot(service, {
    relayLimit: 3,
    idleTimeoutMs: config.defaultTimeout ?? 5000,
    hardTimeoutMs: (config.defaultTimeout ?? 5000) * 3,
    dedupWindowMs: 250,
  }, {
    discussionId: config.busStopDiscussionId,
    configured: config.relays.filter((relay) => relay.read).map((relay) => relay.url),
    defaults: [],
    primaryTags: busStops,
  }).then((nextSnapshot) => {
    const events = [...nextSnapshot.primaryEvents, ...nextSnapshot.approvalEvents];
    saveKnownDiscussionData(config.busStopDiscussionId, {
      metadata: null,
      eventIds: events.map((event) => event.id),
      attemptedRelayUrls: nextSnapshot.attemptedRelayUrls,
      successfulEventRelayUrls: nextSnapshot.successfulRelayUrls,
      successfulRelays: [],
      events,
    });
    return nextSnapshot;
  }).finally(() => pendingReads.delete(key));
  pendingReads.set(key, read);
  return read;
}

export function useBusStopModeration(busStops: string[]): UseBusStopModerationResult {
  const config = useMemo(() => getDiscussionConfig(), []);
  const [snapshot, setSnapshot] = useState<DiscussionModerationSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (busStops.length === 0 || !config.busStopDiscussionId) {
      setSnapshot(null);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    const discussionId = config.busStopDiscussionId;
    const knownEvents = getCachedEvents(discussionId);
    const knownPrimary = knownEvents.filter((event) =>
      [1, 1111].includes(event.kind) &&
      event.tags.some((tag) => tag[0] === "#a" || (tag[0] === "a" && tag[1] === discussionId)) &&
      event.tags.some((tag) => tag[0] === "t" && busStops.includes(tag[1] ?? "")),
    );
    const knownIds = new Set(knownPrimary.map((event) => event.id));
    const knownApprovals = knownEvents.filter((event) =>
      event.kind === 4550 &&
      event.tags.some((tag) => tag[0] === "a" && tag[1] === discussionId) &&
      event.tags.some((tag) => tag[0] === "e" && knownIds.has(tag[1] ?? "")),
    );
    if (knownPrimary.length > 0) {
      setSnapshot(createDiscussionModerationSnapshot({
        discussionId,
        primaryEvents: knownPrimary,
        approvalEvents: knownApprovals,
        relayCandidates: [],
        attemptedRelayUrls: [],
        completionReason: "idle-timeout",
      }));
    }

    setIsLoading(true);
    setError(null);
    void readBusStopModerationSnapshot(busStops, config).then((nextSnapshot) => {
      if (!isCurrent) return;
      setSnapshot(nextSnapshot);
      setIsLoading(false);
    }).catch(() => {
      if (!isCurrent) return;
      setError("バス停の投稿データを取得できませんでした。");
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [busStops, config, reloadToken]);

  return { snapshot, isLoading, error, reload };
}
