"use client";

import React, { useRef } from "react";

type ApprovalStatusTab = "pending" | "approved";

interface ApprovalStatusTabsProps {
  activeTab: ApprovalStatusTab;
  approvedCount: number;
  badgeClassName?: string;
  idPrefix: string;
  onTabChange: (tab: ApprovalStatusTab) => void;
  pendingCount: number;
}

function buildBadgeClassName(
  colorClassName: "badge-warning" | "badge-success",
  sizeClassName: string
): string {
  return ["badge", colorClassName, "ml-1", sizeClassName]
    .filter(Boolean)
    .join(" ");
}

/**
 * 投稿承認状態を切り替える、矢印キー操作対応のタブリスト。
 */
export function ApprovalStatusTabs({
  activeTab,
  approvedCount,
  badgeClassName = "",
  idPrefix,
  onTabChange,
  pendingCount,
}: ApprovalStatusTabsProps) {
  const pendingTabRef = useRef<HTMLButtonElement>(null);
  const approvedTabRef = useRef<HTMLButtonElement>(null);

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ApprovalStatusTab
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const targetTab = currentTab === "pending" ? "approved" : "pending";
    onTabChange(targetTab);
    const targetTabRef =
      targetTab === "pending" ? pendingTabRef : approvedTabRef;
    targetTabRef.current?.focus();
  };

  return (
    <nav
      className="tabs tabs-box mb-6 w-full overflow-x-auto"
      role="tablist"
      aria-label="投稿承認"
    >
      <button
        ref={pendingTabRef}
        aria-selected={activeTab === "pending"}
        aria-controls={`${idPrefix}-pending-panel`}
        id={`${idPrefix}-pending-tab`}
        aria-label="承認待ちタブを開く"
        className={`tab min-h-[44px] px-4 ${
          activeTab === "pending" ? "tab-active" : ""
        }`}
        role="tab"
        tabIndex={activeTab === "pending" ? 0 : -1}
        onClick={() => onTabChange("pending")}
        onKeyDown={(event) => handleTabKeyDown(event, "pending")}
        type="button"
      >
        <span className="ruby-text">承認待ち</span>
        {pendingCount > 0 && (
          <span
            className={buildBadgeClassName("badge-warning", badgeClassName)}
          >
            {pendingCount}
          </span>
        )}
      </button>
      <button
        ref={approvedTabRef}
        aria-selected={activeTab === "approved"}
        aria-controls={`${idPrefix}-approved-panel`}
        id={`${idPrefix}-approved-tab`}
        aria-label="承認済みタブを開く"
        className={`tab min-h-[44px] px-4 ${
          activeTab === "approved" ? "tab-active" : ""
        }`}
        role="tab"
        tabIndex={activeTab === "approved" ? 0 : -1}
        onClick={() => onTabChange("approved")}
        onKeyDown={(event) => handleTabKeyDown(event, "approved")}
        type="button"
      >
        <span className="ruby-text">承認済み</span>
        {approvedCount > 0 && (
          <span
            className={buildBadgeClassName("badge-success", badgeClassName)}
          >
            {approvedCount}
          </span>
        )}
      </button>
    </nav>
  );
}
