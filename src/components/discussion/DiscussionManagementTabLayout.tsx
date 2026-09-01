"use client";

import React, { useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { getAdminPubkeyHex } from "@/lib/nostr/nostr-utils";
import { arePubkeysEqual } from "@/lib/discussion/permission-system";
import { DiscussionRoleCard, type DiscussionRole } from "@/components/discussion/DiscussionRoleCard";
import PageHeader from "@/components/layouts/PageHeader";
import { useDiscussionManagement } from "@/components/discussion/DiscussionManagementProvider";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";

const MANAGEMENT_TABS = [
  { href: "/discussions", label: "会話一覧" },
  { href: "/discussions/manage", label: "掲載依頼" },
  { href: "/discussions/moderator", label: "モデレーター" },
] as const;

const DEFAULT_TITLE = "意見交換";
const DEFAULT_DESCRIPTION =
  "意見交換を行うために自由に利用していい場所です。誰でも新しい会話を作成できます。";

export function DiscussionManagementTabLayout(props: {
  children: React.ReactNode;
  role?: DiscussionRole;
  /** Nested management routes render their own layout boundary. */
  renderLayout?: boolean;
}) {
  if (props.renderLayout === false) return <>{props.children}</>;
  return <DiscussionManagementTabLayoutContent {...props} />;
}

function DiscussionManagementTabLayoutContent({
  children,
  role: roleOverride,
}: {
  children: React.ReactNode;
  role?: DiscussionRole;
}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const activeTabIndex = Math.max(
    0,
    MANAGEMENT_TABS.findIndex((tab) => tab.href === pathname),
  );
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const { user } = useAuth();
  const management = useDiscussionManagement();
  const discussion = management.snapshot?.listDiscussion ?? null;
  const isLoading = management.state === "loading";
  const completionReason =
    management.completionReason ??
    (management.state === "partial"
      ? "idle-timeout"
      : management.state === "error"
        ? "hard-timeout"
        : management.state === "ready"
          ? "eose"
          : null);
  const title = discussion?.title ?? DEFAULT_TITLE;
  const description = discussion?.description ?? DEFAULT_DESCRIPTION;
  const isAdminUser = arePubkeysEqual(user.pubkey, getAdminPubkeyHex());
  const role: DiscussionRole | null = roleOverride
    ? roleOverride
    : isAdminUser
      ? "admin"
      : discussion
        ? (discussion.moderators ?? []).some((moderator) =>
            arePubkeysEqual(user.pubkey, moderator.pubkey),
          )
          ? "moderator"
          : "user"
        : null;

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
      <PageHeader title={title} description={description} />
      {management.state === "error" ? (
        <div
          className="alert alert-error alert-soft text-base-content! mb-8"
          role="status"
          aria-live="polite"
        >
          <p className="ruby-text">
            {management.error ?? "掲載一覧の会話情報を取得できませんでした。"}
          </p>
          <button
            type="button"
            className="btn text-base btn-outline gap-0 ruby-text min-h-[44px] rounded-full dark:rounded-sm"
            onClick={() => void management.reload()}
          >
            再読み込み
          </button>
        </div>
      ) : (
        <DiscussionReadStatus
          isLoading={isLoading}
          completionReason={completionReason}
          hasData={Boolean(discussion)}
          onReload={() => void management.reload()}
        />
      )}
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
              className={`tab min-h-[44px] min-w-[44px] shrink-0 whitespace-nowrap px-4 font-bold ruby-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isActive ? "tab-active" : ""}`}
              role="tab"
              id={`discussion-management-${index}-tab`}
              aria-controls="discussion-management-panel"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div
        id="discussion-management-panel"
        role="tabpanel"
        aria-labelledby={`discussion-management-${activeTabIndex}-tab`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
