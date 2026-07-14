"use client";

import React, { useState } from "react";
import {
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/auth/auth-context";
import { logger } from "@/utils/logger";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export function LoginModal({ isOpen, onClose, reason }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "create">("create");
  const [passkeyName, setPasskeyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const { login, createAccount, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return;

    const isCreateMode = mode === "create";
    const isPasskeyNameEmpty = !passkeyName.trim();
    const areTermsNotAccepted =
      isCreateMode && (!termsAccepted || !privacyAccepted);

    if (isCreateMode && isPasskeyNameEmpty) return;
    if (areTermsNotAccepted) return;

    setIsLoading(true);
    try {
      if (isCreateMode) {
        await createAccount(passkeyName.trim());
      } else {
        await login();
      }
      onClose();
      setPasskeyName("");
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

        {reason && (
          <p className="alert text-sm ruby-text mb-6">
            <span>{reason}</span>
          </p>
        )}
        <div className="flex justify-between items-center mb-4">
          <nav role="tablist" className="join" aria-label="モード選択">
            <button
              className={`join-item btn min-h-[44px] rounded-full dark:rounded-sm ${mode === "create" ? "btn-active btn-primary" : ""
                }`}
              name="tab-options"
              aria-label="新規作成タブを開く"
              role="tab"
              aria-selected={mode === "create"}
              onClick={() => setMode("create")}
            >
              <span className="ruby-text">新規作成</span>
            </button>
            <button
              className={`join-item btn min-h-[44px] rounded-full dark:rounded-sm ${mode === "login" ? "btn-active btn-primary" : ""
                }`}
              name="tab-options"
              aria-label="ログインを開く"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => setMode("login")}
            >
              <span className="ruby-text">ログイン</span>
            </button>
          </nav>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-full dark:rounded-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={isLoading}
            aria-label="モーダルを閉じる"
            type="button"
          >
            <XMarkIcon className="mx-auto w-6 h-6" aria-hidden="true" />
            {/*
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
            */}
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
                <InformationCircleIcon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
                {/*
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
                */}
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
                  htmlFor="passkey-name"
                  className="block text-sm font-medium mb-2 ruby-text"
                >
                  パスキー名
                </label>
                <input
                  type="text"
                  id="passkey-name"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  className="input w-full"
                  placeholder="パスキー名を入力してください"
                  disabled={isLoading}
                  maxLength={50}
                  autoComplete="off"
                  aria-describedby="passkey-name-help"
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
                  <ExclamationCircleIcon className="stroke-current shrink-0 h-6 w-6" aria-hidden="true" />
                  {/*
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
                  */}
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline min-h-[44px] flex-1 rounded-full dark:rounded-sm"
                  disabled={isLoading}
                >
                  <span className="ruby-text">キャンセル</span>
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary min-h-[44px] flex-1 rounded-full dark:rounded-sm ${isLoading ? "loading" : ""
                    }`}
                  disabled={
                    isLoading ||
                    !passkeyName.trim() ||
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
                  <ExclamationCircleIcon className="stroke-current shrink-0 h-6 w-6" aria-hidden="true" />
                  {/*
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
                  */}
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline min-h-[44px] flex-1 rounded-full dark:rounded-sm"
                  disabled={isLoading}
                >
                  <span className="ruby-text">キャンセル</span>
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary min-h-[44px] flex-1 rounded-full dark:rounded-sm ${isLoading ? "loading" : ""
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
