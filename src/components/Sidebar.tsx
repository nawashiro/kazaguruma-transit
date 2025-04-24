"use client";

import Link from "next/link";
import {
  HomeIcon,
  MapIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
  DocumentTextIcon,
  HeartIcon,
  ArrowPathIcon,
  RocketLaunchIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

interface SidebarProps {
  toggleSidebar: () => void;
}

export default function Sidebar({ toggleSidebar }: SidebarProps) {
  return (
    <div className="h-full bg-base-200 w-80 border-r">
      <div className="p-4 space-y-4">
        <div className="collapse collapse-arrow border border-base-600">
          <input type="radio" name="my-accordion-2" defaultChecked />
          <div className="collapse-title flex space-x-2 items-center">
            <RocketLaunchIcon className="h-6 w-6" />
            <p className="font-semibold">使う</p>
          </div>
          <div className="collapse-content">
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
            </ul>
          </div>
        </div>
        <div className="collapse collapse-arrow border border-base-600">
          <input type="radio" name="my-accordion-2" />
          <div className="collapse-title flex space-x-2 items-center">
            <InformationCircleIcon className="h-6 w-6" />
            <p className="font-semibold">使い方やサイト情報</p>
          </div>
          <div className="collapse-content">
            <ul className="menu bg-base-200 w-full text-xl">
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
                  ライセンス
                </Link>
              </li>
              <li>
                <a
                  href="https://halved-hamster-4a1.notion.site/1df78db44c3d80979856c735893403d4"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={toggleSidebar}
                >
                  <ArrowPathIcon className="h-6 w-6" />
                  更新情報
                </a>
              </li>
            </ul>
          </div>
        </div>
        <ul className="menu bg-base-200 w-full text-xl">
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
