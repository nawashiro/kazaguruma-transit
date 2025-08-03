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
      <ul className="menu p-4 space-y-4 w-full bg-base-200">
        <li>
          <details open>
            <summary className="group">
              <span>
                <RocketLaunchIcon className="h-6 w-6" />
              </span>
              <p className="font-semibold">
                <ruby>
                  使<rt>つか</rt>
                </ruby>
                う
              </p>
            </summary>
            <ul role="menu" className="menu w-full ">
              <li>
                <Link role="menuitem" href="/" onClick={toggleSidebar}>
                  <span className="inline">
                    <HomeIcon className="h-6 w-6" />
                  </span>
                  <p>ホーム</p>
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/locations" onClick={toggleSidebar}>
                  <span className="inline">
                    <MapPinIcon className="h-6 w-6" />
                  </span>
                  <p>
                    <ruby>
                      場所<rt>ばしょ</rt>
                    </ruby>
                    をさがす
                  </p>
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/discussions" onClick={toggleSidebar}>
                  <span className="inline">
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  </span>
                  <p>ディスカッション</p>
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
              <p className="font-semibold whitespace-nowrap">
                <ruby>
                  使<rt>つか</rt>
                </ruby>
                い
                <ruby>
                  方<rt>かた</rt>
                </ruby>
                やサイト
                <ruby>
                  情報<rt>じょうほう</rt>
                </ruby>
              </p>
            </summary>
            <ul role="menu" className="menu w-full ">
              <li>
                <Link
                  role="menuitem"
                  href="/beginners-guide"
                  onClick={toggleSidebar}
                >
                  <span className="inline">
                    <QuestionMarkCircleIcon className="h-6 w-6" />
                  </span>
                  <p>
                    はじめての
                    <ruby>
                      方<rt>かた</rt>
                    </ruby>
                    へ
                  </p>
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/usage" onClick={toggleSidebar}>
                  <span className="inline">
                    <BookOpenIcon className="h-6 w-6" />
                  </span>
                  <p>
                    <ruby>
                      使<rt>つか</rt>
                    </ruby>
                    い
                    <ruby>
                      方<rt>かた</rt>
                    </ruby>
                    へ
                  </p>
                </Link>
              </li>
              <li>
                <Link role="menuitem" href="/license" onClick={toggleSidebar}>
                  <span className="inline">
                    <DocumentTextIcon className="h-6 w-6" />
                  </span>
                  <p>ライセンス</p>
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
                  <p className="whitespace-nowrap">
                    <ruby>
                      更新<rt>こうしん</rt>
                    </ruby>
                    <ruby>
                      情報<rt>じょうほう</rt>
                    </ruby>
                  </p>
                </a>
              </li>
            </ul>
          </details>
        </li>
        <ul role="menu" className="menu w-full ">
          <li>
            <Link role="menuitem" href="/settings" onClick={toggleSidebar}>
              <span className="inline">
                <Cog6ToothIcon className="h-6 w-6" />
              </span>
              <p>設定</p>
            </Link>
          </li>
          <li>
            <Link role="menuitem" href="/site-map" onClick={toggleSidebar}>
              <span className="inline">
                <MapIcon className="h-6 w-6" />
              </span>
              <p>サイトマップ</p>
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
              <span className="inline">
                <HeartIcon className="h-6 w-6 text-secondary" />
              </span>
              <p>
                <ruby>
                  開発者<rt>かいはつしゃ</rt>
                </ruby>
                を
                <ruby>
                  支援<rt>しえん</rt>
                </ruby>
                する
              </p>
            </a>
          </li>
        </ul>
      </ul>
    </aside>
  );
}
