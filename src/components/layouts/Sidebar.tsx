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
            <summary className="group">
              <Rocket className="h-6 w-6" aria-hidden="true" />
              <span className="font-semibold ruby-text">使う</span>
            </summary>
            <ul className="menu w-full ">
              <li>
                <Link href="/" onClick={toggleSidebar}>
                  <House className="h-6 w-6" aria-hidden="true" />
                  <span className="ruby-text">ホーム</span>
                </Link>
              </li>
              <li>
                <Link href="/locations" onClick={toggleSidebar}>
                  <MapPin className="h-6 w-6" aria-hidden="true" />
                  <span className="ruby-text">場所をさがす</span>
                </Link>
              </li>
              <li>
                <Link href="/discussions" onClick={toggleSidebar}>
                  <MessageCircle className="h-6 w-6" aria-hidden="true" />
                  <span className="ruby-text">意見交換</span>
                </Link>
              </li>
            </ul>
          </details>
        </li>
        <li>
          <details open>
            <summary className="group">
              <Info className="h-6 w-6" aria-hidden="true" />
              <span className="font-semibold whitespace-nowrap ruby-text">
                使い方やサイト情報
              </span>
            </summary>
            <ul className="menu w-full ">
              <li>
                <Link
                  href="/beginners-guide"
                  onClick={toggleSidebar}
                >
                  <CircleHelp className="h-6 w-6" aria-hidden="true" />
                  <span className="ruby-text">
                    はじめての
                    <ruby>
                      方<rt>かた</rt>
                    </ruby>
                    へ
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/usage" onClick={toggleSidebar}>
                  <BookOpen className="h-6 w-6" aria-hidden="true" />
                  <span className="ruby-text">使い方</span>
                </Link>
              </li>
              <li>
                <Link href="/award" onClick={toggleSidebar}>
                  <Trophy className="h-6 w-6" aria-hidden="true" />
                  <span className="ruby-text">受賞について</span>
                </Link>
              </li>
              <li>
                <Link href="/license" onClick={toggleSidebar}>
                  <FileText className="h-6 w-6" aria-hidden="true" />
                  <span className="ruby-text">ライセンス</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/nawashiro/kazaguruma-transit/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="inline">
                    <RefreshCw className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="ruby-text">更新情報</span>
                </a>
              </li>
            </ul>
          </details>
        </li>
        <li>
          <ul className="menu w-full ">
            <li>
              <Link href="/settings" onClick={toggleSidebar}>
                <Settings className="h-6 w-6" aria-hidden="true" />
                <span className="ruby-text">設定</span>
              </Link>
            </li>
            {koFiUsername && (
              <li>
                <a
                  href={buildKoFiPageUrl(koFiUsername)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={toggleSidebar}
                >
                  <Heart className="h-6 w-6 text-error" aria-hidden="true" />
                  <span className="ruby-text">開発者を支援する</span>
                </a>
              </li>
            )}
          </ul>
        </li>
      </ul>
    </nav>
  );
}
