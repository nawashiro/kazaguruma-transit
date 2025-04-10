"use client";

import { useEffect, useState } from "react";
import AuthStatus from "./AuthStatus";
import Sidebar from "./Sidebar";
import SupporterRegistrationModal from "./SupporterRegistrationModal";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSupporterModalOpen, setIsSupporterModalOpen] = useState(false);

  // カスタムイベントリスナーを追加
  useEffect(() => {
    const handleOpenSupporterModal = () => {
      setIsSupporterModalOpen(true);
    };

    window.addEventListener("open-supporter-modal", handleOpenSupporterModal);

    return () => {
      window.removeEventListener(
        "open-supporter-modal",
        handleOpenSupporterModal
      );
    };
  }, []);

  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        <div className="navbar bg-base-100 lg:hidden">
          <div className="flex-none">
            <label htmlFor="my-drawer" className="btn btn-ghost gap-2">
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
          <div className="mt-2 md:mt-0 flex justify-center md:justify-end">
            <AuthStatus />
          </div>
        </footer>
      </div>
      <div className="drawer-side">
        <label
          htmlFor="my-drawer"
          aria-label="close sidebar"
          className="drawer-overlay"
        ></label>
        <Sidebar
          toggleSidebar={() => {
            const checkbox = document.getElementById(
              "my-drawer"
            ) as HTMLInputElement;
            if (checkbox) checkbox.checked = false;
          }}
        />
      </div>

      {/* 支援者登録モーダル */}
      <SupporterRegistrationModal
        isOpen={isSupporterModalOpen}
        onClose={() => setIsSupporterModalOpen(false)}
      />
    </div>
  );
}
