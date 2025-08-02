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

      {/* ルビを表示 */}
      <Script
        src="https://rubyfuljs.s3.ap-northeast-1.amazonaws.com/rubyful.js"
        strategy="afterInteractive"
        onLoad={() => {
          logger.log("Rubyful.js loaded");
          setIsLoaded(true);

          const style = document.createElement("style");
          style.innerHTML = `
          button.rubyfuljs-button.is-customized {
            background-color: var(--color-base-100);
            color: var(--color-base-content);
            box-shadow: none;
            border: 1px solid var(--color-base-content);
          }
          .rubyfuljs-tooltip, .rubyfuljs-tooltip-close-button {
            background-color: var(--color-base-100);
            border: 1px solid var(--color-base-content);
          }
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
              className="btn btn-ghost drawer-button lg:hidden"
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
        <footer className="flex flex-col md:flex-row px-4 py-2 justify-center md:justify-between ruby-text">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 md:w-auto">
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80019017cfc156b181e3"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm /60 hover:underline inline-block mx-2"
            >
              利用規約
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80b2a6d4d045e850407c"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm /60 hover:underline inline-block mx-2"
            >
              プライバシーポリシー
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80d0ba82d66f451b9ff1"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm /60 hover:underline inline-block mx-2"
            >
              クッキーポリシー
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
