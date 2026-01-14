"use client";

import React, { useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { AuditLogSection } from "@/components/discussion/AuditLogSection";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";

/**
 * 会話詳細の監査ページ
 * URL: /discussions/[naddr]/audit
 *
 * FR-001: 独立したページとして提供
 * FR-016: メイン画面に依存せず独自にkind:34550を取得
 */
export default function AuditPage() {
  const params = useParams();
  const naddr = params.naddr as string;
  const auditRef = useRef<{ loadAuditData: () => void }>(null);

  // NADDRからdiscussionInfoを抽出
  const discussionInfo = extractDiscussionFromNaddr(naddr);

  // ページロード時に監査データを取得
  useEffect(() => {
    if (discussionInfo) {
      auditRef.current?.loadAuditData();
    }
  }, [discussionInfo]);

  if (!discussionInfo) {
    return (
      <div className="alert alert-error">
        <span>無効な会話アドレスです。</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 ruby-text">監査ログ</h1>
      <AuditLogSection
        ref={auditRef}
        discussionInfo={discussionInfo}
        loadDiscussionIndependently={true}
        conversationAuditMode={true}
      />
    </div>
  );
}
