"use client";

import { useState } from "react";
import { Bars3Icon } from "@heroicons/react/24/outline";
import Sidebar from "./Sidebar";
import ThemeToggle from "../ui/ThemeToggle";
import SkipToContent from "../ui/SkipToContent";
import Script from "next/script";
import { logger } from "@/utils/logger";
import { loadRubyPreference, saveRubyPreference, observeRubyToggle } from "@/lib/preferences/ruby-preference";
import KoFiSupport from "@/components/features/KoFiSupport";
import type { KoFiContent } from "@/types/ko-fi";

const PAGE_CONTAINER_CLASS_NAME = "mx-auto w-full max-w-4xl px-4";

export default function SidebarLayout({
  children,
  koFiUsername,
  koFiContent,
}: {
  children: React.ReactNode;
  koFiUsername: string | null;
  koFiContent: KoFiContent;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="drawer lg:drawer-open">
      {/* Rubyful v2 */}
      <Script
        src="https://rubyful-v2.s3.ap-northeast-1.amazonaws.com/v2/rubyful.js?t=20250507022654"
        strategy="afterInteractive"
        onLoad={() => {
          // localStorageから設定を読み込む
          const savedPreference = loadRubyPreference();

          // RubyfulV2の初期化
          (window as any).RubyfulV2?.init({
            selector: ".ruby-text",
            defaultDisplay: savedPreference,
            observeChanges: true,
            styles: {
              toggleButtonClass: "my-toggle",
              toggleButtonText: {
                on: "ルビ ON",
                off: "ルビ OFF",
              },
            },
          });

          // トグル状態変更の監視を開始
          // observeRubyToggleは内部でボタンの生成を待つリトライ機能を持つ
          observeRubyToggle((newState) => {
            logger.log('Ruby toggle callback called with state:', newState);
            const saved = saveRubyPreference(newState);
            logger.log('Save result:', saved);
          });

          logger.log("Rubyful v2 loaded with saved preference");
        }}
      />
      <SkipToContent />
      <input
        id="drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={isDrawerOpen}
        onChange={(event) => setIsDrawerOpen(event.target.checked)}
        aria-label="ナビゲーションメニュー"
      />
      <div className="drawer-side z-40">
        <label
          htmlFor="drawer"
          aria-label="メニューを閉じる"
          className="drawer-overlay"
        ></label>
        <Sidebar
          koFiUsername={koFiUsername}
          toggleSidebar={() => {
            setIsDrawerOpen(false);
          }}
        />
      </div>
      <div className="drawer-content flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-2">
          <span>
            <button
              type="button"
              className="btn btn-ghost drawer-button lg:hidden rounded-full dark:rounded-sm"
              aria-expanded={isDrawerOpen}
              aria-controls="drawer"
              onClick={() => setIsDrawerOpen(true)}
            >
              <Bars3Icon className="inline-block w-6 h-6 stroke-current" aria-hidden="true" />
              <span className="ruby-text">メニュー</span>
            </button>
          </span>
          <ThemeToggle />
        </div>
        <main id="main-content" className="flex-grow" tabIndex={-1}>
          <div
            className={`${PAGE_CONTAINER_CLASS_NAME} flex flex-col gap-8`}
          >
            {children}
            {koFiUsername && (
              <KoFiSupport username={koFiUsername} content={koFiContent} />
            )}
          </div>
        </main>
        <footer className="py-4">
          <div
            className={`${PAGE_CONTAINER_CLASS_NAME} flex flex-col items-start justify-start gap-2 sm:flex-row sm:flex-wrap`}
          >
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80019017cfc156b181e3"
              target="_blank"
              rel="noopener noreferrer"
              className="link inline-block text-sm text-base-content/60 hover:underline ruby-text"
            >
              利用規約
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80b2a6d4d045e850407c"
              target="_blank"
              rel="noopener noreferrer"
              className="link inline-block text-sm text-base-content/60 hover:underline ruby-text"
            >
              プライバシーポリシー
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80d0ba82d66f451b9ff1"
              target="_blank"
              rel="noopener noreferrer"
              className="link inline-block text-sm text-base-content/60 hover:underline ruby-text"
            >
              クッキーポリシー
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
