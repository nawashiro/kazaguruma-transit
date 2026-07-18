"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { type CompletionReason } from "@/lib/nostr/nostr-service";
import { getDiscussionReadStrategyConfig, getNostrServiceConfig } from "@/lib/config/discussion-config";
import { parseDiscussionEvent } from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { loadTestData, isTestMode } from "@/lib/test/test-data-loader";
import { logger } from "@/utils/logger";
import type { Discussion } from "@/types/discussion";
import {
  createDiscussionNdkGateway,
  type NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";
import { createDiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";
import { loadKnownDiscussionData, saveKnownDiscussionData } from "@/lib/discussion/discussion-known-data-cache";
import { selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";
import { DiscussionMetaReadState } from "@/components/discussion/DiscussionMetaReadState";
import { useAuth } from "@/lib/auth/auth-context";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

interface DiscussionTabLayoutProps {
  /** タブナビゲーションのベースURL（例: "/discussions" または "/discussions/[naddr]"） */
  baseHref: string;
  /** 動的ルートを持たない管理画面が明示的に使用する会話 naddr */
  naddr?: string;
  /** 会話固有の戻るリンク・見出し・タブを表示するか */
  showNavigation?: boolean;
  /** 子コンポーネント（ページコンテンツ） */
  children: React.ReactNode;
}

interface DiscussionMetaContextValue {
  discussion: Discussion | null;
  isLoading: boolean;
  error: string | null;
  completionReason: CompletionReason | null;
  reload: () => Promise<void>;
}

const discussionConfig = getNostrServiceConfig();
const discussionReadStrategy =
  typeof getDiscussionReadStrategyConfig === "function"
    ? getDiscussionReadStrategyConfig()
    : { relayLimit: 3, idleTimeoutMs: discussionConfig.defaultTimeout, hardTimeoutMs: discussionConfig.defaultTimeout * 3, dedupWindowMs: 250 };
const discussionGateway = createDiscussionNdkGateway(discussionConfig);
const DiscussionMetaContext = React.createContext<
  DiscussionMetaContextValue | undefined
>(undefined);

export function useDiscussionMeta(): DiscussionMetaContextValue | undefined {
  return React.useContext(DiscussionMetaContext);
}

/**
 * 会話ページと監査ページを切り替えるタブナビゲーションを提供するレイアウトコンポーネント
 *
 * データ取得機能:
 * - 会話タイトル・説明・戻るリンクをレイアウトレベルで表示
 * - streamDiscussionMeta による実時間データ取得
 * - 段階的ローディング（タブ+戻るリンク → タイトル+説明）
 * - エラー時もタブナビゲーションを維持
 *
 * WCAG 2.1 AA準拠:
 * - role="tablist" / role="tab" / aria-selected 属性
 * - Arrow/Home/End キーボードナビゲーション
 * - 最小44px×44px タッチターゲット
 * - フォーカスインジケーター
 * - ローディング/エラー状態のARIA属性
 */
export function DiscussionTabLayout({
  baseHref,
  naddr: explicitNaddr,
  showNavigation = true,
  children,
}: DiscussionTabLayoutProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const params = useParams();
  const naddr = explicitNaddr ?? (params.naddr as string);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // 会話データの状態 (T011)
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const [discussionCompletionReason, setDiscussionCompletionReason] =
    useState<CompletionReason | null>(null);
  const loadSequenceRef = useRef(0);

  // NADDR から discussionInfo を抽出 (T012)
  const discussionInfo = useMemo(() => {
    if (!naddr) return null;
    return extractDiscussionFromNaddr(naddr);
  }, [naddr]);

  /**
   * 最新のディスカッションを選択 (T013, T040)
   *
   * 複数のNostrイベントから最も新しい createdAt を持つディスカッションを返します。
   * Nostrプロトコルでは同じ会話が複数のイベントとして更新される可能性があるため、
   * タイムスタンプが最新のものを選択することで最新の状態を取得します。
   *
   * @param events - パースするNostr Event配列（kind:34550）
   * @returns 最新のDiscussionオブジェクト、またはパース可能なイベントがない場合はnull
   */
  const pickLatestDiscussion = useCallback((events: NostrEventDTO[]): Discussion | null => {
    const parsed = events
      .map(parseDiscussionEvent)
      .filter((d): d is Discussion => d !== null);

    if (parsed.length === 0) {
      return null;
    }

    return parsed.reduce((latest, current) =>
      current.createdAt > latest.createdAt ? current : latest
    );
  }, []);

  /**
   * データ取得関数 (T014, T040)
   *
   * queryWithCompletion を使用してディスカッションデータを取得します。
   * テストモードの場合は loadTestData を使用して静的データを返します。
   *
   * なぜ completion-aware read を使用するのか:
   * - metadata を本文と同じ read 経路に統一し、二重取得を防ぐ
   * - 遷移方式差（ナビ/再読込/直アクセス）での完了判定を揃える
   *
   * loadSequence パターンを使用する理由:
   * - 非同期操作の競合を防ぐため、古いリクエストの結果を破棄する
   * - ユーザーが素早くページ遷移した場合でも正しいデータが表示される
   *
   * @throws {Error} ストリーム接続エラー時（catchブロックで処理）
   */
  const loadDiscussionData = useCallback(async () => {
    if (!discussionInfo) {
      setDiscussion(null);
      setIsDiscussionLoading(false);
      setDiscussionError("会話情報の指定が正しくありません。");
      setDiscussionCompletionReason("cancelled");
      return;
    }

    // loadSequence パターンで古いデータを破棄
    const loadSequence = ++loadSequenceRef.current;

    // 状態初期化
    const knownData = loadKnownDiscussionData<Discussion>(discussionInfo.discussionId);
    const knownMetadata = knownData?.metadata;
    const hasMatchingKnownMetadata = Boolean(
      knownMetadata &&
      knownMetadata.dTag === discussionInfo.dTag &&
      arePubkeysEqual(knownMetadata.authorPubkey, discussionInfo.authorPubkey),
    );
    setDiscussion(hasMatchingKnownMetadata ? knownMetadata ?? null : null);
    setIsDiscussionLoading(!hasMatchingKnownMetadata);
    setDiscussionError(null);
    setDiscussionCompletionReason(null);

    try {
      // テストモード判定
      if (isTestMode(discussionInfo.dTag)) {
        const testData = await loadTestData();
        if (loadSequenceRef.current !== loadSequence) return;
        setDiscussion(testData.discussion);
        setDiscussionCompletionReason("eose");
        setIsDiscussionLoading(false);
        return;
      }

      const plan = createDiscussionReadPlan("discussion-meta", discussionReadStrategy, {
        authorPubkey: discussionInfo.authorPubkey,
        dTag: discussionInfo.dTag,
        relayHints: discussionInfo.relays,
      });
      const relayUrls = selectRelayCandidates({
        hints: plan.relayHints,
        successful: knownData?.successfulEventRelayUrls ?? knownData?.successfulRelays,
        configured: discussionConfig.relays.filter((relay) => relay.read).map((relay) => relay.url),
        defaults: [],
        limit: discussionReadStrategy.relayLimit,
      }).map((relay) => relay.url);
      const discussionResult = await discussionGateway.queryWithCompletion(plan.filters, {
        idleTimeoutMs: plan.idleTimeoutMs,
        hardTimeoutMs: plan.hardTimeoutMs,
        relayUrls,
      });
      if (loadSequenceRef.current !== loadSequence) return;

      const matchingEvents = discussionResult.events.filter(
        (event) =>
          arePubkeysEqual(event.pubkey, discussionInfo.authorPubkey) &&
          event.tags.some((tag) => tag[0] === "d" && tag[1] === discussionInfo.dTag),
      );
      const latest = pickLatestDiscussion(matchingEvents);
      if (latest) {
        setDiscussion(latest);
        saveKnownDiscussionData(discussionInfo.discussionId, {
          metadata: latest,
          eventIds: discussionResult.events.map((event) => event.id),
          attemptedRelayUrls: discussionResult.relayUrls,
          successfulEventRelayUrls: Array.from(
            new Set(Object.values(discussionResult.sourceRelayUrlsByEventId ?? {}).flat())
          ),
          successfulRelays: [],
        });
      } else {
        setDiscussionError("会話情報が見つかりませんでした。");
      }
      setDiscussionCompletionReason(discussionResult.completionReason);
      setIsDiscussionLoading(false);
    } catch (error) {
      if (loadSequenceRef.current !== loadSequence) return;
      logger.error("Failed to load discussion:", error);
      setDiscussionError("会話データの取得に失敗しました");
      setIsDiscussionLoading(false);
    }
  }, [discussionInfo, pickLatestDiscussion]);

  // データロード実行とクリーンアップ (T015)
  useEffect(() => {
    void loadDiscussionData();
  }, [loadDiscussionData]);

  const discussionMeta = useMemo<DiscussionMetaContextValue>(
    () => ({
      discussion,
      isLoading: isDiscussionLoading,
      error: discussionError,
      completionReason: discussionCompletionReason,
      reload: loadDiscussionData,
    }),
    [
      discussion,
      isDiscussionLoading,
      discussionError,
      discussionCompletionReason,
      loadDiscussionData,
    ]
  );

  // 末尾のスラッシュを正規化
  const normalizedBase = baseHref.replace(/\/$/, "");
  const normalizedPath = pathname.replace(/\/$/, "");

  // アクティブタブの判定
  const isMainActive =
    normalizedPath === normalizedBase ||
    normalizedPath === `${normalizedBase}/`;
  const isAllPostsActive = normalizedPath === `${normalizedBase}/approve`;
  const isEditActive = normalizedPath === `${normalizedBase}/edit`;
  const isModeratorsActive = normalizedPath === `${normalizedBase}/moderators`;
  const isCreator = Boolean(
    discussion && arePubkeysEqual(user.pubkey, discussion.authorPubkey),
  );
  const isMod = Boolean(
    user.pubkey &&
    discussion?.moderators.some((moderator) =>
      arePubkeysEqual(moderator.pubkey, user.pubkey),
    ),
  );
  const isDiscussionRoleReady = Boolean(
    discussion && !isDiscussionLoading && discussionCompletionReason,
  );

  const tabs = [
    {
      href: normalizedBase,
      label: "会話",
      isActive: isMainActive,
    },
    {
      href: `${normalizedBase}/approve`,
      label: "すべての投稿",
      isActive: isAllPostsActive,
    },
    {
      href: `${normalizedBase}/moderators`,
      label: "モデレーター",
      isActive: isModeratorsActive,
    },
    ...(isCreator ? [{
      href: `${normalizedBase}/edit`,
      label: "基本情報",
      isActive: isEditActive,
    }] : []),
  ];
  const activeTabIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.isActive),
  );

  /**
   * キーボードナビゲーション処理
   * Arrow Left/Right: 前/次のタブにフォーカス移動（循環）
   * Home: 最初のタブにフォーカス
   * End: 最後のタブにフォーカス
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        tabRefs.current[nextIndex]?.focus();
      }
    },
    [tabs.length]
  );

  return (
    <DiscussionMetaContext.Provider value={discussionMeta}>
      {showNavigation ? <div>
      {/*
        段階的ローディングの設計判断 (T041):

        なぜタブ+戻るリンクを先に表示するのか:
        - ユーザーは即座にナビゲーションが可能（データ取得を待たずに離脱できる）
        - ネットワークが遅い場合でも、UI全体が固まらない
        - ローディング状態が明確で、ユーザーは何が起きているか理解できる

        なぜタイトル・説明を後から表示するのか:
        - 外部データ（Nostrリレー）に依存するため、取得に時間がかかる可能性がある
        - 空の状態やプレースホルダーを表示するよりも、ローディングインジケーターの方が明確
        - データが到着してから表示することで、UI のレイアウトシフトを最小限に抑える
      */}

      {/* 戻るリンク (T016) - 即座に表示 */}
      <div className="mb-4">
        <Link
          href="/discussions"
          className="btn btn-ghost rounded-full dark:rounded-sm"
        >
          <span className="ruby-text">← 会話一覧に戻る</span>
        </Link>
      </div>

      <DiscussionMetaReadState
        discussion={discussion}
        isLoading={isDiscussionLoading}
        error={discussionError}
        completionReason={discussionCompletionReason}
        onReload={() => {
          setDiscussionError(null);
          void loadDiscussionData();
        }}
      >
        <DiscussionReadStatus
          isLoading={isDiscussionLoading}
          completionReason={discussionCompletionReason}
          hasData={Boolean(discussion)}
          onReload={() => void loadDiscussionData()}
        />

      {isDiscussionRoleReady && (
        <div className="alert mb-8" role="status">
          <InformationCircleIcon className="h-6 w-6 text-info" aria-hidden="true" />
          <div>
            {isCreator ? (
              <>
                <p className="font-semibold ruby-text">あなたは作成者です。</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 ruby-text">
                  <li>ユーザーとして、新しい意見を投稿できます。</li>
                  <li>モデレーターとして、投稿を承認できます。</li>
                  <li>作成者として、会話を編集できます（説明を書く、モデレーターを指名するなど）。</li>
                </ul>
              </>
            ) : isMod ? (
              <>
                <p className="font-semibold ruby-text">あなたはモデレーターです。</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 ruby-text">
                  <li>ユーザーとして、新しい意見を投稿できます。</li>
                  <li>モデレーターとして、投稿を承認できます。</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-semibold ruby-text">あなたはユーザーです。</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 ruby-text">
                  <li>ユーザーとして、新しい意見を投稿できます。</li>
                </ul>
              </>
            )}
          </div>
        </div>
      )}
      </DiscussionMetaReadState>

      {/* タブナビゲーション（既存） */}
      <nav
        role="tablist"
        className="tabs tabs-box mb-6 w-full overflow-x-auto"
        aria-label="ページナビゲーション"
      >
        {tabs.map((tab, index) => (
          <Link
            key={tab.href}
            href={tab.href}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            className={`tab font-bold px-4 min-h-[44px] min-w-[44px] shrink-0 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tab.isActive ? "tab-active" : ""
              }`}
            role="tab"
            id={`discussion-content-${index}-tab`}
            aria-controls="discussion-content-panel"
            aria-selected={tab.isActive}
            aria-current={tab.isActive ? "page" : undefined}
            tabIndex={tab.isActive ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span className="ruby-text">{tab.label}</span>
          </Link>
        ))}
      </nav>

      <div
        id="discussion-content-panel"
        role="tabpanel"
        aria-labelledby={`discussion-content-${activeTabIndex}-tab`}
        tabIndex={0}
      >
        {children}
      </div>
      </div> : children}
    </DiscussionMetaContext.Provider>
  );
}
