"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { createDiscussionNdkGateway } from "@/lib/nostr/discussion-ndk-gateway";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { getAdminPubkeyHex, parseDiscussionEvent } from "@/lib/nostr/nostr-utils";
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import { DiscussionRoleCard, type DiscussionRole } from "@/components/discussion/DiscussionRoleCard";
import PageHeader from "@/components/layouts/PageHeader";

const MANAGEMENT_TABS = [
  { href: "/discussions", label: "会話一覧" },
  { href: "/discussions/manage", label: "掲載依頼" },
  { href: "/discussions/moderator", label: "モデレーター" },
] as const;
const discussionGateway = createDiscussionNdkGateway(getNostrServiceConfig());

export function DiscussionManagementTabLayout({
  children,
  role: roleOverride,
}: {
  children: React.ReactNode;
  role?: DiscussionRole;
}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const { user } = useAuth();
  const [role, setRole] = useState<DiscussionRole | null>(null);
  const isAdminUser = arePubkeysEqual(user.pubkey, getAdminPubkeyHex());

  useEffect(() => {
    if (roleOverride) {
      setRole(roleOverride);
      return;
    }
    const listNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
    if (isAdminUser) {
      setRole("admin");
    }
    if (!listNaddr || isAdminUser) return;

    const discussionInfo = extractDiscussionFromNaddr(listNaddr);
    if (!discussionInfo) return;

    let isActive = true;
    void discussionGateway
      .queryWithCompletion(
        [{
          kinds: [34550],
          authors: [discussionInfo.authorPubkey],
          "#d": [discussionInfo.dTag],
          limit: 1,
        }],
        {
          idleTimeoutMs: getNostrServiceConfig().defaultTimeout,
          hardTimeoutMs: getNostrServiceConfig().defaultTimeout * 3,
        },
      )
      .then((result) => {
        if (!isActive) return;
        const discussion = result.events
          .map(parseDiscussionEvent)
          .filter(
            (item): item is NonNullable<typeof item> =>
              Boolean(
                item &&
                item.authorPubkey === discussionInfo.authorPubkey &&
                item.dTag === discussionInfo.dTag,
              ),
          )
          .sort((left, right) => right.createdAt - left.createdAt)[0];
        if (isAdminUser) {
          setRole("admin");
        } else if (discussion?.moderators.some((moderator) => arePubkeysEqual(user.pubkey, moderator.pubkey))) {
          setRole("moderator");
        } else if (discussion) {
          setRole("user");
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [isAdminUser, roleOverride, user.pubkey]);

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
      <PageHeader
        title="意見交換"
        description="意見交換を行うために自由に利用していい場所です。誰でも新しい会話を作成できます。"
      />
      {role && <DiscussionRoleCard role={role} />}
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
