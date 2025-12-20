"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { AuditTimeline } from "@/components/discussion/AuditTimeline";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parsePostEvent,
  parseApprovalEvent,
  parseDiscussionEvent,
  createAuditTimeline,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  NostrProfile,
} from "@/types/discussion";
import { logger } from "@/utils/logger";
import { loadTestData, isTestMode } from "@/lib/test/test-data-loader";
import { NostrEvent } from "nosskey-sdk";

const nostrServiceConfig = getNostrServiceConfig();
const nostrService = createNostrService(nostrServiceConfig);

interface AuditLogSectionProps {
  discussion: Discussion | null;
  discussionInfo: {
    discussionId: string;
    authorPubkey: string;
    dTag: string;
  } | null;
  conversationAuditMode?: boolean;
  referencedDiscussions?: Discussion[];
  isDiscussionList?: boolean; // 会話一覧ページかどうかを示すフラグ
}

export const AuditLogSection = React.forwardRef<
  { loadAuditData: () => void },
  AuditLogSectionProps
>(({
  discussion,
  discussionInfo,
  conversationAuditMode = false,
  referencedDiscussions = [],
  isDiscussionList = false,
}, ref) => {
  // 監査ログ用の独立した状態
  const [auditPosts, setAuditPosts] = useState<DiscussionPost[]>([]);
  const [auditApprovals, setAuditApprovals] = useState<PostApproval[]>([]);
  const [, setAuditEvaluations] = useState<PostEvaluation[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [isAuditLoaded, setIsAuditLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
    {}
  );
  const [localReferencedDiscussions, setLocalReferencedDiscussions] = useState<Discussion[]>([]);
  const approvalStreamCleanupRef = useRef<(() => void) | null>(null);
  const postStreamCleanupRef = useRef<(() => void) | null>(null);
  const approvalEventsRef = useRef<any[]>([]);
  const postEventsRef = useRef<any[]>([]);

  // 個別会話ページ用のデータ取得
  const loadIndividualAuditData = useCallback(async () => {
    if (!discussionInfo) return;

    approvalStreamCleanupRef.current?.();
    postStreamCleanupRef.current?.();
    approvalEventsRef.current = [];
    postEventsRef.current = [];
    setAuditPosts([]);
    setAuditApprovals([]);
    setIsAuditLoading(true);

    const updateFromApprovals = (approvalsEvents: any[]) => {
      approvalEventsRef.current = approvalsEvents;
      const parsedApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const parsedPosts = postEventsRef.current
        .map((event) => parsePostEvent(event, parsedApprovals))
        .filter((p): p is DiscussionPost => p !== null);

      setAuditPosts(parsedPosts);
      setAuditApprovals(parsedApprovals);
      setLocalReferencedDiscussions(referencedDiscussions);
    };

    const postsStream = nostrService.streamEventsOnEvent(
      [
        {
          kinds: [1111, 1],
          "#a": [discussionInfo.discussionId],
        },
      ],
      {
        onEvent: (events) => {
          postEventsRef.current = events;
          updateFromApprovals(approvalEventsRef.current);
        },
        onEose: (events) => {
          postEventsRef.current = events;
          updateFromApprovals(approvalEventsRef.current);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
      }
    );

    approvalStreamCleanupRef.current = nostrService.streamApprovals(
      discussionInfo.discussionId,
      {
        onEvent: updateFromApprovals,
        onEose: (events) => {
          updateFromApprovals(events);
          setIsAuditLoaded(true);
          setIsAuditLoading(false);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
      }
    );

    postStreamCleanupRef.current = postsStream;
    updateFromApprovals([]);

    // 監査ログ用プロファイル取得（作成者・モデレーターのみ）
    const uniquePubkeys = new Set<string>();

    if (discussion) {
      uniquePubkeys.add(discussion.authorPubkey);
      discussion.moderators.forEach((mod) => uniquePubkeys.add(mod.pubkey));
    }

    referencedDiscussions.forEach((refDiscussion) => {
      uniquePubkeys.add(refDiscussion.authorPubkey);
      refDiscussion.moderators.forEach((mod) => uniquePubkeys.add(mod.pubkey));
    });

    if (uniquePubkeys.size > 0) {
      const eventPromises = await nostrService.getProfile([...uniquePubkeys]);

      const profilePromises = eventPromises.map((event: NostrEvent) => {
        const profile: NostrProfile = JSON.parse(event.content);
        const pubkey: string = event.pubkey || "";
        return [pubkey, { name: profile?.name }];
      });

      const profilesMap = Object.fromEntries(profilePromises);

      setProfiles(profilesMap);
    } else {
      setProfiles({});
    }

    logger.info("Individual audit data loaded");
  }, [discussionInfo, discussion, referencedDiscussions]);

  // 会話一覧ページ用のデータ取得
  const loadDiscussionListAuditData = useCallback(async () => {
    const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
    if (!discussionListNaddr) {
      logger.error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
      throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
    }

    const listDiscussionInfo = extractDiscussionFromNaddr(discussionListNaddr);
    if (!listDiscussionInfo) {
      throw new Error("Invalid DISCUSSION_LIST_NADDR format");
    }

    approvalStreamCleanupRef.current?.();
    postStreamCleanupRef.current?.();
    approvalEventsRef.current = [];
    postEventsRef.current = [];
    setAuditPosts([]);
    setAuditApprovals([]);
    setIsAuditLoading(true);

    const updateFromApprovals = async (approvalsEvents: any[]) => {
      approvalEventsRef.current = approvalsEvents;
      const listApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null);

      const listPosts = postEventsRef.current
        .map((event) => parsePostEvent(event, listApprovals))
        .filter((p): p is DiscussionPost => p !== null);

      const individualDiscussionRefs = new Set<string>();
      listPosts.forEach((post) => {
        const qTags = post.event?.tags?.filter((tag) => tag[0] === "q") || [];
        qTags.forEach((qTag) => {
          if (qTag[1] && qTag[1].startsWith("34550:")) {
            individualDiscussionRefs.add(qTag[1]);
          }
        });
      });

      let nextReferenced: Discussion[] = [];
      if (individualDiscussionRefs.size > 0) {
        const individualDiscussions =
          await nostrService.getReferencedUserDiscussions(
            Array.from(individualDiscussionRefs)
          );
        nextReferenced = individualDiscussions
          .map(parseDiscussionEvent)
          .filter((d): d is Discussion => d !== null);
      }

      setAuditPosts(listPosts);
      setAuditApprovals(listApprovals);
      setLocalReferencedDiscussions(nextReferenced);

      const uniquePubkeys = new Set<string>();
      nextReferenced.forEach((discussion) => {
        uniquePubkeys.add(discussion.authorPubkey);
        discussion.moderators.forEach((mod) =>
          uniquePubkeys.add(mod.pubkey)
        );
      });

      if (uniquePubkeys.size > 0) {
        const profilePromises = Array.from(uniquePubkeys).map(
          async (pubkey) => {
            const profileEvents = await nostrService.getProfile([pubkey]);
            if (profileEvents && profileEvents.length > 0) {
              try {
                const profile = JSON.parse(profileEvents[0].content);
                return [pubkey, { name: profile.name || profile.display_name }];
              } catch {
                return [pubkey, {}];
              }
            }
            return [pubkey, {}];
          }
        );

        const profileResults = await Promise.all(profilePromises);
        const profilesMap = Object.fromEntries(profileResults);
        setProfiles(profilesMap);
      } else {
        setProfiles({});
      }
    };

    const postStream = nostrService.streamEventsOnEvent(
      [
        {
          kinds: [1111, 1],
          "#a": [listDiscussionInfo.discussionId],
        },
      ],
      {
        onEvent: (events) => {
          postEventsRef.current = events;
          updateFromApprovals(approvalEventsRef.current);
        },
        onEose: (events) => {
          postEventsRef.current = events;
          updateFromApprovals(approvalEventsRef.current);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
      }
    );

    approvalStreamCleanupRef.current = nostrService.streamApprovals(
      listDiscussionInfo.discussionId,
      {
        onEvent: updateFromApprovals,
        onEose: (events) => {
          updateFromApprovals(events);
          setIsAuditLoaded(true);
          setIsAuditLoading(false);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
      }
    );

    postStreamCleanupRef.current = postStream;

    logger.info("Discussion list audit data streaming started");
  }, []);

  // 監査ログ専用のデータ取得
  const loadAuditData = useCallback(async () => {
    if (isAuditLoaded || isAuditLoading) return;

    if (!isDiscussionList && !discussionInfo) return;

    setIsAuditLoading(true);
    try {
      // Check if this is test mode (for backward compatibility)
      if (discussionInfo && isTestMode(discussionInfo.dTag)) {
        const testData = await loadTestData();
        setAuditPosts(testData.posts);
        setAuditApprovals([]);
        setAuditEvaluations(testData.evaluations);
        setLocalReferencedDiscussions([]);
        setIsAuditLoaded(true);
        return;
      }

      if (isDiscussionList) {
        await loadDiscussionListAuditData();
      } else {
        await loadIndividualAuditData();
      }

      setIsAuditLoaded(true);
    } catch (error) {
      logger.error("Failed to load audit data:", error);
    } finally {
      setIsAuditLoading(false);
    }
  }, [discussionInfo, isAuditLoaded, isAuditLoading, isDiscussionList, loadDiscussionListAuditData, loadIndividualAuditData]);

  const auditItems = useMemo(
    () =>
      createAuditTimeline(
        isDiscussionList ? localReferencedDiscussions : (discussion ? [discussion] : []),
        [],
        auditPosts,
        auditApprovals
      ),
    [isDiscussionList, localReferencedDiscussions, discussion, auditPosts, auditApprovals]
  );

  useEffect(() => {
    return () => {
      approvalStreamCleanupRef.current?.();
      postStreamCleanupRef.current?.();
    };
  }, []);

  // refを通じて外部からloadAuditDataを呼び出せるようにする
  React.useImperativeHandle(ref, () => ({
    loadAuditData,
  }), [loadAuditData]);

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
          {isAuditLoading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                ></div>
              ))}
            </div>
          ) : (
            <AuditTimeline
              items={auditItems}
              profiles={profiles}
              referencedDiscussions={isDiscussionList ? localReferencedDiscussions : (referencedDiscussions.length > 0 ? referencedDiscussions : (discussion ? [discussion] : []))}
              conversationAuditMode={conversationAuditMode}
            />
          )}
        </div>
      </div>
    </section>
  );
});

AuditLogSection.displayName = "AuditLogSection";
