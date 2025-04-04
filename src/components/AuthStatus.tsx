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
      setLoading(true);
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // CSRFトークンがある場合は追加する
      });

      if (response.ok) {
        // セッション情報を更新
        setIsLoggedIn(false);
        setIsSupporter(false);
        setEmail(null);

        // ブラウザリロードによる状態完全リセット（オプション）
        window.location.href = "/";
      } else {
        const data = await response.json();
        console.error("ログアウトエラー:", data.message || "サーバーエラー");
        alert("ログアウト処理中にエラーが発生しました");
      }
    } catch (error) {
      console.error("ログアウトエラー:", error);
      alert("ログアウト処理中に通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();

    // ログイン状態変更イベントのリスナーを追加
    const handleAuthCompleted = () => {
      fetchSession();
    };

    // イベントリスナーを登録
    window.addEventListener("auth-completed", handleAuthCompleted);

    // クリーンアップ関数
    return () => {
      window.removeEventListener("auth-completed", handleAuthCompleted);
    };
  }, []);

  if (loading) {
    return <div className="badge badge-ghost">読み込み中...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="badge badge-ghost">未ログイン</span>
        <Button
          onClick={() => {
            // 支援者登録モーダルを開く
            const event = new CustomEvent("open-supporter-modal");
            window.dispatchEvent(event);
          }}
          secondary
          className="btn-sm"
        >
          私は支援者です
        </Button>
        {onLoginClick && (
          <Button onClick={onLoginClick} className="btn-sm">
            支援者登録
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div>
        <span className="opacity-70 mr-1">ログイン中:</span>
        <span className={isSupporter ? "text-success font-medium" : ""}>
          {email}
        </span>
        {isSupporter && (
          <span className="badge badge-success ml-2">支援者</span>
        )}
      </div>

      <Button onClick={handleLogout} secondary className="btn-sm">
        ログアウト
      </Button>
    </div>
  );
}
