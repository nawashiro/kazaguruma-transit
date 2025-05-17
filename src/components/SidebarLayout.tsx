"use client";

import { useEffect, useRef } from "react";
import Sidebar from "./Sidebar";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // ESCキーでサイドバーを閉じる機能
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && checkboxRef.current?.checked) {
        checkboxRef.current.checked = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleSidebar = () => {
    if (checkboxRef.current) {
      checkboxRef.current.checked = !checkboxRef.current.checked;
    }
  };

  const closeSidebar = () => {
    if (checkboxRef.current) {
      checkboxRef.current.checked = false;
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleSidebar();
    }
  };

  return (
    <div className="drawer lg:drawer-open">
      <input
        id="my-drawer"
        type="checkbox"
        className="drawer-toggle"
        ref={checkboxRef}
        aria-hidden="true"
      />
      <div className="drawer-content flex flex-col">
        <div className="navbar bg-base-100 lg:hidden">
          <div className="flex-none">
            <label
              htmlFor="my-drawer"
              className="btn btn-ghost gap-2"
              tabIndex={0}
              role="button"
              onKeyDown={handleMenuKeyDown}
              aria-label="メニューを開く"
              aria-expanded={checkboxRef.current?.checked || false}
              aria-controls="sidebar-menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-6 h-6 stroke-current"
                aria-hidden="true"
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
          </div>
        </div>
        <div className="flex-grow p-4">{children}</div>
        <footer className="flex flex-col md:flex-row px-4 py-2 justify-center md:justify-between">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 md:w-auto">
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80019017cfc156b181e3"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:underline inline-block mx-2"
            >
              利用規約
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80b2a6d4d045e850407c"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:underline inline-block mx-2"
            >
              プライバシーポリシー
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80d0ba82d66f451b9ff1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:underline inline-block mx-2"
            >
              クッキーポリシー
            </a>
          </div>
        </footer>
      </div>
      <div className="drawer-side">
        <label
          htmlFor="my-drawer"
          aria-label="メニューを閉じる"
          className="drawer-overlay"
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              closeSidebar();
            }
          }}
        ></label>
        <Sidebar toggleSidebar={closeSidebar} />
      </div>
    </div>
  );
}
