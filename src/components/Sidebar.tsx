"use client";

import Link from "next/link";
import {
  HomeIcon,
  MapIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
  DocumentTextIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";

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
              <HomeIcon className="h-6 w-6" />
              ホーム
            </Link>
          </li>
          <li>
            <Link href="/locations" onClick={toggleSidebar}>
              <MapIcon className="h-6 w-6" />
              場所をさがす
            </Link>
          </li>
          <li>
            <Link href="/beginners-guide" onClick={toggleSidebar}>
              <QuestionMarkCircleIcon className="h-6 w-6" />
              はじめての方へ
            </Link>
          </li>
          <li>
            <Link href="/usage" onClick={toggleSidebar}>
              <BookOpenIcon className="h-6 w-6" />
              使い方
            </Link>
          </li>
          <li>
            <Link href="/license" onClick={toggleSidebar}>
              <DocumentTextIcon className="h-6 w-6" />
              データライセンス
            </Link>
          </li>
          <li>
            <a
              href="https://ko-fi.com/nawashiro/tiers"
              target="_blank"
              rel="noopener noreferrer"
              onClick={toggleSidebar}
            >
              <HeartIcon className="h-6 w-6" />
              Ko-fiでサポートする
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
