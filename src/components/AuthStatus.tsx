"use client";

import React, { useEffect, useState } from "react";
import Button from "./common/Button";

interface AuthStatusProps {
  onLoginClick?: () => void;
}

export default function AuthStatus({ onLoginClick }: AuthStatusProps) {
  const [isSupporter, setIsSupporter] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // セッション情報を取得
  const fetchSession = async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();

      if (data.success && data.data) {
        setIsLoggedIn(data.data.isLoggedIn);
        setIsSupporter(data.data.isSupporter || false);
        setEmail(data.data.email || null);
      } else {
        setIsLoggedIn(false);
        setIsSupporter(false);
        setEmail(null);
      }
    } catch (error) {
      console.error("セッション取得エラー:", error);
      setIsLoggedIn(false);
      setIsSupporter(false);
    } finally {
      setLoading(false);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        // セッション情報を更新
        setIsLoggedIn(false);
        setIsSupporter(false);
        setEmail(null);
      }
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500">読み込み中...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-500">未ログイン</span>
        {onLoginClick && (
          <Button onClick={onLoginClick} className="text-sm py-1 px-2">
            支援者登録
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
      <div className="text-sm">
        <span className="text-gray-600 mr-1">ログイン中:</span>
        <span
          className={`font-medium ${
            isSupporter ? "text-green-600" : "text-gray-700"
          }`}
        >
          {email}
        </span>
        {isSupporter && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            支援者
          </span>
        )}
      </div>

      <Button onClick={handleLogout} className="text-sm py-1 px-3">
        ログアウト
      </Button>
    </div>
  );
}
