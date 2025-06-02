"use client";

import Link from "next/link";
import {
  HomeIcon,
  MapIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  RocketLaunchIcon,
  InformationCircleIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/solid";
interface SidebarProps {
  toggleSidebar: () => void;
}

export default function Sidebar({ toggleSidebar }: SidebarProps) {
  return (
    <aside className="h-full w-80 border-r bg-base-200">
      <ul className="menu p-4 space-y-4 w-full bg-base-200">
        <li>
          <details open>
            <summary className="group">
              <span>
                <RocketLaunchIcon className="h-6 w-6" />
              </span>
              <p className="font-semibold">使う</p>
            </summary>
            <ul role="menu" className="menu w-full ">
              <li>
                <Link role="menuitem" href="/" onClick={toggleSidebar}>
                  <HomeIcon className="h-6 w-6" />
                  ホーム
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/locations" onClick={toggleSidebar}>
                  <MapPinIcon className="h-6 w-6" />
                  場所をさがす
                </Link>
              </li>
            </ul>
          </details>
        </li>
        <li>
          <details open>
            <summary className="group">
              <span>
                <InformationCircleIcon className="h-6 w-6" />
              </span>
              <p className="font-semibold">使い方やサイト情報</p>
            </summary>
            <ul role="menu" className="menu w-full ">
              <li>
                <Link
                  role="menuitem"
                  href="/beginners-guide"
                  onClick={toggleSidebar}
                >
                  <QuestionMarkCircleIcon className="h-6 w-6" />
                  はじめての方へ
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/usage" onClick={toggleSidebar}>
                  <BookOpenIcon className="h-6 w-6" />
                  使い方
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/license" onClick={toggleSidebar}>
                  <DocumentTextIcon className="h-6 w-6" />
                  ライセンス
                </Link>
              </li>
              <li>
                <a
                  href="https://halved-hamster-4a1.notion.site/1df78db44c3d80979856c735893403d4"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                >
                  <ArrowPathIcon className="h-6 w-6" />
                  更新情報
                </a>
              </li>
            </ul>
          </details>
        </li>
        <ul role="menu" className="menu w-full ">
          <li>
            <Link role="menuitem" href="/site-map" onClick={toggleSidebar}>
              <MapIcon className="h-6 w-6" />
              サイトマップ
            </Link>
          </li>
          <li>
            <a
              href="https://ko-fi.com/nawashiro/tiers"
              target="_blank"
              rel="noopener noreferrer"
              onClick={toggleSidebar}
              role="menuitem"
            >
              <HeartIcon className="h-6 w-6 text-secondary" />
              開発者を支援する
            </a>
          </li>
        </ul>
      </ul>
    </aside>
  );
}
