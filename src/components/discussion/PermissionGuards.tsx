"use client";

import React from "react";
import { isAdmin, isModerator } from "@/lib/nostr/nostr-utils";

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
}: PermissionNoticeProps) {
  if (!state.disabled || !state.reason) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3" role="status" aria-live="polite">
      <p className="text-base text-base-content">{state.reason}</p>
      {requiresLogin && (
        <button
          type="button"
          className="btn text-base btn-primary gap-0 ruby-text min-h-[44px] rounded-full dark:rounded-sm"
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
  id,
}: DisabledReasonTextProps) {
  if (!state.disabled || !state.reason) {
    return null;
  }

  return (
    <p id={id} role="note" aria-live="polite" className="text-base text-base-content mt-1">
      {state.reason}
    </p>
  );
}
