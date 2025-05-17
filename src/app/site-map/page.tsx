import Link from "next/link";
import { Metadata } from "next";
import {
  HomeIcon,
  MapIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "サイトマップ | 風ぐるま乗換案内【非公式】",
  description:
    "風ぐるま乗換案内サイトのサイトマップです。サイト内の全てのページへのリンクが掲載されています。",
};

export default function SiteMapPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 border-b-2 pb-2">サイトマップ</h1>

      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 border-l-4 border-primary pl-3">
          メインコンテンツ
        </h2>
        <ul className="space-y-3 ml-4">
          <li className="flex items-center">
            <HomeIcon className="h-5 w-5 mr-2 text-primary" />
            <Link
              href="/"
              className="text-lg hover:underline focus:ring-2 ring-primary p-1 rounded transition-all"
              aria-label="ホームページに移動する"
            >
              ホーム
            </Link>
            <span className="ml-3 text-gray-600">- 路線検索と乗り換え案内</span>
          </li>
          <li className="flex items-center">
            <MapPinIcon className="h-5 w-5 mr-2 text-primary" />
            <Link
              href="/locations"
              className="text-lg hover:underline focus:ring-2 ring-primary p-1 rounded transition-all"
              aria-label="場所を探すページに移動する"
            >
              場所をさがす
            </Link>
            <span className="ml-3 text-gray-600">
              - 風ぐるまで行ける施設をカテゴリや距離で検索
            </span>
          </li>
        </ul>
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 border-l-4 border-primary pl-3">
          使い方情報
        </h2>
        <ul className="space-y-3 ml-4">
          <li className="flex items-center">
            <QuestionMarkCircleIcon className="h-5 w-5 mr-2 text-primary" />
            <Link
              href="/beginners-guide"
              className="text-lg hover:underline focus:ring-2 ring-primary p-1 rounded transition-all"
              aria-label="はじめての方へのガイドページに移動する"
            >
              はじめての方へ
            </Link>
            <span className="ml-3 text-gray-600">
              - 風ぐるまの基本情報とサービスの使い方
            </span>
          </li>
          <li className="flex items-center">
            <BookOpenIcon className="h-5 w-5 mr-2 text-primary" />
            <Link
              href="/usage"
              className="text-lg hover:underline focus:ring-2 ring-primary p-1 rounded transition-all"
              aria-label="使い方ページに移動する"
            >
              使い方
            </Link>
            <span className="ml-3 text-gray-600">
              - 乗換案内の詳しい使用方法
            </span>
          </li>
        </ul>
      </div>
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 border-l-4 border-primary pl-3">
          サイト情報
        </h2>
        <ul className="space-y-3 ml-4">
          <li className="flex items-center">
            <DocumentTextIcon className="h-5 w-5 mr-2 text-primary" />
            <Link
              href="/license"
              className="text-lg hover:underline focus:ring-2 ring-primary p-1 rounded transition-all"
              aria-label="ライセンス情報ページに移動する"
            >
              ライセンス
            </Link>
            <span className="ml-3 text-gray-600">
              - オープンデータとサービスのライセンス情報
            </span>
          </li>
          <li className="flex items-center">
            <ArrowPathIcon className="h-5 w-5 mr-2 text-primary" />
            <a
              href="https://halved-hamster-4a1.notion.site/1df78db44c3d80979856c735893403d4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg hover:underline focus:ring-2 ring-primary p-1 rounded transition-all"
              aria-label="更新情報ページを新しいタブで開く"
            >
              更新情報
            </a>
            <span className="ml-3 text-gray-600">- サービスの更新履歴</span>
          </li>
          <li className="flex items-center">
            <MapIcon className="h-5 w-5 mr-2 text-primary" />
            <Link
              href="/site-map"
              className="text-lg hover:underline focus:ring-2 ring-primary p-1 rounded transition-all"
              aria-label="現在表示しているサイトマップページ"
            >
              サイトマップ
            </Link>
            <span className="ml-3 text-gray-600">- サイト内のページ一覧</span>
          </li>
        </ul>
      </div>

      <div className="bg-base-200 p-5 rounded-lg shadow-sm mt-8">
        <h2 className="text-xl font-semibold mb-3">このサイトについて</h2>
        <p className="mb-2">
          風ぐるま乗換案内は、千代田区地域福祉交通「風ぐるま」の非公式乗換案内サービスです。
          このサイトはアクセシビリティへの配慮を進めており、WCAG
          2.2ガイドラインに準拠することを目指しています。
        </p>
        <p className="mb-2">
          しかし、道は長く、完璧にはほど遠いです。あなたのご意見・ご要望が必要です。
        </p>
        <p className="mb-2">
          ぜひ、
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSdX33xU9DuxS5X0F13yeBNY2aeuttmm98lxVOmPLJjqca0RFw/viewform?usp=dialog"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
            aria-label="フィードバックフォームを新しいタブで開く"
          >
            こちらのフォーム
          </a>
          からお寄せください。
        </p>
      </div>
    </main>
  );
}
