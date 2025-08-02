"use client";
import { useEffect, useState } from "react";
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
      initialIsDark ? "dark" : "light"
    );
  }, []);

  // テーマ切り替え処理
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);

    // HTML要素のdata-theme属性を更新
    document.documentElement.setAttribute(
      "data-theme",
      newTheme ? "dark" : "light"
    );

    // localStorageに設定を保存
    localStorage.setItem("theme", newTheme ? "dark" : "light");
  };

  return (
    <div className="flex cursor-pointer gap-2 items-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
      <label htmlFor="theme-toggle" className="sr-only">
        {isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      </label>
      <input
        id="theme-toggle"
        type="checkbox"
        checked={isDarkMode}
        onChange={toggleTheme}
        className="toggle theme-controller"
        aria-label={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </div>
  );
}
