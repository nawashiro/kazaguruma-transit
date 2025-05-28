"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

/**
 * ダークモードとライトモードを切り替えるトグルボタン
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<string>("light");

  // ページロード時にローカルストレージからテーマを取得
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else {
        // ユーザーのシステム設定を確認
        if (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
          setTheme("dark");
          document.documentElement.setAttribute("data-theme", "dark");
        }
      }
    } catch (e) {
      console.error("テーマの読み込みに失敗しました", e);
    }
  }, []);

  // テーマの切り替え処理
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    } catch (e) {
      console.error("テーマの保存に失敗しました", e);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost"
      aria-label={
        theme === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え"
      }
    >
      {theme === "light" ? (
        <span className="flex gap-2">
          <MoonIcon className="h-6 w-6" />
          ダークモード
        </span>
      ) : (
        <span className="flex gap-2">
          <SunIcon className="h-6 w-6" />
          ライトモード
        </span>
      )}
    </button>
  );
}
