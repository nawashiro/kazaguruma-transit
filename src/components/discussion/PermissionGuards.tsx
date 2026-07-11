"use client";

import React from "react";
import { isAdmin, isModerator } from "@/lib/nostr/nostr-utils";
import Link from "next/link";

interface AdminCheckProps {
  children: React.ReactNode;
  adminPubkey: string;
  userPubkey?: string | null | undefined;
  fallback?: React.ReactNode;
}

export function AdminCheck({
  children,
  adminPubkey,
  userPubkey,
  fallback,
}: AdminCheckProps) {
  if (!isAdmin(userPubkey, adminPubkey)) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
}

interface ModeratorCheckProps {
  children: React.ReactNode;
  moderators: string[];
  adminPubkey?: string;
  userPubkey?: string | null | undefined;
  fallback?: React.ReactNode;
}

export function ModeratorCheck({
  children,
  moderators,
  adminPubkey,
  userPubkey,
  fallback,
}: ModeratorCheckProps) {
  if (!isModerator(userPubkey, moderators, adminPubkey)) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
}

interface AuthCheckProps {
  children: React.ReactNode;
  isLoggedIn: boolean;
  fallback?: React.ReactNode;
}

export function AuthCheck({ children, isLoggedIn, fallback }: AuthCheckProps) {
  if (!isLoggedIn) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
}

interface PermissionErrorProps {
  type: "admin" | "moderator" | "auth";
  message?: string;
}

export interface DisabledActionState {
  disabled: boolean;
  reason?: string;
}

export function buildDisabledActionState(
  allowed: boolean,
  reason: string
): DisabledActionState {
  return allowed ? { disabled: false } : { disabled: true, reason };
}

export function PermissionError({ type, message }: PermissionErrorProps) {
  const defaultMessages = {
    admin: "この操作は管理者のみ実行できます。",
    moderator: "この操作はモデレーターのみ実行できます。",
    auth: "この操作を実行するにはログインが必要です。",
  };

  return (
    <div className="text-center py-8">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
        アクセス権限がありません
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
        {message || defaultMessages[type]}
      </p>
      <Link
        href="/discussions"
        className="btn btn-primary rounded-full dark:rounded-sm"
      >
        会話一覧に戻る
      </Link>
    </div>
  );
}

interface DisabledReasonTextProps {
  state: DisabledActionState;
  className?: string;
  id?: string;
}

interface PermissionNoticeProps {
  state: DisabledActionState;
  requiresLogin: boolean;
  onLogin: () => void;
  className?: string;
}

export function PermissionNotice({
  state,
  requiresLogin,
  onLogin,
  className = "mt-2 flex flex-wrap items-center gap-3",
}: PermissionNoticeProps) {
  if (!state.disabled || !state.reason) {
    return null;
  }

  return (
    <div className={className} role="status" aria-live="polite">
      <p className="text-sm text-base-content/70">{state.reason}</p>
      {requiresLogin && (
        <button
          type="button"
          className="btn btn-primary btn-sm min-h-[44px] rounded-full dark:rounded-sm"
          onClick={onLogin}
        >
          ログイン
        </button>
      )}
    </div>
  );
}

export function DisabledReasonText({
  state,
  className = "text-sm text-base-content/70 mt-1",
  id,
}: DisabledReasonTextProps) {
  if (!state.disabled || !state.reason) {
    return null;
  }

  return (
    <p id={id} role="note" aria-live="polite" className={className}>
      {state.reason}
    </p>
  );
}
