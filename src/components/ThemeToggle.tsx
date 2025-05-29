"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

interface ThemeToggleProps {
  lightTheme?: string;
  darkTheme?: string;
}

// テーマの定数
const DEFAULT_LIGHT_THEME = "light";
const DEFAULT_DARK_THEME = "dark";

/**
 * ダークモードとライトモードを切り替えるトグルボタン
 */
export default function ThemeToggle({
  lightTheme = DEFAULT_LIGHT_THEME,
  darkTheme = DEFAULT_DARK_THEME,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<string>(lightTheme);

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
          setTheme(darkTheme);
          document.documentElement.setAttribute("data-theme", darkTheme);
        }
      }
    } catch (e) {
      console.error("テーマの読み込みに失敗しました", e);
    }
  }, [darkTheme]);

  // テーマの切り替え処理
  const toggleTheme = () => {
    const newTheme = theme === lightTheme ? darkTheme : lightTheme;
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    } catch (e) {
      console.error("テーマの保存に失敗しました", e);
    }
  };

  const isDarkMode = theme === darkTheme;

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost"
      aria-label={
        !isDarkMode ? "ダークモードに切り替え" : "ライトモードに切り替え"
      }
    >
      {!isDarkMode ? (
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
