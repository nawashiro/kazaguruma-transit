"use client";

import React, { useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface DiscussionTabLayoutProps {
  /** タブナビゲーションのベースURL（例: "/discussions" または "/discussions/[naddr]"） */
  baseHref: string;
  /** 子コンポーネント（ページコンテンツ） */
  children: React.ReactNode;
}

/**
 * 会話ページと監査ページを切り替えるタブナビゲーションを提供するレイアウトコンポーネント
 *
 * WCAG 2.1 AA準拠:
 * - role="tablist" / role="tab" / aria-selected 属性
 * - Arrow/Home/End キーボードナビゲーション
 * - 最小44px×44px タッチターゲット
 * - フォーカスインジケーター
 */
export function DiscussionTabLayout({
  baseHref,
  children,
}: DiscussionTabLayoutProps) {
  const pathname = usePathname();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

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
      <nav role="tablist" className="join mb-6" aria-label="ページナビゲーション">
        {tabs.map((tab, index) => (
          <Link
            key={tab.href}
            href={tab.href}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            className={`join-item btn min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              tab.isActive ? "btn-active btn-primary" : ""
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
      {children}
    </div>
  );
}
