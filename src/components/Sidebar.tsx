"use client";

import Link from "next/link";

interface SidebarProps {
  toggleSidebar: () => void;
}

export default function Sidebar({ toggleSidebar }: SidebarProps) {
  return (
    <div className="h-full bg-base-200 w-80 border-r">
      <div className="p-4">
        <ul className="menu bg-base-200 w-full text-xl">
          <li>
            <Link href="/" onClick={toggleSidebar}>
              ホーム
            </Link>
          </li>
          <li>
            <Link href="/locations" onClick={toggleSidebar}>
              場所をさがす
            </Link>
          </li>
          <li>
            <Link href="/beginners-guide" onClick={toggleSidebar}>
              はじめての方へ
            </Link>
          </li>
          <li>
            <Link href="/usage" onClick={toggleSidebar}>
              使い方
            </Link>
          </li>
          <li>
            <Link href="/license" onClick={toggleSidebar}>
              データライセンス
            </Link>
          </li>
          <li>
            <a
              href={process.env.NEXT_PUBLIC_KOFI_TIER_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={toggleSidebar}
            >
              Ko-fiでサポートする
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
