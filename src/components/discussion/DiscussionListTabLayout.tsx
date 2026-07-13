"use client";

import React from "react";
import { DiscussionManagementTabLayout } from "./DiscussionManagementTabLayout";

interface DiscussionListTabLayoutProps {
  /** タブナビゲーションのベースURL（現在は /discussions 固定） */
  baseHref: string;
  children: React.ReactNode;
}

/** 会話一覧と会話管理で共有する3つのトップレベルタブを表示します。 */
export function DiscussionListTabLayout({
  baseHref,
  children,
}: DiscussionListTabLayoutProps) {
  void baseHref;

  return (
    <div>
      <DiscussionManagementTabLayout>{children}</DiscussionManagementTabLayout>
    </div>
  );
}
