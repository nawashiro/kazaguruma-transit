"use client";

import Link from "next/link";
import {
  BookOpen,
  CircleHelp,
  FileText,
  Heart,
  House,
  Info,
  MapPin,
  MessageCircle,
  RefreshCw,
  Rocket,
  Settings,
  Trophy,
} from "lucide-react";
import { buildKoFiPageUrl } from "@/lib/config/ko-fi-config";
interface SidebarProps {
  toggleSidebar: () => void;
  koFiUsername: string | null;
}

export default function Sidebar({
  toggleSidebar,
  koFiUsername,
}: SidebarProps) {
  return (
    <nav
      aria-label="サイトナビゲーション"
      className="h-full w-80 border-r bg-base-200"
    >
      <ul className="menu p-4 space-y-4 w-full bg-base-200">
        <li>
          <details open>
            <summary className="group font-semibold ruby-text gap-0">
              <Rocket className="h-6 w-6" aria-hidden="true" />
              使う
            </summary>
            <ul className="menu w-full ">
              <li>
                <Link href="/" onClick={toggleSidebar} className="ruby-text gap-0">
                  <House className="h-6 w-6" aria-hidden="true" />
                  ホーム
                </Link>
              </li>
              <li>
                <Link href="/locations" onClick={toggleSidebar} className="ruby-text gap-0">
                  <MapPin className="h-6 w-6" aria-hidden="true" />
                  場所をさがす
                </Link>
              </li>
              <li>
                <Link href="/discussions" onClick={toggleSidebar} className="ruby-text gap-0">
                  <MessageCircle className="h-6 w-6" aria-hidden="true" />
                  意見交換
                </Link>
              </li>
            </ul>
          </details>
        </li>
        <li>
          <details open>
            <summary className="group font-semibold whitespace-nowrap ruby-text gap-0">
              <Info className="h-6 w-6" aria-hidden="true" />
              使い方やサイト情報
            </summary>
            <ul className="menu w-full ">
              <li>
                <Link
                  href="/beginners-guide"
                  onClick={toggleSidebar}
                  className="ruby-text gap-0"
                >
                  <CircleHelp className="h-6 w-6" aria-hidden="true" />
                  はじめての
                  <ruby>
                    方<rt>かた</rt>
                  </ruby>
                  へ
                </Link>
              </li>
              <li>
                <Link href="/usage" onClick={toggleSidebar} className="ruby-text gap-0">
                  <BookOpen className="h-6 w-6" aria-hidden="true" />
                  使い方
                </Link>
              </li>
              <li>
                <Link href="/award" onClick={toggleSidebar} className="ruby-text gap-0">
                  <Trophy className="h-6 w-6" aria-hidden="true" />
                  受賞について
                </Link>
              </li>
              <li>
                <Link href="/license" onClick={toggleSidebar} className="ruby-text gap-0">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                  ライセンス
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/nawashiro/kazaguruma-transit/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ruby-text gap-0"
                >
                  <RefreshCw className="h-6 w-6" aria-hidden="true" />
                  更新情報
                </a>
              </li>
            </ul>
          </details>
        </li>
        <li>
          <ul className="menu w-full ">
            <li>
              <Link href="/settings" onClick={toggleSidebar} className="ruby-text gap-0">
                <Settings className="h-6 w-6" aria-hidden="true" />
                設定
              </Link>
            </li>
            {koFiUsername && (
              <li>
                <a
                  href={buildKoFiPageUrl(koFiUsername)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={toggleSidebar}
                  className="ruby-text gap-0"
                >
                  <Heart className="h-6 w-6 text-error" aria-hidden="true" />
                  開発者を支援する
                </a>
              </li>
            )}
          </ul>
        </li>
      </ul>
    </nav>
  );
}
