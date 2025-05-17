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
    <div className="h-full bg-base-200 w-80 border-r">
      <div className="p-4 space-y-4">
        <div className="collapse collapse-arrow border border-base-600">
          <input
            type="radio"
            name="my-accordion-2"
            defaultChecked
            aria-label="サイトの機能を開く"
          />
          <div className="collapse-title flex space-x-2 items-center">
            <RocketLaunchIcon className="h-6 w-6 text-primary" />
            <p className="font-semibold">使う</p>
          </div>
          <div className="collapse-content">
            <ul className="menu bg-base-200 w-full text-xl">
              <li>
                <Link
                  href="/"
                  onClick={toggleSidebar}
                  aria-label="ホームページに移動"
                >
                  <HomeIcon className="h-6 w-6 text-primary" />
                  ホーム
                </Link>
              </li>
              <li>
                <Link
                  href="/locations"
                  onClick={toggleSidebar}
                  aria-label="場所を探すページに移動"
                >
                  <MapPinIcon className="h-6 w-6 text-primary" />
                  場所をさがす
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="collapse collapse-arrow border border-base-600">
          <input
            type="radio"
            name="my-accordion-2"
            aria-label="使い方やサイト情報を開く"
          />
          <div className="collapse-title flex space-x-2 items-center">
            <InformationCircleIcon className="h-6 w-6 text-primary" />
            <p className="font-semibold">使い方やサイト情報</p>
          </div>
          <div className="collapse-content">
            <ul className="menu bg-base-200 w-full text-xl">
              <li>
                <Link
                  href="/beginners-guide"
                  onClick={toggleSidebar}
                  aria-label="はじめての方へのガイドページに移動"
                >
                  <QuestionMarkCircleIcon className="h-6 w-6 text-primary" />
                  はじめての方へ
                </Link>
              </li>
              <li>
                <Link
                  href="/usage"
                  onClick={toggleSidebar}
                  aria-label="使い方ページに移動"
                >
                  <BookOpenIcon className="h-6 w-6 text-primary" />
                  使い方
                </Link>
              </li>
              <li>
                <Link
                  href="/license"
                  onClick={toggleSidebar}
                  aria-label="ライセンス情報ページに移動"
                >
                  <DocumentTextIcon className="h-6 w-6 text-primary" />
                  ライセンス
                </Link>
              </li>
              <li>
                <a
                  href="https://halved-hamster-4a1.notion.site/1df78db44c3d80979856c735893403d4"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={toggleSidebar}
                  aria-label="更新情報ページを新しいタブで開く"
                >
                  <ArrowPathIcon className="h-6 w-6 text-primary" />
                  更新情報
                </a>
              </li>
            </ul>
          </div>
        </div>
        <ul className="menu bg-base-200 w-full text-xl">
          <li>
            <Link
              href="/site-map"
              onClick={toggleSidebar}
              aria-label="サイトマップページに移動"
            >
              <MapIcon className="h-6 w-6 text-primary" />
              サイトマップ
            </Link>
          </li>
          <li>
            <a
              href="https://ko-fi.com/nawashiro/tiers"
              target="_blank"
              rel="noopener noreferrer"
              onClick={toggleSidebar}
              aria-label="開発者を支援するページを新しいタブで開く"
            >
              <HeartIcon className="h-6 w-6 text-secondary" />
              開発者を支援する
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
