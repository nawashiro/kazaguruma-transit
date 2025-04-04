"use client";

import Link from "next/link";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
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
            <Link href="/beginners-guide" onClick={toggleSidebar}>
              はじめての方へ
            </Link>
          </li>
          <li>
            <Link href="/locations" onClick={toggleSidebar}>
              場所をさがす
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
