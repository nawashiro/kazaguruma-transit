"use client";

import React, { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";
import { DiscussionMetaReadState } from "@/components/discussion/DiscussionMetaReadState";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscussionDetail } from "@/components/discussion/DiscussionDetailProvider";
import type { CompletionReason } from "@/lib/nostr/nostr-service";
import { Info } from "lucide-react";
import type { Discussion } from "@/types/discussion";

interface DiscussionTabLayoutProps {
  /** タブナビゲーションのベースURL（例: "/discussions" または "/discussions/[naddr]"） */
  baseHref: string;
  /** 会話固有の戻るリンク・見出し・タブを表示するか */
  showNavigation?: boolean;
  /** 子コンポーネント（ページコンテンツ） */
  children: React.ReactNode;
}

type DiscussionTabReadState = {
  discussion: Discussion | null;
  isLoading: boolean;
  error: string | null;
  completionReason: CompletionReason | null;
  reload: () => Promise<void>;
};

function useDetailTabReadState(): DiscussionTabReadState {
  const detail = useDiscussionDetail();
  return {
    discussion: detail.snapshot?.discussion ?? null,
    isLoading: detail.state === "loading",
    error: detail.error,
    completionReason:
      detail.completionReason ??
      (detail.state === "partial"
        ? "idle-timeout"
        : detail.state === "error"
          ? "hard-timeout"
          : detail.state === "ready"
            ? "eose"
            : null),
    reload: detail.reload,
  };
}

/**
 * Detail routes use only the DiscussionDetailProvider selector. The legacy
 * naddr-compatible branch was removed together with the dead provider sources.
 */
export function DiscussionTabLayout(props: DiscussionTabLayoutProps) {
  return <DetailDiscussionTabLayout {...props} />;
}

function DetailDiscussionTabLayout(props: DiscussionTabLayoutProps) {
  const readState = useDetailTabReadState();
  return <DiscussionTabLayoutContent {...props} readState={readState} />;
}

/**
 * 会話ページと監査ページを切り替えるタブナビゲーションを提供するレイアウトコンポーネント
 *
 * 読み取り状態は route owner の selector から受け取り、このコンポーネントは
 * metadata と navigation を表示する責務だけを持ちます。
 */
function DiscussionTabLayoutContent({
  baseHref,
  showNavigation = true,
  children,
  readState,
}: DiscussionTabLayoutProps & { readState: DiscussionTabReadState }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const { discussion, isLoading: isDiscussionLoading, error: discussionError, completionReason: discussionCompletionReason, reload } = readState;

  const normalizedBase = baseHref.replace(/\/$/, "");
  const normalizedPath = pathname.replace(/\/$/, "");

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
    [tabs.length],
  );

  return (
    <>
      {showNavigation ? <div>
        <div className="mb-4">
          <Link
            href="/discussions"
            className="btn text-base btn-ghost rounded-full dark:rounded-sm"
          >
            <span className="ruby-text">← 会話一覧に戻る</span>
          </Link>
        </div>

        <DiscussionMetaReadState
          discussion={discussion}
          isLoading={isDiscussionLoading}
          error={discussionError}
          completionReason={discussionCompletionReason}
          onReload={() => void reload()}
        >
          <DiscussionReadStatus
            isLoading={isDiscussionLoading}
            completionReason={discussionCompletionReason}
            hasData={Boolean(discussion)}
            onReload={() => void reload()}
          />

          {isDiscussionRoleReady && (
            <div className="alert alert-soft text-base-content! mb-8" role="status">
              <Info className="h-6 w-6 text-info" aria-hidden="true" />
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
              className={`tab font-bold px-4 min-h-[44px] min-w-[44px] shrink-0 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tab.isActive ? "tab-active" : ""}`}
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
    </>
  );
}
