"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { LoginModal } from "@/components/discussion/LoginModal";
import { CreateAccountModal } from "@/components/discussion/CreateAccountModal";

export default function SettingsPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { user, logout, refreshProfile, isLoading, error } = useAuth();

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
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

  const handleRefreshProfile = async () => {
    try {
      await refreshProfile();
    } catch (error) {
      console.error("Failed to refresh profile:", error);
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
        <h1 className="text-3xl font-bold mb-4">設定</h1>
        <p className="text-gray-600 dark:text-gray-400">
          アカウント設定と認証情報を管理します。
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="card-body">
            <h2 className="card-title mb-4">アカウント情報</h2>

            {user.isLoggedIn ? (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
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
                      <span className="label-text font-medium">公開鍵</span>
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="font-mono text-xs break-all">
                        {user.pubkey}
                      </span>
                    </div>
                  </div>
                </div>

                {user.profile?.about && (
                  <div>
                    <label className="label">
                      <span className="label-text font-medium">自己紹介</span>
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-sm">{user.profile.about}</span>
                    </div>
                  </div>
                )}

                <div className="divider"></div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleRefreshProfile}
                    className="btn btn-outline"
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    プロフィール更新
                  </button>

                  <button
                    onClick={handleLogout}
                    className={`btn btn-error ${isLoggingOut ? "loading" : ""}`}
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

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
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
                        あなたのアカウントはPasskeyで保護されています。
                        ログアウトすると、再度生体認証または端末のPINでのログインが必要になります。
                      </p>
                    </div>
                  </div>
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    アカウント設定にアクセスするにはログインまたはアカウント作成が必要です。
                  </p>
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
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="btn btn-primary"
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
                    ログイン / アカウント作成
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
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
                      認証情報（Passkey）はあなたのデバイスにのみ保存されます
                    </li>
                    <li>運営者はあなたの秘密鍵にアクセスできません</li>
                    <li>投稿は削除できない場合があります</li>
                  </ul>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <h3 className="font-medium mb-2">匿名性について</h3>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      メールアドレスやデバイス情報などの個人情報は送信されません
                    </li>
                    <li>公開鍵は技術的な目的でのみ使用されます</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      <CreateAccountModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
