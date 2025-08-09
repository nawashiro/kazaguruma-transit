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
  const { login, createAccount, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (mode === "create" && !username.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "login") {
        await login();
      } else {
        await createAccount(username.trim());
      }
      onClose();
      setUsername("");
      setMode("create");
    } catch (error) {
      logger.error(
        `${mode === "login" ? "Login" : "Account creation"} failed:`,
        error
      );
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
        <div className="flex justify-between items-center mb-6">
          <div className="join" role="group" aria-label="モード選択">
            <input
              className="join-item btn"
              type="radio"
              name="mode-options"
              aria-label="新規作成"
              checked={mode === "create"}
              onChange={() => setMode("create")}
              disabled={isLoading}
            />
            <input
              className="join-item btn"
              type="radio"
              name="mode-options"
              aria-label="ログイン"
              checked={mode === "login"}
              onChange={() => setMode("login")}
              disabled={isLoading}
            />
          </div>
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

        <div className="mb-4" id="login-modal-description">
          <h2
            id="login-modal-title"
            className="text-xl font-bold mb-4 ruby-text"
          >
            {mode === "login" ? "ログイン" : "アカウント作成"}
          </h2>

          {mode === "login" ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 ruby-text">
              保存されているパスキーを使用してログインします。端末の生体認証またはPINを使用してください。
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 ruby-text">
              新しいパスキーが作成され、あなたのデバイスに安全に保存されます。端末の生体認証またはPINを使用してください。
            </p>
          )}
        </div>

        {mode == "create" && (
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
              <div className="text-xs">
                <p className="font-medium mb-1">ブラウザの対応状況</p>
                <p>
                  このウェブサイトはPRF拡張を使用します。一部の環境では利用できない場合があります。
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
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create" && (
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
          )}

          {error && (
            <div className="alert alert-error" role="alert" aria-live="polite">
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
              disabled={isLoading || (mode === "create" && !username.trim())}
            >
              {isLoading
                ? ""
                : mode === "login"
                ? "ログイン"
                : "アカウント作成"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
