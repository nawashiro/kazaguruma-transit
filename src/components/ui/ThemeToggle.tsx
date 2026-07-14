"use client";
import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
/**
 * ダークモードとライトモードを切り替えるトグルボタン
 */
export default function ThemeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 初期化時にlocalStorageからテーマ設定を読み込む
  useEffect(() => {
    // localStorageからテーマ設定を取得
    const savedTheme = localStorage.getItem("theme");
    // システムのテーマ設定を確認
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    // localStorageに保存されている場合はその値を使用、なければシステム設定を使用
    const initialIsDark = savedTheme
      ? savedTheme === "dark"
      : systemPrefersDark;
    setIsDarkMode(initialIsDark);

    // HTML要素のdata-theme属性を設定
    document.documentElement.setAttribute(
      "data-theme",
      initialIsDark ? "dark" : "cupcake"
    );
  }, []);

  // テーマ切り替え処理
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);

    // HTML要素のdata-theme属性を更新
    document.documentElement.setAttribute(
      "data-theme",
      newTheme ? "dark" : "cupcake"
    );

    // localStorageに設定を保存
    localStorage.setItem("theme", newTheme ? "dark" : "light");
  };

  return (
    <div className="flex cursor-pointer gap-2 items-center">
      <SunIcon className="h-5 w-5" aria-hidden="true" />
      <label htmlFor="theme-toggle" className="sr-only">
        {isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      </label>
      <input
        id="theme-toggle"
        type="checkbox"
        checked={isDarkMode}
        onChange={toggleTheme}
        className="toggle theme-controller min-h-[44px] min-w-[44px]"
        aria-label={
          isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"
        }
      />
      <MoonIcon className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}
