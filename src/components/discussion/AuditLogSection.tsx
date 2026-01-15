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
  discussion?: Discussion | null;
  discussionInfo: {
    discussionId: string;
    authorPubkey: string;
    dTag: string;
  } | null;
  conversationAuditMode?: boolean;
  referencedDiscussions?: Discussion[];
  isDiscussionList?: boolean; // 会話一覧ページかどうかを示すフラグ
  loadDiscussionIndependently?: boolean; // 監査ページで独自にkind:34550を取得するフラグ
}

export const AuditLogSection = React.forwardRef<
  { loadAuditData: () => void },
  AuditLogSectionProps
>(({
  discussion: discussionProp,
  discussionInfo,
  conversationAuditMode = false,
  referencedDiscussions = [],
  isDiscussionList = false,
  loadDiscussionIndependently = false,
}, ref) => {
  // 監査ログ用の独立した状態
  const [auditPosts, setAuditPosts] = useState<DiscussionPost[]>([]);
  const [auditApprovals, setAuditApprovals] = useState<PostApproval[]>([]);
  const [, setAuditEvaluations] = useState<PostEvaluation[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [isAuditLoaded, setIsAuditLoaded] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { name?: string }>>(
    {}
  );
  const [localReferencedDiscussions, setLocalReferencedDiscussions] = useState<Discussion[]>([]);
  // 独自に取得したDiscussion
  const [independentDiscussion, setIndependentDiscussion] = useState<Discussion | null>(null);
  const approvalStreamCleanupRef = useRef<(() => void) | null>(null);
  const postStreamCleanupRef = useRef<(() => void) | null>(null);
  const approvalEventsRef = useRef<any[]>([]);
  const postEventsRef = useRef<any[]>([]);

  // 使用するdiscussionを決定（独自取得した場合はそちらを優先）
  const discussion = loadDiscussionIndependently ? independentDiscussion : (discussionProp ?? null);

  /**
   * kind:34550（Discussion）を独自に取得する
   * FR-016: 監査ページはメイン画面に依存せず独自にDiscussionを取得する
   */
  const loadDiscussionForAudit = useCallback(async (): Promise<Discussion | null> => {
    if (!discussionInfo) return null;

    try {
      logger.info("Loading discussion independently for audit page", {
        discussionId: discussionInfo.discussionId,
      });

      // getReferencedUserDiscussionsを使用してkind:34550を取得
      const discussionEvents = await nostrService.getReferencedUserDiscussions([
        discussionInfo.discussionId,
      ]);

      if (discussionEvents && discussionEvents.length > 0) {
        const parsed = parseDiscussionEvent(discussionEvents[0]);
        if (parsed) {
          logger.info("Discussion loaded independently", { id: parsed.id });
          return parsed;
        }
      }

      logger.warn("No discussion found for audit page", {
        discussionId: discussionInfo.discussionId,
      });
      return null;
    } catch (error) {
      logger.error("Failed to load discussion for audit page:", error);
      return null;
    }
  }, [discussionInfo]);

  // 個別会話ページ用のデータ取得
  const loadIndividualAuditData = useCallback(async () => {
    if (!discussionInfo) return;

    // loadDiscussionIndependentlyがtrueの場合、先にDiscussionを取得
    let currentDiscussion = discussion;
    if (loadDiscussionIndependently && !currentDiscussion) {
      currentDiscussion = await loadDiscussionForAudit();
      if (currentDiscussion) {
        setIndependentDiscussion(currentDiscussion);
      }
    }

    if (!currentDiscussion) {
      logger.warn("No discussion available for audit data loading");
      return;
    }

    approvalStreamCleanupRef.current?.();
    postStreamCleanupRef.current?.();
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

    if (currentDiscussion) {
      uniquePubkeys.add(currentDiscussion.authorPubkey);
      currentDiscussion.moderators.forEach((mod) => uniquePubkeys.add(mod.pubkey));
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
  }, [discussionInfo, discussion, referencedDiscussions, loadDiscussionIndependently, loadDiscussionForAudit]);

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

  /**
   * 監査ログ専用のデータ取得
   * エラーハンドリングとログ出力を含む（FR-007, FR-008, FR-009, FR-010）
   */
  const loadAuditData = useCallback(async () => {
    if (isAuditLoaded || isAuditLoading) return;

    setIsAuditLoading(true);
    setAuditError(null);

    try {
      logger.info("Starting audit data loading", {
        isDiscussionList,
        loadDiscussionIndependently,
        hasDiscussionInfo: !!discussionInfo,
      });

      // Check if this is test mode (for backward compatibility)
      if (discussionInfo && isTestMode(discussionInfo.dTag)) {
        const testData = await loadTestData();
        setAuditPosts(testData.posts);
        setAuditApprovals([]);
        setAuditEvaluations(testData.evaluations);
        setLocalReferencedDiscussions([]);
        setIsAuditLoaded(true);
        logger.info("Test mode audit data loaded");
        return;
      }

      if (isDiscussionList) {
        await loadDiscussionListAuditData();
      } else {
        await loadIndividualAuditData();
      }

      setIsAuditLoaded(true);
      logger.info("Audit data loading completed successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      logger.error("Failed to load audit data:", {
        error: errorMessage,
        isDiscussionList,
        discussionId: discussionInfo?.discussionId,
      });
      setAuditError("データの取得に失敗しました。再試行してください。");
      // FR-009: エラー時は空データを設定し、ローディング状態を終了
      setAuditPosts([]);
      setAuditApprovals([]);
    } finally {
      setIsAuditLoading(false);
    }
  }, [discussionInfo, isAuditLoaded, isAuditLoading, isDiscussionList, loadDiscussionListAuditData, loadIndividualAuditData, loadDiscussionIndependently]);

  /**
   * 再試行機能（FR-015）
   */
  const retryLoadAuditData = useCallback(() => {
    setIsAuditLoaded(false);
    setAuditError(null);
    // 状態リセット後に次のレンダーで呼び出されるよう、直接は呼ばない
    // useEffectで自動的にloadAuditDataが呼ばれる
  }, []);

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

  // refを通じて外部からloadAuditDataと再試行を呼び出せるようにする
  React.useImperativeHandle(ref, () => ({
    loadAuditData,
    retryLoadAuditData,
  }), [loadAuditData, retryLoadAuditData]);

  // エラー表示コンポーネント（FR-014, FR-015）
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
          // 状態リセット後にloadAuditDataを呼ぶ
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
