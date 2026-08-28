import { Suspense } from "react";
import type { Metadata } from "next";
import AuthRoutePage from "@/components/auth/AuthRoutePage";

export const metadata: Metadata = {
  title: "アカウント作成 | 風ぐるま",
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" className="py-8 ruby-text">
          アカウント作成ページを読み込み中...
        </div>
      }
    >
      <AuthRoutePage mode="signup" />
    </Suspense>
  );
}
