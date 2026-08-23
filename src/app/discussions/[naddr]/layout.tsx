"use client";

import React from "react";
import { useParams } from "next/navigation";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";
import { DiscussionContentDataProvider } from "@/components/discussion/DiscussionContentDataProvider";
import { DiscussionDataProvider } from "@/components/discussion/DiscussionDataProvider";

/**
 * 会話詳細ページのレイアウト
 * タブナビゲーションを含み、会話ページで共通して表示される
 */
export default function DiscussionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const naddr = params.naddr as string;
  const baseHref = `/discussions/${naddr}`;

  return (
    <DiscussionDataProvider scope="detail">
      <DiscussionTabLayout baseHref={baseHref}>
        <DiscussionContentDataProvider>
          {children}
        </DiscussionContentDataProvider>
      </DiscussionTabLayout>
    </DiscussionDataProvider>
  );
}
