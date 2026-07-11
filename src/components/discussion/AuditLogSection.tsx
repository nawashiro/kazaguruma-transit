"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { AuditTimeline } from "@/components/discussion/AuditTimeline";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parsePostEvent,
  parseApprovalEvent,
  parseDiscussionEvent,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { getDiscussionReadStrategyConfig, getNostrServiceConfig } from "@/lib/config/discussion-config";
import { createDiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import { selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";
import {
  loadKnownDiscussionData,
  saveKnownDiscussionData,
} from "@/lib/discussion/discussion-known-data-cache";
import {
  mapDiscussionAuditTimeline,
  mapListAuditTimeline,
} from "@/lib/discussion/audit-timeline-mapper";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  NostrProfile,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import { loadTestData, isTestMode } from "@/lib/test/test-data-loader";
import type { Event, EventFetchCompletion } from "@/lib/nostr/nostr-service";
import { NostrEvent } from "nosskey-sdk";

const nostrServiceConfig = getNostrServiceConfig();
const auditReadStrategy =
  typeof getDiscussionReadStrategyConfig === "function"
    ? getDiscussionReadStrategyConfig()
    : { relayLimit: 3, idleTimeoutMs: nostrServiceConfig.defaultTimeout, hardTimeoutMs: nostrServiceConfig.defaultTimeout * 3, dedupWindowMs: 250 };
const nostrService = createNostrService(nostrServiceConfig);
interface AuditLogSectionProps {
  discussion?: Discussion | null;
  discussionInfo: {
    discussionId: string;
    authorPubkey: string;
    dTag: string;
    relays?: string[];
  } | null;
  conversationAuditMode?: boolean;
  referencedDiscussions?: Discussion[];
  isDiscussionList?: boolean;
  loadDiscussionIndependently?: boolean;
}

export const AuditLogSection = React.forwardRef<
  { loadAuditData: () => void; retryLoadAuditData: () => void },
  AuditLogSectionProps
>(
  (
    {
      discussion: discussionProp,
      discussionInfo,
      conversationAuditMode = false,
      referencedDiscussions = [],
      isDiscussionList = false,
      loadDiscussionIndependently = false,
    },
    ref
  ) => {
    const [, setAuditEvaluations] = useState<PostEvaluation[]>([]);
    const [isAuditLoading, setIsAuditLoading] = useState(false);
    const [isAuditLoaded, setIsAuditLoaded] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
      {}
    );
    const [localReferencedDiscussions, setLocalReferencedDiscussions] = useState<
      Discussion[]
    >([]);
    const [independentDiscussion, setIndependentDiscussion] =
      useState<Discussion | null>(null);
    const [auditEvents, setAuditEvents] = useState<Event[]>([]);

    const discussion = loadDiscussionIndependently
      ? independentDiscussion
      : discussionProp ?? null;

    const getAuditDiscussionRef = useCallback(() => {
      if (isDiscussionList) {
        const listNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
        if (!listNaddr) {
          throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
        }
        const extracted = extractDiscussionFromNaddr(listNaddr);
        if (!extracted) {
          throw new Error("Invalid DISCUSSION_LIST_NADDR format");
        }
        return extracted;
      }
      if (!discussionInfo) {
        throw new Error("Discussion info is not available");
      }
      return discussionInfo;
    }, [discussionInfo, isDiscussionList]);

    const loadDiscussionForAudit = useCallback(async (): Promise<Discussion | null> => {
      if (!discussionInfo) return null;

      try {
        const discussionEvents = await nostrService.getReferencedUserDiscussions([
          discussionInfo.discussionId,
        ]);

        if (discussionEvents && discussionEvents.length > 0) {
          return parseDiscussionEvent(discussionEvents[0]);
        }
        return null;
      } catch (error) {
        logger.error("Failed to load discussion for audit page:", error);
        return null;
      }
    }, [discussionInfo]);

    const fetchAuditEventsPage = useCallback(
      async (): Promise<EventFetchCompletion> => {
        const targetDiscussion = getAuditDiscussionRef();
        const knownData = loadKnownDiscussionData<Discussion, Event>(targetDiscussion.discussionId);
        const plan = createDiscussionReadPlan("discussion-audit", auditReadStrategy, {
          discussionId: targetDiscussion.discussionId,
          relayHints: targetDiscussion.relays,
        });
        const relayUrls = selectRelayCandidates({
          hints: plan.relayHints,
          successful: knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays,
          configured: nostrServiceConfig.relays.filter((relay) => relay.read).map((relay) => relay.url),
          defaults: [],
          limit: auditReadStrategy.relayLimit,
        }).map((relay) => relay.url);

        const options = {
          idleTimeoutMs: plan.idleTimeoutMs,
          hardTimeoutMs: plan.hardTimeoutMs,
          ...(relayUrls.length > 0 ? { relayUrls } : {}),
        };
        const primaryResult = await nostrService.getEventsWithCompletion(plan.filters as Parameters<typeof nostrService.getEventsWithCompletion>[0], options);
        const postIds = primaryResult.events.map((event) => event.id);
        if (postIds.length === 0) return primaryResult;
        const approvalResult = await nostrService.getEventsWithCompletion([{
          kinds: [4550],
          "#a": [targetDiscussion.discussionId],
          "#e": postIds,
        }], options);
        return {
          ...primaryResult,
          events: mergeEvents(primaryResult.events, approvalResult.events),
          eventCount: primaryResult.eventCount,
          completionReason: primaryResult.completionReason === "eose" && approvalResult.completionReason === "eose" ? "eose" : primaryResult.completionReason,
        };
      },
      [getAuditDiscussionRef]
    );

    const updateProfiles = useCallback(
      async (baseDiscussion: Discussion | null, posts: DiscussionPost[]) => {
        if (isDiscussionList) {
          const refs = new Set<string>();
          posts.forEach((post) => {
            const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
            qTags.forEach((qTag) => {
              if (qTag[1] && qTag[1].startsWith("34550:")) {
                refs.add(qTag[1]);
              }
            });
          });

          let nextReferenced: Discussion[] = [];
          if (refs.size > 0) {
            const discussionEvents = await nostrService.getReferencedUserDiscussions(
              Array.from(refs)
            );
            nextReferenced = discussionEvents
              .map(parseDiscussionEvent)
              .filter((d): d is Discussion => d !== null);
          }
          setLocalReferencedDiscussions(nextReferenced);

          const uniquePubkeys = new Set<string>();
          nextReferenced.forEach((refDiscussion) => {
            uniquePubkeys.add(refDiscussion.authorPubkey);
            refDiscussion.moderators.forEach((mod) => uniquePubkeys.add(mod.pubkey));
          });

          if (uniquePubkeys.size === 0) {
            setProfiles({});
            return;
          }

          const profilePromises = Array.from(uniquePubkeys).map(async (pubkey) => {
            const profileEvents = await nostrService.getProfile([pubkey]);
            if (profileEvents && profileEvents.length > 0) {
              try {
                const profile: NostrProfile = JSON.parse(profileEvents[0].content);
                return [pubkey, { name: profile.name || (profile as { display_name?: string }).display_name }];
              } catch {
                return [pubkey, {}];
              }
            }
            return [pubkey, {}];
          });
          setProfiles(Object.fromEntries(await Promise.all(profilePromises)));
          return;
        }

        setLocalReferencedDiscussions(referencedDiscussions);

        const uniquePubkeys = new Set<string>();
        if (baseDiscussion) {
          uniquePubkeys.add(baseDiscussion.authorPubkey);
          baseDiscussion.moderators.forEach((mod) => uniquePubkeys.add(mod.pubkey));
        }
        referencedDiscussions.forEach((refDiscussion) => {
          uniquePubkeys.add(refDiscussion.authorPubkey);
          refDiscussion.moderators.forEach((mod) => uniquePubkeys.add(mod.pubkey));
        });

        if (uniquePubkeys.size === 0) {
          setProfiles({});
          return;
        }

        const profileEvents = await nostrService.getProfile([...uniquePubkeys]);
        const profileEntries = profileEvents.map((event: NostrEvent) => {
          try {
            const profile: NostrProfile = JSON.parse(event.content);
            return [event.pubkey || "", { name: profile?.name }];
          } catch {
            return [event.pubkey || "", {}];
          }
        });
        setProfiles(Object.fromEntries(profileEntries));
      },
      [isDiscussionList, referencedDiscussions]
    );

    const applyAuditEvents = useCallback(
      async (events: Event[], baseDiscussion: Discussion | null) => {
        const parsedApprovals = events
          .map(parseApprovalEvent)
          .filter((approval): approval is PostApproval => approval !== null);

        const parsedPosts = events
          .map((event) => parsePostEvent(event, parsedApprovals))
          .filter((post): post is DiscussionPost => post !== null);

        await updateProfiles(baseDiscussion, parsedPosts);
      },
      [updateProfiles]
    );

    const mergeEvents = (current: Event[], incoming: Event[]): Event[] => {
      const byId = new Map<string, Event>();
      [...current, ...incoming].forEach((event) => {
        const existing = byId.get(event.id);
        if (!existing || event.created_at > existing.created_at) {
          byId.set(event.id, event);
        }
      });
      return Array.from(byId.values()).sort(
        (left, right) =>
          right.created_at - left.created_at || left.id.localeCompare(right.id)
      );
    };

    const loadAuditData = useCallback(async () => {
      if (isAuditLoaded || isAuditLoading) return;

      setIsAuditLoading(true);
      setAuditError(null);

      try {
        const cachedData = discussionInfo
          ? loadKnownDiscussionData<Discussion, Event>(discussionInfo.discussionId)
          : null;
        if (cachedData?.events?.length) {
          setAuditEvents(cachedData.events);
          void applyAuditEvents(cachedData.events, discussion);
          logger.info("audit-log known events available", {
            discussionId: discussionInfo?.discussionId,
            eventCount: cachedData.events.length,
          });
        }
        let baseDiscussion = discussion;
        if (!isDiscussionList && loadDiscussionIndependently && !baseDiscussion) {
          baseDiscussion = await loadDiscussionForAudit();
          if (baseDiscussion) {
            setIndependentDiscussion(baseDiscussion);
          }
        }

        if (discussionInfo && isTestMode(discussionInfo.dTag)) {
          const testData = await loadTestData();
          setAuditEvaluations(testData.evaluations);
          setLocalReferencedDiscussions([]);
          setIsAuditLoaded(true);
          return;
        }

        const pageResult = await fetchAuditEventsPage();
        logger.info("audit-log initial fetch completed", {
          discussionId: discussionInfo?.discussionId,
          completionReason: pageResult.completionReason,
          eventCount: pageResult.eventCount,
          elapsedMs: pageResult.elapsedMs,
        });
        setAuditEvents(pageResult.events);
        if (discussionInfo) {
          saveKnownDiscussionData(discussionInfo.discussionId, {
            metadata: baseDiscussion,
            eventIds: pageResult.events.map((event) => event.id),
            attemptedRelayUrls: pageResult.relayUrls ?? [],
            successfulEventRelayUrls: Array.from(new Set(Object.values(pageResult.sourceRelayUrlsByEventId ?? {}).flat())),
            successfulRelays: [],
            events: pageResult.events,
          });
        }
        await applyAuditEvents(pageResult.events, baseDiscussion);
        setIsAuditLoaded(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "不明なエラー";
        logger.error("Failed to load audit data:", errorMessage);
        setAuditError("データの取得に失敗しました。再試行してください。");
      } finally {
        setIsAuditLoading(false);
      }
    }, [
      applyAuditEvents,
      discussion,
      discussionInfo,
      fetchAuditEventsPage,
      isAuditLoaded,
      isAuditLoading,
      isDiscussionList,
      loadDiscussionForAudit,
      loadDiscussionIndependently,
    ]);

    const retryLoadAuditData = useCallback(() => {
      setIsAuditLoaded(false);
      setAuditError(null);
      setAuditEvents([]);
    }, []);

    const auditItems = useMemo(
      () =>
        isDiscussionList
          ? mapListAuditTimeline(auditEvents)
          : mapDiscussionAuditTimeline(auditEvents),
      [auditEvents, isDiscussionList]
    );

    useEffect(() => {
      return () => {
        // reserved for future cancellation hooks
      };
    }, []);

    React.useImperativeHandle(
      ref,
      () => ({
        loadAuditData,
        retryLoadAuditData,
      }),
      [loadAuditData, retryLoadAuditData]
    );

    const renderError = () => (
      <div className="alert alert-error" role="alert">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{auditError}</span>
        <button
          className="btn btn-outline"
          onClick={() => {
            retryLoadAuditData();
            setTimeout(() => loadAuditData(), 0);
          }}
        >
          再試行
        </button>
      </div>
    );

    return (
      <section>
        <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="card-body">
            {auditError ? (
              renderError()
            ) : isAuditLoading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                  ></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <AuditTimeline
                  items={auditItems}
                  profiles={profiles}
                  referencedDiscussions={
                    isDiscussionList
                      ? localReferencedDiscussions
                      : referencedDiscussions.length > 0
                        ? referencedDiscussions
                        : discussion
                          ? [discussion]
                          : []
                  }
                  conversationAuditMode={conversationAuditMode}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
);

AuditLogSection.displayName = "AuditLogSection";
