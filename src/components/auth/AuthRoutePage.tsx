"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthenticationForm,
  type AuthenticationMode,
} from "@/components/auth/AuthenticationForm";
import PageHeader from "@/components/layouts/PageHeader";
import { resolveSafeReturnTarget } from "@/lib/navigation/safe-return-target";

interface AuthRoutePageProps {
  mode: AuthenticationMode;
}

export default function AuthRoutePage({ mode }: AuthRoutePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const reason = searchParams.get("reason");
  const isLogin = mode === "login";

  const handleSuccess = useCallback(() => {
    router.replace(resolveSafeReturnTarget(returnTo));
  }, [returnTo, router]);

  return (
    <div className="py-8">
      <section
        className="mx-auto max-w-md space-y-6"
        aria-labelledby="authentication-page-heading"
      >
        <PageHeader
          title={
            <span id="authentication-page-heading">
              {isLogin ? "ログイン" : "アカウント作成"}
            </span>
          }
          description={
            isLogin
              ? "保存されているパスキーでログインします。"
              : "新しいパスキーでアカウントを作成します。"
          }
        />

        {reason && (
          <p className="alert alert-info" role="status" aria-live="polite">
            <span className="ruby-text">{reason}</span>
          </p>
        )}

        <AuthenticationForm mode={mode} onSuccess={handleSuccess} />

        <p className="text-base ruby-text">
          {isLogin ? "アカウントをお持ちでない方は" : "すでにアカウントをお持ちの方は"}{" "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="link"
          >
            {isLogin ? "アカウント作成" : "ログイン"}
          </Link>
        </p>
      </section>
    </div>
  );
}
