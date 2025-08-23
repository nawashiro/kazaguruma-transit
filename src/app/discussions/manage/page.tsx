"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import {
  AdminCheck,
  PermissionError,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import Button from "@/components/ui/Button";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type {
  Discussion,
} from "@/types/discussion";
import type { Event as NostrEvent } from "nostr-tools";
import { logger } from "@/utils/logger";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionManagePage() {
  // spec_v2.md要件: 承認待ちと承認済み会話の管理
  const [pendingDiscussions, setPendingDiscussions] = useState<Discussion[]>([]);
  const [approvedDiscussions, setApprovedDiscussions] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const { user, signEvent } = useAuth();

  // Rubyfulライブラリ対応
  useRubyfulRun([pendingDiscussions, approvedDiscussions], isLoaded);

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }
    setIsLoaded(true);
  }, []);

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話管理</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const loadData = async () => {
    setIsLoading(true);
    try {
      const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
      if (!discussionListNaddr) {
        throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is not configured");
      }

      // NIP-72 compliant: Get community posts to discussion list and approval events
      const [communityPosts, approvalEvents] = await Promise.all([
        nostrService.getCommunityPostsToDiscussionList(discussionListNaddr, { limit: 100 }),
        nostrService.getApprovalEvents(ADMIN_PUBKEY),
      ]);

      // For now, set empty arrays to make the page functional
      // TODO: Implement proper NIP-72 community post processing
      setPendingDiscussions([]);
      setApprovedDiscussions([]);
    } catch (error) {
      logger.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // spec_v2.md要件: 会話一覧への追加承認
  const handleApproveDiscussion = async (discussion: Discussion) => {
    setProcessingId(discussion.id);
    setErrors([]);
    try {
      const eventTemplate = nostrService.createDiscussionApprovalEvent({
        id: discussion.id,
        dTag: discussion.dTag,
        authorPubkey: discussion.authorPubkey,
      });

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish approval event to relays");
      }

      await loadData();
    } catch (error) {
      logger.error("Failed to approve discussion:", error);
      setErrors(["承認に失敗しました"]);
    } finally {
      setProcessingId(null);
    }
  };

  // spec_v2.md要件: 会話一覧からの撤回
  const handleRevokeDiscussion = async (discussion: Discussion) => {
    if (!discussion.approvalReference) return;
    
    if (!confirm("この会話を一覧から削除してもよろしいですか？")) {
      return;
    }

    setProcessingId(discussion.id);
    setErrors([]);
    try {
      // 承認イベントIDを抽出
      const approvalEventId = discussion.approvalReference.split(':')[2] || '';
      
      const eventTemplate = nostrService.createApprovalRevocationEvent(approvalEventId);
      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish revocation event to relays");
      }

      await loadData();
    } catch (error) {
      logger.error("Failed to revoke discussion:", error);
      setErrors(["撤回に失敗しました"]);
    } finally {
      setProcessingId(null);
    }
  };












  return (
    <AdminCheck
      adminPubkey={ADMIN_PUBKEY}
      userPubkey={user.pubkey}
      fallback={<PermissionError type="admin" />}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 ruby-text">
          <Link
            href="/discussions"
            className="btn btn-ghost btn-sm mb-4 rounded-full dark:rounded-sm"
          >
            <span>← 会話一覧に戻る</span>
          </Link>
          <h1 className="text-3xl font-bold">会話管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            ユーザー作成会話の一覧への追加を承認・撤回できます。
          </p>
        </div>

        {/* タブナビゲーション */}
        <nav role="tablist" className="tabs tabs-bordered mb-6">
          <button
            className={`tab tab-lg ruby-text ${
              activeTab === 'pending' ? 'tab-active' : ''
            }`}
            role="tab"
            onClick={() => setActiveTab('pending')}
          >
            承認待ち会話 ({pendingDiscussions.length}件)
          </button>
          <button
            className={`tab tab-lg ruby-text ${
              activeTab === 'approved' ? 'tab-active' : ''
            }`}
            role="tab"
            onClick={() => setActiveTab('approved')}
          >
            承認済み会話 ({approvedDiscussions.length}件)
          </button>
        </nav>

        {/* エラー表示 */}
        {errors.length > 0 && (
          <div className="alert alert-error mb-6 ruby-text">
            <ul className="text-sm">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'pending' ? (
          /* 承認待ち会話タブ */
          <div className="space-y-6">

            {/* 承認待ち会話一覧 */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : pendingDiscussions.length > 0 ? (
              <div className="space-y-4">
                {pendingDiscussions.map((discussion) => (
                  <div
                    key={discussion.id}
                    className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium ruby-text">{discussion.title}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ruby-text">
                                {discussion.description}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-gray-500">
                                  {formatRelativeTime(discussion.createdAt)}
                                </span>
                                <span className="badge badge-sm">作成者</span>
                                <span className="badge badge-outline badge-sm">
                                  {discussion.moderators.length + 1} モデレーター
                                </span>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleApproveDiscussion(discussion)}
                              disabled={processingId === discussion.id}
                              loading={processingId === discussion.id}
                              className="btn-sm"
                            >
                              <span>{processingId === discussion.id ? '' : '承認'}</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 ruby-text">
                  承認待ちの会話はありません。
                </p>
              </div>
            )}
          </div>
        ) : (
          /* 承認済み会話タブ */
          <div className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : approvedDiscussions.length > 0 ? (
              <div className="space-y-4">
                {approvedDiscussions.map((discussion) => (
                  <div
                    key={discussion.id}
                    className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium ruby-text">{discussion.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ruby-text">
                            {discussion.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">
                              作成: {formatRelativeTime(discussion.createdAt)}
                            </span>
                            {discussion.approvedAt && (
                              <span className="text-xs text-green-600">
                                承認: {formatRelativeTime(discussion.approvedAt)}
                              </span>
                            )}
                            <span className="badge badge-sm badge-success">承認済み</span>
                            <span className="badge badge-outline badge-sm">
                              {discussion.moderators.length + 1} モデレーター
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRevokeDiscussion(discussion)}
                          disabled={processingId === discussion.id}
                          loading={processingId === discussion.id}
                          className="btn-sm btn-error"
                        >
                          <span>{processingId === discussion.id ? '' : '一覧から削除'}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 ruby-text">
                  承認済みの会話はありません。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminCheck>
  );
}
