"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

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

    setIsLoading(true);
    try {
      if (mode === "login") {
        await login();
      } else {
        await createAccount(username.trim() || undefined);
      }
      onClose();
      setUsername("");
      setMode("create");
    } catch (error) {
      console.error(
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {mode === "login" ? "ログイン" : "アカウント作成"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={isLoading}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

        <div className="mb-4">
          <div className="join mb-6">
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

          {mode === "login" ? (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                既存のパスキーを使用してログインします。
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                以前に作成したアカウントの生体認証または端末のPINでログインしてください。
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                新しいパスキーアカウントを作成します。
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                生体認証または端末のPINを使用してアカウントが作成されます。
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create" && (
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-2"
              >
                ユーザー名（任意）
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
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                空欄の場合はランダムな名前が生成されます
              </p>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
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
              {isLoading
                ? ""
                : mode === "login"
                ? "ログイン"
                : "アカウント作成"}
            </button>
          </div>
        </form>

        <div
          className={`mt-4 p-3 rounded-lg ${
            mode === "login"
              ? "bg-blue-50 dark:bg-blue-900/20"
              : "bg-green-50 dark:bg-green-900/20"
          }`}
        >
          <div className="flex items-start gap-2">
            <svg
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                mode === "login"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-green-600 dark:text-green-400"
              }`}
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
            <div
              className={`text-xs ${
                mode === "login"
                  ? "text-blue-800 dark:text-blue-200"
                  : "text-green-800 dark:text-green-200"
              }`}
            >
              {mode === "login" ? (
                <div>
                  <p className="font-medium mb-1">ログインについて</p>
                  <p>
                    保存されているパスキーを使用してログインします。アカウントをお持ちでない場合は「新規作成」タブを選択してください。
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium mb-1">アカウント作成について</p>
                  <p>
                    新しいパスキーが作成され、あなたのデバイスに安全に保存されます。このアカウントは以降のログインで使用できます。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
