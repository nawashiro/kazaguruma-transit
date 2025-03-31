"use client";

import React, { useState } from "react";
import Button from "./common/Button";
import { logger } from "../utils/logger";

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
        setSuccess(data.message);

        // 確認が完了したら親コンポーネントに通知
        if (onComplete) {
          setTimeout(() => {
            onComplete();
          }, 1500);
        }
      } else {
        setError(data.message || "認証に失敗しました");
      }
    } catch (error) {
      logger.error("コード検証エラー:", error);
      setError("コードの検証中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md max-w-md w-full">
      <h2 className="text-xl font-bold mb-4 text-gray-800">支援者登録</h2>

      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>
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
    </div>
  );
}
