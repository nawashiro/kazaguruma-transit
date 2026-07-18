"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRightOnRectangleIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import PageHeader from "@/components/layouts/PageHeader";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { parseDiscussionEvent, formatRelativeTime } from "@/lib/nostr/nostr-utils";
import { buildNaddrFromDiscussion } from "@/lib/nostr/naddr-utils";
import { type CompletionReason } from "@/lib/nostr/nostr-service";
import {
  createDiscussionNdkGateway,
  type NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";
import { LoginModal } from "@/components/discussion/LoginModal";
import { UserIdentity } from "@/components/ui/UserIdentity";
import Button from "@/components/ui/Button";
import type { Discussion } from "@/types/discussion";
import { logger } from "@/utils/logger";

const nostrServiceConfig = getNostrServiceConfig();
const discussionGateway = createDiscussionNdkGateway(nostrServiceConfig);

export default function SettingsPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [myDiscussions, setMyDiscussions] = useState<Discussion[]>([]);
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(false);
  const [discussionsCompletionReason, setDiscussionsCompletionReason] =
    useState<CompletionReason | null>(null);
  const loadSequenceRef = useRef(0);

  const { user, logout, isLoading, error } = useAuth();

  const updateDiscussions = useCallback((events: NostrEventDTO[]) => {
    const parsedDiscussions = events
      .map(parseDiscussionEvent)
      .filter((d): d is Discussion => d !== null)
      .sort((a, b) => b.createdAt - a.createdAt);

    setMyDiscussions(parsedDiscussions);
  }, []);

  const loadDiscussions = useCallback(async () => {
    const loadSequence = ++loadSequenceRef.current;

    if (!user.isLoggedIn || !user.pubkey || !isDiscussionsEnabled()) {
      setIsLoadingDiscussions(false);
      setDiscussionsCompletionReason(null);
      setMyDiscussions([]);
      return;
    }

    setIsLoadingDiscussions(true);
    setDiscussionsCompletionReason(null);

    try {
      const result = await discussionGateway.queryDiscussionsByAuthorWithCompletion(
        user.pubkey,
        {
          idleTimeoutMs: nostrServiceConfig.defaultTimeout,
          hardTimeoutMs: nostrServiceConfig.defaultTimeout * 3,
        }
      );
      if (loadSequenceRef.current !== loadSequence) return;

      logger.info("settings discussions fetch completed", {
        authorPubkey: user.pubkey,
        completionReason: result.completionReason,
        eventCount: result.eventCount,
        elapsedMs: result.elapsedMs,
      });

      updateDiscussions(result.events);
      setDiscussionsCompletionReason(result.completionReason);
    } catch (error) {
      if (loadSequenceRef.current !== loadSequence) return;
      logger.error("Failed to load discussions in settings:", error);
      setMyDiscussions([]);
      setDiscussionsCompletionReason("hard-timeout");
    } finally {
      if (loadSequenceRef.current === loadSequence) {
        setIsLoadingDiscussions(false);
      }
    }
  }, [
    updateDiscussions,
    user.isLoggedIn,
    user.pubkey,
  ]);

  useEffect(() => {
    void loadDiscussions();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [loadDiscussions]);

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="py-8">
        <PageHeader
          title="設定"
          description="この機能は現在利用できません。"
        />
      </div>
    );
  }

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
    setIsLoggingOut(false);
  };

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <PageHeader
        title="設定"
        description="アカウント設定と認証情報を管理します。"
      />

      <div>
        <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="card-body">
            <h2 className="card-title mb-4 ruby-text">
              <span>アカウント情報</span>
            </h2>

            {user.isLoggedIn ? (
              <div className="space-y-6">
                {user.pubkey && <UserIdentity pubkey={user.pubkey} />}

                {user.profile?.about && (
                  <div>
                    <label className="label">
                      <span className="label-text font-medium ruby-text">
                        自己紹介
                      </span>
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-sm">{user.profile.about}</span>
                    </div>
                  </div>
                )}

                <div className="divider"></div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleLogout}
                    className="btn btn-warning min-h-[44px] rounded-full dark:rounded-sm"
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      ""
                    ) : (
                      <>
                        <ArrowRightOnRectangleIcon className="w-4 h-4" aria-hidden="true" />
                        <span className="ruby-text">ログアウト</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 ruby-text">
                    ログインしていません
                  </h3>
                </div>

                {error && (
                  <div className="alert alert-error mb-4">
                    <ExclamationCircleIcon className="stroke-current shrink-0 h-6 w-6" aria-hidden="true" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => setShowLoginModal(true)}
                    disabled={isLoading}
                    className="whitespace-nowrap text-base"
                  >
                    <span className="ruby-text">ログイン / アカウント作成</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 自作会話一覧セクション */}
        {user.isLoggedIn && (
          <div className="mt-8">
            <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="card-body">
                <h2 className="card-title mb-4 ruby-text">
                  <span>あなたが作った会話の一覧</span>
                </h2>

                {isLoadingDiscussions ? (
                  <div className="animate-pulse space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <div
                        key={i}
                        className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                      ></div>
                    ))}
                  </div>
                ) : myDiscussions.length > 0 ? (
                  <div className="space-y-4">
                    {myDiscussions.map((discussion) => {
                      const naddr = buildNaddrFromDiscussion(discussion);
                      return (
                        <div
                          key={discussion.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-start">
                            <div className="flex-1">
                              <Link
                                href={`/discussions/${naddr}`}
                                className="text-lg font-semibold dark:text-blue-400 dark:hover:text-blue-300 ruby-text"
                              >
                                {discussion.title}
                              </Link>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ruby-text">
                                {discussion.description}
                              </p>
                              <p className="text-gray-500 mt-2">
                                {formatRelativeTime(discussion.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : discussionsCompletionReason === "idle-timeout" ||
                  discussionsCompletionReason === "hard-timeout" ||
                  discussionsCompletionReason === "cancelled" ? (
                  <div className="alert alert-warning">
                    <span className="ruby-text">
                      会話データの取得に時間がかかっています（{discussionsCompletionReason}）。
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline min-h-[44px] rounded-full dark:rounded-sm"
                      onClick={() => {
                        void loadDiscussions();
                      }}
                    >
                      再読み込み
                    </button>
                  </div>
                ) : (
                  <div className="py-8">
                    <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 ruby-text">
                      まだ会話を作成していません
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 ruby-text">
                      新しい会話を作成して、地域の話題について話し合いましょう。
                    </p>
                    <Link
                      href="/discussions/create"
                      className="btn btn-primary rounded-full dark:rounded-sm"
                    >
                      <span className="ruby-text">会話を作成する</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="card-body">
              <h2 className="card-title mb-2 ruby-text">プライバシー</h2>
                <ul className="space-y-1 list-disc list-inside ruby-text">
                    <li>
                      あなたの投稿と評価はNostrプロトコルを通じて分散保存されます
                    </li>
                    <li>
                      認証情報（パスキー）はあなたのデバイスにのみ保存されます
                    </li>
                    <li>運営者はあなたの認証情報にアクセスできません</li>
                    <li>投稿は削除できない場合があります</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        
     
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
