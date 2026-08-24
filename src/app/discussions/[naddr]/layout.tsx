"use client";

import React from "react";
import { useParams } from "next/navigation";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";
import { DiscussionDetailProvider } from "@/components/discussion/DiscussionDetailProvider";
import { useAuth } from "@/lib/auth/auth-context";

const useOptionalAuthPubkey = (): string | null => {
  if (typeof useAuth !== "function") return null;
  try {
    // The layout can be rendered by isolated tests without AuthProvider.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAuth().user.pubkey;
  } catch {
    return null;
  }
};

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
  const userPubkey = useOptionalAuthPubkey();
  const baseHref = `/discussions/${naddr}`;

  return (
    <DiscussionDetailProvider userPubkey={userPubkey}>
      <DiscussionTabLayout baseHref={baseHref}>
        {children}
      </DiscussionTabLayout>
    </DiscussionDetailProvider>
  );
}
