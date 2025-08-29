"use client";

import { useState, Suspense } from "react";
import Sidebar from "./Sidebar";
import ThemeToggle from "../ui/ThemeToggle";
import SkipToContent from "../ui/SkipToContent";
import Script from "next/script";
import { logger } from "@/utils/logger";
import { usePathname, useSearchParams } from "next/navigation";
import { useRubyfulRun } from "@/lib/rubyful/rubyfulRun";

// useSearchParams()を使用する部分を別コンポーネントに分離
function RubyfulInitializer({ isLoaded }: { isLoaded: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useRubyfulRun([pathname, searchParams, isLoaded], isLoaded);

  return null;
}

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="drawer lg:drawer-open">
      {/* Suspenseで囲まれたRubyful初期化 */}
      <Suspense fallback={null}>
        <RubyfulInitializer isLoaded={isLoaded} />
      </Suspense>

      {/* Rubyful v2 */}
      <Script
        src="https://rubyful-v2.s3.ap-northeast-1.amazonaws.com/v2/rubyful.js?t=20250507022654"
        strategy="afterInteractive"
        onLoad={() => {
          logger.log("Rubyful v2 loaded");
          setIsLoaded(true);

          // RubyfulV2の初期化
          (window as any).RubyfulV2?.init({
            selector: ".ruby-text",
            defaultDisplay: true,
            styles: {
              toggleButtonClass: "my-toggle",
              toggleButtonText: {
                on: "ルビ ON",
                off: "ルビ OFF",
              },
            },
          });

          const style = document.createElement("style");
          style.innerHTML = `
          
          `;
          document.body.appendChild(style);
        }}
      />
      <SkipToContent />
      <input id="drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-side z-40">
        <label
          htmlFor="drawer"
          aria-label="メニューを閉じる"
          className="drawer-overlay"
        ></label>
        <Sidebar
          toggleSidebar={() => {
            const checkbox = document.getElementById(
              "drawer"
            ) as HTMLInputElement;
            if (checkbox) checkbox.checked = false;
          }}
        />
      </div>
      <div className="drawer-content flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-2">
          <span>
            <label
              htmlFor="drawer"
              className="btn btn-ghost drawer-button lg:hidden rounded-full dark:rounded-sm"
              role="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-6 h-6 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
              メニュー
            </label>
          </span>
          <ThemeToggle />
        </div>
        <div id="main-content" className="flex-grow p-4" tabIndex={-1}>
          {children}
        </div>
        <footer className="flex flex-col md:flex-row px-4 py-2 justify-center md:justify-between">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 md:w-auto">
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80019017cfc156b181e3"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm /60 hover:underline inline-block mx-2 ruby-text"
            >
              利用規約
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80b2a6d4d045e850407c"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm /60 hover:underline inline-block mx-2 ruby-text"
            >
              プライバシーポリシー
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80d0ba82d66f451b9ff1"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm /60 hover:underline inline-block mx-2 ruby-text"
            >
              クッキーポリシー
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
