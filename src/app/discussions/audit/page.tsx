"use client";

import React, { useRef, useEffect } from "react";
import { AuditLogSection } from "@/components/discussion/AuditLogSection";
import { DiscussionListTabLayout } from "@/components/discussion/DiscussionListTabLayout";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";

/**
 * 会話一覧の監査ページ
 * URL: /discussions/audit
 *
 * FR-002: 会話一覧の監査履歴を独立したページとして提供
 * 収録リクエストと承認/却下がタイムラインに表示される
 */
export default function AuditPage() {
  const auditRef = useRef<{ loadAuditData: () => void }>(null);

  // 環境変数から会話一覧のNADDRを取得
  const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;

  // NADDRからdiscussionInfoを抽出
  const discussionInfo = discussionListNaddr
    ? extractDiscussionFromNaddr(discussionListNaddr)
    : null;

  // ページロード時に監査データを取得
  useEffect(() => {
    if (discussionInfo) {
      auditRef.current?.loadAuditData();
    }
  }, [discussionInfo]);

  if (!discussionListNaddr) {
    return (
      <DiscussionListTabLayout baseHref="/discussions">
        <div className="alert alert-error">
          <span>会話一覧の設定が見つかりません。</span>
        </div>
      </DiscussionListTabLayout>
    );
  }

  if (!discussionInfo) {
    return (
      <DiscussionListTabLayout baseHref="/discussions">
        <div className="alert alert-error">
          <span>無効な会話一覧アドレスです。</span>
        </div>
      </DiscussionListTabLayout>
    );
  }

  return (
    <DiscussionListTabLayout baseHref="/discussions">
      <div>
        <AuditLogSection
          ref={auditRef}
          discussionInfo={discussionInfo}
          isDiscussionList={true}
        />
      </div>
    </DiscussionListTabLayout>
  );
}
