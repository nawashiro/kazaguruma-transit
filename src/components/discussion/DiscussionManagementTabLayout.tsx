"use client";

import React, { useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MANAGEMENT_TABS = [
  { href: "/discussions", label: "会話一覧" },
  { href: "/discussions/manage", label: "掲載依頼" },
  { href: "/discussions/moderator", label: "モデレーター" },
] as const;

export function DiscussionManagementTabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      const keyToIndex = {
        ArrowRight: currentIndex + 1,
        ArrowLeft: currentIndex - 1,
        Home: 0,
        End: MANAGEMENT_TABS.length - 1,
      } as const;
      const targetIndex = keyToIndex[event.key as keyof typeof keyToIndex];
      if (targetIndex === undefined) return;

      event.preventDefault();
      const normalizedIndex =
        event.key === "ArrowRight"
          ? targetIndex % MANAGEMENT_TABS.length
          : event.key === "ArrowLeft"
            ? (targetIndex + MANAGEMENT_TABS.length) % MANAGEMENT_TABS.length
            : targetIndex;
      tabRefs.current[normalizedIndex]?.focus();
    },
    [],
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 ruby-text">意見交換</h1>
        <p className="text-gray-600 dark:text-gray-400 ruby-text">
          意見交換を行うために自由に利用していい場所です。誰でも新しい会話を作成できます。
        </p>
      </div>
      <nav
        className="tabs tabs-box mb-6 w-full overflow-x-auto"
        role="tablist"
        aria-label="会話管理"
      >
        {MANAGEMENT_TABS.map((tab, index) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={(element) => { tabRefs.current[index] = element; }}
              className={`tab min-h-[44px] min-w-[44px] shrink-0 whitespace-nowrap px-4 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isActive ? "tab-active" : ""}`}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="ruby-text">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
