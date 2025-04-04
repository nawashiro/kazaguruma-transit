"use client";

import Link from "next/link";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
  return (
    <div className="h-full bg-base-200 w-80">
      <div className="p-4">
        <ul className="menu bg-base-200 w-full">
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
        </ul>
      </div>
    </div>
  );
}
