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
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/solid";
interface SidebarProps {
  toggleSidebar: () => void;
}

export default function Sidebar({ toggleSidebar }: SidebarProps) {
  return (
    <aside className="h-full w-80 border-r bg-base-200">
      <ul className="menu p-4 space-y-4 w-full bg-base-200 ruby-text">
        <li>
          <details open>
            <summary className="group">
              <RocketLaunchIcon className="h-6 w-6" />
              <span className="font-semibold">使う</span>
            </summary>
            <ul role="menu" className="menu w-full ">
              <li>
                <Link role="menuitem" href="/" onClick={toggleSidebar}>
                  <HomeIcon className="h-6 w-6" />
                  <span>ホーム</span>
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/locations" onClick={toggleSidebar}>
                  <MapPinIcon className="h-6 w-6" />
                  <span>場所をさがす</span>
                </Link>
              </li>
              <li>
                <Link
                  role="menuitem"
                  href="/discussions"
                  onClick={toggleSidebar}
                >
                  <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  <span>意見交換</span>
                </Link>
              </li>
            </ul>
          </details>
        </li>
        <li>
          <details open>
            <summary className="group">
              <InformationCircleIcon className="h-6 w-6" />
              <span className="font-semibold whitespace-nowrap">
                使い方やサイト情報
              </span>
            </summary>
            <ul role="menu" className="menu w-full ">
              <li>
                <Link
                  role="menuitem"
                  href="/beginners-guide"
                  onClick={toggleSidebar}
                >
                  <QuestionMarkCircleIcon className="h-6 w-6" />
                  <span>
                    はじめての
                    <ruby>
                      方<rt>かた</rt>
                    </ruby>
                    へ
                  </span>
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/usage" onClick={toggleSidebar}>
                  <BookOpenIcon className="h-6 w-6" />
                  <span>使い方</span>
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/license" onClick={toggleSidebar}>
                  <DocumentTextIcon className="h-6 w-6" />
                  <span>ライセンス</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://halved-hamster-4a1.notion.site/1df78db44c3d80979856c735893403d4"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                >
                  <span className="inline">
                    <ArrowPathIcon className="h-6 w-6" />
                  </span>
                  <span>更新情報</span>
                </a>
              </li>
            </ul>
          </details>
        </li>
        <ul role="menu" className="menu w-full ">
          <li>
            <Link role="menuitem" href="/settings" onClick={toggleSidebar}>
              <Cog6ToothIcon className="h-6 w-6" />
              <span>設定</span>
            </Link>
          </li>
          <li>
            <Link role="menuitem" href="/site-map" onClick={toggleSidebar}>
              <MapIcon className="h-6 w-6" />
              <span>サイトマップ</span>
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
              <HeartIcon className="h-6 w-6 text-error" />
              <span>開発者を支援する</span>
            </a>
          </li>
        </ul>
      </ul>
    </aside>
  );
}
