import { Suspense } from "react";
import type { Metadata } from "next";
import AuthRoutePage from "@/components/auth/AuthRoutePage";

export const metadata: Metadata = {
  title: "ログイン | 風ぐるま",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" className="py-8 ruby-text">
          ログインページを読み込み中...
        </div>
      }
    >
      <AuthRoutePage mode="login" />
    </Suspense>
  );
}
