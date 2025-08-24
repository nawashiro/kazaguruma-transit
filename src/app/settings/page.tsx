"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import {
  hexToNpub,
  parseDiscussionEvent,
  formatRelativeTime,
} from "@/lib/nostr/nostr-utils";
import { buildNaddrFromDiscussion } from "@/lib/nostr/naddr-utils";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { LoginModal } from "@/components/discussion/LoginModal";
import Button from "@/components/ui/Button";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import type { Discussion } from "@/types/discussion";
import { logger } from "@/utils/logger";

const nostrService = createNostrService(getNostrServiceConfig());

export default function SettingsPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [myDiscussions, setMyDiscussions] = useState<Discussion[]>([]);
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [isDeletingDiscussion, setIsDeletingDiscussion] = useState(false);

  const { user, logout, isLoading, error, signEvent } = useAuth();

  useRubyfulRun([isLoading], !isLoading);

  const loadMyDiscussions = useCallback(async () => {
    if (!user.isLoggedIn || !user.pubkey) return;

    setIsLoadingDiscussions(true);
    try {
      const discussionEvents = await nostrService.getDiscussions(user.pubkey);
      const parsedDiscussions = discussionEvents
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      setMyDiscussions(parsedDiscussions);
    } catch (error) {
      logger.error("Failed to load user discussions:", error);
    } finally {
      setIsLoadingDiscussions(false);
    }
  }, [user.isLoggedIn, user.pubkey]);

  useEffect(() => {
    if (user.isLoggedIn && isDiscussionsEnabled()) {
      loadMyDiscussions();
    }
  }, [user.isLoggedIn, loadMyDiscussions]);

  const handleDeleteDiscussion = async (discussionId: string) => {
    if (!user.isLoggedIn || !signEvent) return;

    const discussion = myDiscussions.find((d) => d.id === discussionId);
    if (!discussion?.event?.id) return;

    setIsDeletingDiscussion(true);
    try {
      const deleteEvent = {
        kind: 5,
        content: "",
        tags: [["e", discussion.event.id]],
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await signEvent(deleteEvent);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish delete event to relays");
      }

      // 削除した会話をリストから除去
      setMyDiscussions((prev) => prev.filter((d) => d.id !== discussionId));
      setShowDeleteConfirm(null);
    } catch (error) {
      logger.error("Failed to delete discussion:", error);
    } finally {
      setIsDeletingDiscussion(false);
    }
  };

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8 ruby-text">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">設定</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
    setIsLoggingOut(false);
  };

  const handleCopyPubkey = async () => {
    if (!user.pubkey) return;

    try {
      const npubKey = hexToNpub(user.pubkey);
      await navigator.clipboard.writeText(npubKey);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      logger.error("Failed to copy to clipboard:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 ruby-text">設定</h1>
        <p className="text-gray-600 dark:text-gray-400 ruby-text">
          アカウント設定と認証情報を管理します。
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="card-body">
            <h2 className="card-title mb-4 ruby-text">
              <span>アカウント情報</span>
            </h2>

            {user.isLoggedIn ? (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="ruby-text">
                    <label className="label">
                      <span className="label-text font-medium">ユーザー名</span>
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-sm">
                        {user.profile?.name || "未設定"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium ruby-text">
                        ユーザーID
                      </span>
                    </label>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="font-mono text-xs break-all flex-1">
                        {user.pubkey ? hexToNpub(user.pubkey) : "N/A"}
                      </span>
                      {user.pubkey && (
                        <button
                          onClick={handleCopyPubkey}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                          title="クリップボードにコピー"
                        >
                          {isCopied ? (
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-gray-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

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

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg ruby-text">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">認証について</p>
                      <p>
                        あなたのアカウントはパスキーで保護されています。
                        ログアウトすると、再度生体認証または端末のPINでのログインが必要になります。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleLogout}
                    className="btn btn-warning rounded-full dark:rounded-sm"
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      ""
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        ログアウト
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="text-center mb-6">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    ログインしていません
                  </h3>
                </div>

                {error && (
                  <div className="alert alert-error mb-4">
                    <svg
                      className="stroke-current shrink-0 h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => setShowLoginModal(true)}
                    disabled={isLoading}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                      />
                    </svg>
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
                          <div className="flex items-start justify-between">
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
                              <p className="text-xs text-gray-500 mt-2">
                                作成日:{" "}
                                {formatRelativeTime(discussion.createdAt)}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Link
                                href={`/discussions/${naddr}/edit`}
                                className="btn btn-outline btn-sm rounded-full dark:rounded-sm"
                              >
                                編集
                              </Link>
                              <button
                                onClick={() =>
                                  setShowDeleteConfirm(discussion.id)
                                }
                                className="btn btn-error btn-outline btn-sm rounded-full dark:rounded-sm"
                                disabled={isDeletingDiscussion}
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 ruby-text">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      まだ会話を作成していません
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      新しい会話を作成して、地域の話題について話し合いましょう。
                    </p>
                    <Link
                      href="/discussions/create"
                      className="btn btn-primary rounded-full dark:rounded-sm"
                    >
                      会話を作成する
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 ruby-text">
            <div className="card-body">
              <h2 className="card-title mb-4">プライバシー</h2>

              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <h3 className="font-medium mb-2">データの保存について</h3>
                  <ul className="space-y-1 list-disc list-inside">
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

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <h3 className="font-medium mb-2">匿名性について</h3>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      メールアドレスやデバイス情報などの個人情報は送信されません
                    </li>
                    <li>ユーザーIDは技術的な目的でのみ使用されます</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg ruby-text">会話の削除</h3>
            <p className="py-4 ruby-text">
              この会話を削除しますか？この操作は取り消せません。
            </p>
            <div className="modal-action">
              <button
                className="btn btn-outline rounded-full dark:rounded-sm"
                onClick={() => setShowDeleteConfirm(null)}
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDeleteDiscussion(showDeleteConfirm)}
                className="btn btn-error rounded-full dark:rounded-sm"
                disabled={isDeletingDiscussion}
              >
                削除
              </button>
            </div>
          </div>
        </dialog>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
