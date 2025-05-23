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
    <aside className="h-full bg-base-200 w-80 border-r">
      <ul className="menu p-4 space-y-4 w-full text-base">
        <li>
          <details open>
            <summary className="group">
              <span>
                <RocketLaunchIcon className="h-6 w-6" />
              </span>
              <p className="font-semibold">使う</p>
            </summary>
            <ul className="menu w-full text-base">
              <li>
                <Link
                  href="/"
                  aria-label="ホームページに移動"
                  onClick={toggleSidebar}
                >
                  <HomeIcon className="h-6 w-6" />
                  ホーム
                </Link>
              </li>
              <li>
                <Link
                  href="/locations"
                  aria-label="場所を探すページに移動"
                  onClick={toggleSidebar}
                >
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
            <ul className="menu w-full text-base">
              <li>
                <Link
                  href="/beginners-guide"
                  aria-label="はじめての方へのガイドページに移動"
                  onClick={toggleSidebar}
                >
                  <QuestionMarkCircleIcon className="h-6 w-6" />
                  はじめての方へ
                </Link>
              </li>
              <li>
                <Link
                  href="/usage"
                  aria-label="使い方ページに移動"
                  onClick={toggleSidebar}
                >
                  <BookOpenIcon className="h-6 w-6" />
                  使い方
                </Link>
              </li>
              <li>
                <Link
                  href="/license"
                  aria-label="ライセンス情報ページに移動"
                  onClick={toggleSidebar}
                >
                  <DocumentTextIcon className="h-6 w-6" />
                  ライセンス
                </Link>
              </li>
              <li>
                <a
                  href="https://halved-hamster-4a1.notion.site/1df78db44c3d80979856c735893403d4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowPathIcon className="h-6 w-6" />
                  更新情報
                </a>
              </li>
            </ul>
          </details>
        </li>
        <ul className="menu w-full text-xl">
          <li>
            <Link
              href="/site-map"
              aria-label="サイトマップページに移動"
              onClick={toggleSidebar}
            >
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
