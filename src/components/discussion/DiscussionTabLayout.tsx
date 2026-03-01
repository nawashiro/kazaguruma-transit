"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { parseDiscussionEvent } from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { loadTestData, isTestMode } from "@/lib/test/test-data-loader";
import { logger } from "@/utils/logger";
import type { Discussion } from "@/types/discussion";
import type { Event } from "nostr-tools";

interface DiscussionTabLayoutProps {
  /** タブナビゲーションのベースURL（例: "/discussions" または "/discussions/[naddr]"） */
  baseHref: string;
  /** 子コンポーネント（ページコンテンツ） */
  children: React.ReactNode;
}

// Nostrサービスのシングルトンインスタンス
const nostrService = createNostrService(getNostrServiceConfig());

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
  children,
}: DiscussionTabLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const naddr = params.naddr as string;
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // 会話データの状態 (T011)
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const discussionStreamCleanupRef = useRef<(() => void) | null>(null);
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
  const pickLatestDiscussion = useCallback((events: Event[]): Discussion | null => {
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
   * streamDiscussionMeta を使用してリアルタイムでディスカッションデータを取得します。
   * テストモードの場合は loadTestData を使用して静的データを返します。
   *
   * なぜストリーミングを使用するのか:
   * - Nostrプロトコルはリアルタイム性が高く、会話の編集・更新が即座に反映される
   * - 複数のリレーから最新データを収集し、ユーザーに最新の状態を表示できる
   * - EOSEイベント後も接続を維持し、リアルタイム更新を継続受信できる
   *
   * loadSequence パターンを使用する理由:
   * - 非同期操作の競合を防ぐため、古いリクエストの結果を破棄する
   * - ユーザーが素早くページ遷移した場合でも正しいデータが表示される
   *
   * @throws {Error} ストリーム接続エラー時（catchブロックで処理）
   */
  const loadDiscussionData = useCallback(async () => {
    if (!discussionInfo) return;

    // 前のストリームをクリーンアップ
    discussionStreamCleanupRef.current?.();
    discussionStreamCleanupRef.current = null;

    // loadSequence パターンで古いデータを破棄
    const loadSequence = ++loadSequenceRef.current;

    // 状態初期化
    setDiscussion(null);
    setIsDiscussionLoading(true);
    setDiscussionError(null);

    try {
      // テストモード判定
      if (isTestMode(discussionInfo.dTag)) {
        const testData = await loadTestData();
        if (loadSequenceRef.current !== loadSequence) return;
        setDiscussion(testData.discussion);
        setIsDiscussionLoading(false);
        return;
      }

      // ストリーム開始
      discussionStreamCleanupRef.current = nostrService.streamDiscussionMeta(
        discussionInfo.authorPubkey,
        discussionInfo.dTag,
        {
          onEvent: (events) => {
            if (loadSequenceRef.current !== loadSequence) return;
            const latest = pickLatestDiscussion(events);
            if (latest) {
              setDiscussion(latest);
              setIsDiscussionLoading(false);
            }
          },
          onEose: (events) => {
            if (loadSequenceRef.current !== loadSequence) return;
            const latest = pickLatestDiscussion(events);
            if (latest) {
              setDiscussion(latest);
            }
            setIsDiscussionLoading(false);
          },
        }
      );
    } catch (error) {
      if (loadSequenceRef.current !== loadSequence) return;
      logger.error("Failed to load discussion:", error);
      setDiscussionError("会話データの取得に失敗しました");
      setIsDiscussionLoading(false);
    }
  }, [discussionInfo, pickLatestDiscussion]);

  // データロード実行とクリーンアップ (T015)
  useEffect(() => {
    loadDiscussionData();

    return () => {
      discussionStreamCleanupRef.current?.();
      discussionStreamCleanupRef.current = null;
    };
  }, [loadDiscussionData]);

  // 末尾のスラッシュを正規化
  const normalizedBase = baseHref.replace(/\/$/, "");
  const normalizedPath = pathname.replace(/\/$/, "");

  // アクティブタブの判定
  const isMainActive =
    normalizedPath === normalizedBase ||
    normalizedPath === `${normalizedBase}/`;
  const isAuditActive = normalizedPath === `${normalizedBase}/audit`;

  const tabs = [
    {
      href: normalizedBase,
      label: "会話",
      isActive: isMainActive,
    },
    {
      href: `${normalizedBase}/audit`,
      label: "監査ログ",
      isActive: isAuditActive,
    },
  ];

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
    <div>
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
          className="btn btn-ghost btn-sm rounded-full dark:rounded-sm"
        >
          <span className="ruby-text">← 会話一覧に戻る</span>
        </Link>
      </div>

      {/* タイトル・説明（データ取得後のみ表示） (T017) */}
      {!isDiscussionLoading && discussion && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 ruby-text">
            {discussion.title}
          </h1>
          {discussion.description.split("\n").map((line, idx) => (
            <p key={idx} className="text-gray-600 dark:text-gray-400 ruby-text">
              {line}
            </p>
          ))}
        </div>
      )}

      {/* ローディング表示 (T018) */}
      {isDiscussionLoading && (
        <div
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ruby-text mb-8"
          role="status"
          aria-live="polite"
        >
          <div
            className="loading loading-spinner loading-sm"
            aria-hidden="true"
          ></div>
          <span>会話情報を読み込み中...</span>
        </div>
      )}

      {/* エラー表示 (T019) */}
      {discussionError && (
        <div className="alert alert-error mb-8" role="alert">
          <span>{discussionError}</span>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              setDiscussionError(null);
              loadDiscussionData();
            }}
          >
            再試行
          </button>
        </div>
      )}

      {/* タブナビゲーション（既存） */}
      <nav role="tablist" className="join mb-6" aria-label="ページナビゲーション">
        {tabs.map((tab, index) => (
          <Link
            key={tab.href}
            href={tab.href}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            className={`join-item btn min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tab.isActive ? "btn-active btn-primary" : ""
              }`}
            role="tab"
            aria-selected={tab.isActive}
            tabIndex={tab.isActive ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* 子コンテンツ */}
      {children}
    </div>
  );
}
