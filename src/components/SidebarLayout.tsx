"use client";

import Sidebar from "./Sidebar";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="drawer lg:drawer-open">
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
      <div className="drawer-content flex flex-col">
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
        <div className="flex-grow p-4">{children}</div>
        <footer className="flex flex-col md:flex-row px-4 py-2 justify-center md:justify-between">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 md:w-auto">
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80019017cfc156b181e3"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-base-content/60 hover:underline inline-block mx-2"
            >
              利用規約
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80b2a6d4d045e850407c"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-base-content/60 hover:underline inline-block mx-2"
            >
              プライバシーポリシー
            </a>
            <a
              href="https://halved-hamster-4a1.notion.site/1cf78db44c3d80d0ba82d66f451b9ff1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-base-content/60 hover:underline inline-block mx-2"
            >
              クッキーポリシー
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
