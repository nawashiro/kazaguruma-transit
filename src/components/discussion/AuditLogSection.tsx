"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { AuditTimeline } from "@/components/discussion/AuditTimeline";
import {
  buildDisabledActionState,
  DisabledReasonText,
} from "@/components/discussion/PermissionGuards";
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
const AUDIT_PAGE_SIZE = 10;

interface AuditLogSectionProps {
  discussion?: Discussion | null;
  discussionInfo: {
    discussionId: string;
    authorPubkey: string;
    dTag: string;
  } | null;
  conversationAuditMode?: boolean;
  referencedDiscussions?: Discussion[];
  isDiscussionList?: boolean;
  loadDiscussionIndependently?: boolean;
  initialVisibleCount?: number;
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
      initialVisibleCount = AUDIT_PAGE_SIZE,
    },
    ref
  ) => {
    const [, setAuditEvaluations] = useState<PostEvaluation[]>([]);
    const [isAuditLoading, setIsAuditLoading] = useState(false);
    const [isAuditLoaded, setIsAuditLoaded] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
    const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
      {}
    );
    const [localReferencedDiscussions, setLocalReferencedDiscussions] = useState<
      Discussion[]
    >([]);
    const [independentDiscussion, setIndependentDiscussion] =
      useState<Discussion | null>(null);
    const [auditEvents, setAuditEvents] = useState<Event[]>([]);
    const [nextUntil, setNextUntil] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(false);

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
      async (until?: number): Promise<EventFetchCompletion> => {
        const targetDiscussion = getAuditDiscussionRef();
        const plan = createDiscussionReadPlan("discussion-audit", auditReadStrategy, {
          discussionId: targetDiscussion.discussionId,
          until,
          relayHints: [],
        });
        const relayUrls = selectRelayCandidates({
          hints: plan.relayHints,
          configured: nostrServiceConfig.relays.filter((relay) => relay.read).map((relay) => relay.url),
          defaults: [],
          limit: auditReadStrategy.relayLimit,
        }).map((relay) => relay.url);

        return await nostrService.getEventsWithCompletion(plan.filters as Parameters<typeof nostrService.getEventsWithCompletion>[0], {
          idleTimeoutMs: plan.idleTimeoutMs,
          hardTimeoutMs: plan.hardTimeoutMs,
          ...(relayUrls.length > 0 ? { relayUrls } : {}),
        });
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
      return Array.from(byId.values()).sort((a, b) => b.created_at - a.created_at);
    };

    const normalizePageSize = (events: Event[]): Event[] =>
      events.slice(0, AUDIT_PAGE_SIZE);

    const loadAuditData = useCallback(async () => {
      if (isAuditLoaded || isAuditLoading) return;

      setIsAuditLoading(true);
      setAuditError(null);
      setVisibleCount(initialVisibleCount);

      try {
        const cachedEvents = discussionInfo
          ? loadKnownDiscussionData<Discussion>(discussionInfo.discussionId)?.eventIds
          : [];
        if (cachedEvents && cachedEvents.length > 0) {
          logger.info("audit-log known events available", {
            discussionId: discussionInfo?.discussionId,
            eventCount: cachedEvents.length,
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
        const normalizedPage = normalizePageSize(pageResult.events);
        setAuditEvents(normalizedPage);
        if (discussionInfo) {
          saveKnownDiscussionData(discussionInfo.discussionId, {
            metadata: baseDiscussion,
            eventIds: normalizedPage.map((event) => event.id),
            successfulRelays: pageResult.relayUrls ?? [],
          });
        }
        await applyAuditEvents(normalizedPage, baseDiscussion);

        if (normalizedPage.length > 0) {
          const oldest = Math.min(...normalizedPage.map((event) => event.created_at));
          setNextUntil(oldest - 1);
        } else {
          setNextUntil(null);
        }
        setHasMore(pageResult.events.length >= AUDIT_PAGE_SIZE);
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
      initialVisibleCount,
      isAuditLoaded,
      isAuditLoading,
      isDiscussionList,
      loadDiscussionForAudit,
      loadDiscussionIndependently,
    ]);

    const loadMoreAuditData = useCallback(async () => {
      if (isAuditLoading || isLoadingMore || !hasMore || nextUntil === null) return;

      setIsLoadingMore(true);
      try {
        const baseDiscussion = discussion;
        const pageResult = await fetchAuditEventsPage(nextUntil);
        logger.info("audit-log load more completed", {
          discussionId: discussionInfo?.discussionId,
          completionReason: pageResult.completionReason,
          eventCount: pageResult.eventCount,
          elapsedMs: pageResult.elapsedMs,
        });
        const normalizedPage = normalizePageSize(pageResult.events);
        const merged = mergeEvents(auditEvents, normalizedPage);
        setAuditEvents(merged);
        await applyAuditEvents(merged, baseDiscussion);

        if (normalizedPage.length > 0) {
          const oldest = Math.min(...normalizedPage.map((event) => event.created_at));
          setNextUntil(oldest - 1);
        }
        if (pageResult.events.length < AUDIT_PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
        setVisibleCount((prev) => prev + AUDIT_PAGE_SIZE);
      } catch (error) {
        logger.error("Failed to load more audit data:", error);
        setAuditError("データの取得に失敗しました。再試行してください。");
      } finally {
        setIsLoadingMore(false);
      }
    }, [
      applyAuditEvents,
      auditEvents,
      discussion,
      fetchAuditEventsPage,
      hasMore,
      isAuditLoading,
      isLoadingMore,
      nextUntil,
    ]);

    const retryLoadAuditData = useCallback(() => {
      setIsAuditLoaded(false);
      setAuditError(null);
      setAuditEvents([]);
      setNextUntil(null);
      setHasMore(false);
      setVisibleCount(initialVisibleCount);
    }, [initialVisibleCount]);

    const auditItems = useMemo(
      () =>
        isDiscussionList
          ? mapListAuditTimeline(auditEvents)
          : mapDiscussionAuditTimeline(auditEvents),
      [auditEvents, isDiscussionList]
    );

    const visibleAuditItems = useMemo(
      () => auditItems.slice(0, visibleCount),
      [auditItems, visibleCount]
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
          className="btn btn-sm btn-outline"
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
      <section aria-labelledby="audit-screen-heading">
        <h2
          id="audit-screen-heading"
          className="text-xl font-semibold mb-4 ruby-text"
        >
          監査画面
        </h2>
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
                  items={visibleAuditItems}
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
                <div className="flex justify-center">
                  <button
                    className="btn btn-outline rounded-full dark:rounded-sm min-h-[44px] min-w-[44px]"
                    onClick={loadMoreAuditData}
                    disabled={!hasMore || isLoadingMore}
                    aria-describedby="audit-load-more-reason"
                  >
                    {isLoadingMore ? "読み込み中..." : "さらに過去10件を表示"}
                  </button>
                </div>
                <DisabledReasonText
                  state={buildDisabledActionState(
                    hasMore,
                    "これ以上表示できる監査ログはありません。"
                  )}
                  id="audit-load-more-reason"
                  className="text-xs text-center text-base-content/70"
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
