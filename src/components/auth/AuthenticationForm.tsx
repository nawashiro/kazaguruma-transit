"use client";

import React, { useId, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

export type AuthenticationMode = "login" | "signup";

export interface AuthenticationFormProps {
  mode: AuthenticationMode;
  onSuccess?: () => void | Promise<void>;
}

function formatAuthenticationError(
  mode: AuthenticationMode,
  error: unknown,
): string {
  const message = error instanceof Error ? error.message : "";
  const normalizedError = (
    error instanceof Error ? `${error.name} ${error.message}` : String(error)
  ).toLowerCase();
  const isUnsupported =
    normalizedError.includes("notsupportederror") ||
    normalizedError.includes("not supported") ||
    normalizedError.includes("unsupported") ||
    normalizedError.includes("notavailable") ||
    normalizedError.includes("not available") ||
    normalizedError.includes("unavailable") ||
    normalizedError.includes("未対応") ||
    normalizedError.includes("利用できません") ||
    normalizedError.includes("サポートされていません");
  const wasCancelled =
    normalizedError.includes("cancel") ||
    normalizedError.includes("abort") ||
    normalizedError.includes("notallowed") ||
    normalizedError.includes("not allowed") ||
    message.includes("キャンセル");

  if (isUnsupported) {
    return mode === "login"
      ? "この環境ではパスキー認証を利用できません。対応ブラウザをご確認ください。"
      : "この環境ではパスキーを作成できません。対応ブラウザをご確認ください。";
  }

  if (mode === "login") {
    if (wasCancelled) {
      return "パスキー認証がキャンセルされました。もう一度お試しください。";
    }
    if (message && /[ぁ-んァ-ン一-龥]/.test(message)) {
      return message;
    }
    return "ログインに失敗しました。もう一度お試しください。";
  }

  if (wasCancelled) {
    return "パスキー作成がキャンセルされました。再度お試しください。";
  }
  if (message && /[ぁ-んァ-ン一-龥]/.test(message)) {
    return message;
  }
  return "アカウント作成に失敗しました。もう一度お試しください。";
}

function getValidationMessage(
  inputId: string,
  fieldIds: {
    passkeyNameId: string;
    termsId: string;
    privacyId: string;
  },
): string {
  if (inputId === fieldIds.passkeyNameId) {
    return "パスキー名を入力してください。";
  }
  if (inputId === fieldIds.termsId) {
    return "利用規約への同意が必要です。";
  }
  if (inputId === fieldIds.privacyId) {
    return "プライバシーポリシーへの同意が必要です。";
  }
  return "入力内容を確認してください。";
}

export function AuthenticationForm({
  mode,
  onSuccess,
}: AuthenticationFormProps) {
  const { login, createAccount } = useAuth();
  const [passkeyName, setPasskeyName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const idPrefix = useId().replace(/:/g, "");
  const passkeyNameId = `${idPrefix}-passkey-name`;
  const termsId = `${idPrefix}-terms-accepted`;
  const privacyId = `${idPrefix}-privacy-accepted`;
  const errorId = `${idPrefix}-authentication-error`;

  const handleInvalid = (event: React.InvalidEvent<HTMLInputElement>) => {
    event.preventDefault();
    setAttemptError(
      getValidationMessage(event.currentTarget.id, {
        passkeyNameId,
        termsId,
        privacyId,
      }),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;

    setAttemptError(null);
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        await createAccount(passkeyName.trim());
      } else {
        await login();
      }
      await onSuccess?.();
    } catch (error) {
      setAttemptError(formatAuthenticationError(mode, error));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-label={mode === "login" ? "ログイン" : "アカウント作成"}
    >
      {mode === "signup" && (
        <>
          <div>
            <label
              htmlFor={passkeyNameId}
              className="block text-base font-medium mb-2 ruby-text"
            >
              パスキー名
            </label>
            <input
              id={passkeyNameId}
              type="text"
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              className="input w-full"
              placeholder="パスキー名を入力してください"
              maxLength={50}
              autoComplete="off"
              required
              disabled={isSubmitting}
              aria-describedby={attemptError ? errorId : undefined}
              onInvalid={handleInvalid}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-base font-medium ruby-text">
              利用規約とプライバシーポリシーへの同意
            </legend>
            <label
              htmlFor={termsId}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                id={termsId}
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                required
                disabled={isSubmitting}
                aria-describedby={attemptError ? errorId : undefined}
                onInvalid={handleInvalid}
              />
              <span className="text-base ruby-text">
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
            <label
              htmlFor={privacyId}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                id={privacyId}
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
                required
                disabled={isSubmitting}
                aria-describedby={attemptError ? errorId : undefined}
                onInvalid={handleInvalid}
              />
              <span className="text-base ruby-text">
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
          </fieldset>
        </>
      )}

      {attemptError && (
        <div
          id={errorId}
          className="alert alert-error"
          role="alert"
          aria-live="polite"
        >
          <span className="text-base ruby-text">{attemptError}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn text-base btn-primary min-h-[44px] w-full rounded-full dark:rounded-sm"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        <span className="ruby-text">
          {mode === "login" ? "ログイン" : "アカウント作成"}
        </span>
      </button>
    </form>
  );
}
