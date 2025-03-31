"use client";

import React, { useState } from "react";
import Button from "./common/Button";
import { logger } from "../utils/logger";
import Link from "next/link";

// Ko-fiのリンク
const KOFI_TIER_PAGE_URL =
  process.env.KOFI_TIER_PAGE_URL || "https://ko-fi.com/nawashiro/tiers";

interface SupporterRegistrationProps {
  onComplete?: () => void;
}

export default function SupporterRegistration({
  onComplete,
}: SupporterRegistrationProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // メールアドレスを送信して確認コードを要求
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // メールアドレスのバリデーション
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("有効なメールアドレスを入力してください");
        setLoading(false);
        return;
      }

      // APIリクエスト
      const response = await fetch("/api/auth/supporter/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setStep("code");
      } else {
        setError(data.message || "エラーが発生しました");
      }
    } catch (error) {
      logger.error("メール送信エラー:", error);
      setError("確認メールの送信中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 確認コードを送信して認証を完了
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // コードのバリデーション
      if (!code || code.length < 6) {
        setError("有効な確認コードを入力してください");
        setLoading(false);
        return;
      }

      // APIリクエスト - 認証エンドポイントを使用
      const response = await fetch("/api/auth/supporter/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (data.success) {
        // 成功メッセージを設定
        setSuccess(data.message || "認証が完了しました！");

        // フォームをリセット
        setEmail("");
        setCode("");

        // ローカルストレージにログイン情報の痕跡を残さない（セキュリティ対策）
        // sessionStorageやlocalStorageにはメールアドレスなどの機密情報を保存しない

        // 確認が完了したらリダイレクトかUIの更新
        if (onComplete) {
          setTimeout(() => {
            // 認証完了のイベントを発火（オプション）
            const authEvent = new CustomEvent("auth-completed", {
              detail: { email },
            });
            window.dispatchEvent(authEvent);

            // 親コンポーネントのコールバックを実行
            onComplete();

            // ページリロードによるセッション適用
            window.location.href = window.location.pathname;
          }, 1500);
        }
      } else {
        setError(data.message || "認証に失敗しました");
        // 再試行を促すメッセージを追加
        if (data.message && data.message.includes("期限切れ")) {
          setError(data.message + " 新しいコードを要求してください。");
          // 再度メールフォームに戻るオプションを提供
          setStep("email");
        }
      }
    } catch (error) {
      logger.error("コード検証エラー:", error);
      setError(
        "コードの検証中にエラーが発生しました。ネットワーク接続を確認してください。"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4 text-gray-800">支援者登録</h2>

      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {/* Ko-fiへのリンクをエラーの下に表示 */}
      {error && error.includes("Ko-fiでの支援が確認できません") && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded">
          <p className="text-blue-700 mb-2">
            Ko-fiで支援者になると、すべての機能が利用できます：
          </p>
          <Link
            href={KOFI_TIER_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors text-center w-full"
          >
            Ko-fiで支援する
          </Link>
        </div>
      )}

      {success && (
        <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
          {success}
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={handleEmailSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              メールアドレスに確認コードを送信します。認証済みのメールでも再認証できます。
            </p>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "送信中..." : "確認コードを送信"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit}>
          <div className="mb-4">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              確認コード
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123456"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "確認中..." : "認証を完了"}
          </Button>
        </form>
      )}
    </>
  );
}
