"use client";

import React from "react";
import { useParams } from "next/navigation";
import { AuthProvider } from "@/lib/auth/auth-context";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";

/**
 * 会話詳細ページのレイアウト
 * タブナビゲーションを含み、会話ページと監査ページで共通して表示される
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
    <AuthProvider>
      <DiscussionTabLayout baseHref={baseHref}>{children}</DiscussionTabLayout>
    </AuthProvider>
  );
}