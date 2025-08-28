"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";
import { logger } from "@/utils/logger";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "create">("create");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const { login, createAccount, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return;

    const isCreateMode = mode === "create";
    const isUsernameEmpty = !username.trim();
    const areTermsNotAccepted =
      isCreateMode && (!termsAccepted || !privacyAccepted);

    if (isCreateMode && isUsernameEmpty) return;
    if (areTermsNotAccepted) return;

    setIsLoading(true);
    try {
      if (isCreateMode) {
        await createAccount(username.trim());
      } else {
        await login();
      }
      onClose();
      setUsername("");
      setMode("create");
      setTermsAccepted(false);
      setPrivacyAccepted(false);
    } catch (error) {
      const actionType = isCreateMode ? "Account creation" : "Login";
      logger.error(`${actionType} failed:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useRubyfulRun([mode], true);

  if (!isOpen) return null;

  return (
    <dialog
      open
      className="modal modal-open"
      aria-labelledby="login-modal-title"
      aria-describedby="login-modal-description"
    >
      <div className="modal-backdrop" onClick={handleBackdropClick}></div>
      <div className="modal-box bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <nav role="tablist" className="join" aria-label="モード選択">
            <button
              className={`join-item btn ruby-text ${
                mode === "create" ? "btn-active btn-primary" : ""
              }`}
              name="tab-options"
              aria-label="新規作成タブを開く"
              role="tab"
              area-selected={mode === "create" ? "true" : "false"}
              onClick={() => setMode("create")}
            >
              <span>新規作成</span>
            </button>
            <button
              className={`join-item btn ruby-text ${
                mode === "login" ? "btn-active btn-primary" : ""
              }`}
              name="tab-options"
              aria-label="ログインを開く"
              role="tab"
              area-selected={mode === "login" ? "true" : "false"}
              onClick={() => setMode("login")}
            >
              <span>ログイン</span>
            </button>
          </nav>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={isLoading}
            aria-label="モーダルを閉じる"
            type="button"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {mode === "create" ? (
          <div>
            <div className="mb-4" id="login-modal-description">
              <h2
                id="login-modal-title"
                className="text-xl font-bold mb-4 ruby-text"
              >
                アカウント作成
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 ruby-text">
                新しいパスキーが作成され、あなたのデバイスに安全に保存されます。端末の生体認証またはPINを使用してください。
              </p>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-4 text-blue-800 dark:text-blue-200 ruby-text">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm">
                  <p className="font-medium mb-1">ブラウザの対応状況</p>
                  <p>
                    ほとんどの場合は問題ありませんが、一部の環境では利用できない場合があります。お使いのブラウザがPRF対応である必要があります。
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                      href="https://github.com/ocknamo/nosskey-sdk/blob/main/docs/ja/prf-support-tables.ja.md"
                    >
                      こちら
                    </a>
                    から対応状況を確認できます。
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium mb-2 ruby-text"
                >
                  ユーザー名
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="表示名を入力してください"
                  disabled={isLoading}
                  maxLength={50}
                  autoComplete="off"
                  aria-describedby="username-help"
                  required
                />
              </div>

              <div className="space-y-3 mb-4">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span className="label-text text-sm ruby-text">
                      <a
                        href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80019017cfc156b181e3"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link"
                      >
                        利用規約
                      </a>
                      に同意します
                    </span>
                  </label>
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span className="label-text text-sm ruby-text">
                      <a
                        href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80b2a6d4d045e850407c"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link"
                      >
                        プライバシーポリシー
                      </a>
                      に同意します
                    </span>
                  </label>
                </div>
              </div>

              {error && (
                <div
                  className="alert alert-error"
                  role="alert"
                  aria-live="polite"
                >
                  <svg
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline flex-1 rounded-full dark:rounded-sm"
                  disabled={isLoading}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary flex-1 rounded-full dark:rounded-sm ${
                    isLoading ? "loading" : ""
                  }`}
                  disabled={
                    isLoading ||
                    !username.trim() ||
                    !termsAccepted ||
                    !privacyAccepted
                  }
                >
                  {!isLoading && (
                    <span className="ruby-text">アカウント作成</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-4" id="login-modal-description">
              <h2
                id="login-modal-title"
                className="text-xl font-bold mb-4 ruby-text"
              >
                ログイン
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 ruby-text">
                保存されているパスキーを使用してログインします。端末の生体認証またはPINを使用してください。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  className="alert alert-error"
                  role="alert"
                  aria-live="polite"
                >
                  <svg
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline flex-1 rounded-full dark:rounded-sm"
                  disabled={isLoading}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary flex-1 rounded-full dark:rounded-sm ${
                    isLoading ? "loading" : ""
                  }`}
                  disabled={isLoading}
                >
                  {!isLoading && <span className="ruby-text">ログイン</span>}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </dialog>
  );
}
