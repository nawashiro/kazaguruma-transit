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
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "サイトマップ | 風ぐるま乗換案内【非公式】",
  description:
    "風ぐるま乗換案内サイトのサイトマップです。サイト内の全てのページへのリンクが掲載されています。",
};

export default function SiteMapPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl ruby-text">
      <h1 className="text-3xl font-bold mb-8 border-b-2 pb-2">サイトマップ</h1>

      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 border-l-4 border-primary pl-3">
          メインコンテンツ
        </h2>
        <ul className="space-y-3 ml-4">
          <li className="flex items-center">
            <HomeIcon className="h-5 w-5 mr-2" />
            <Link className="text-lg hover:underline" href="/">
              <span>ホーム</span>
            </Link>
          </li>
          <li className="flex items-center">
            <MapPinIcon className="h-5 w-5 mr-2" />
            <Link className="text-lg hover:underline" href="/locations">
              <span>場所をさがす</span>
            </Link>
          </li>
          <li className="flex items-center">
            <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
            <Link className="text-lg hover:underline" href="/discussions">
              <span>意見交換</span>
            </Link>
          </li>
        </ul>
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 border-l-4 border-primary pl-3">
          使い方情報
        </h2>
        <ul className="space-y-3 ml-4">
          <li className="flex items-center">
            <QuestionMarkCircleIcon className="h-5 w-5 mr-2" />
            <Link href="/beginners-guide" className="text-lg hover:underline">
              <span>はじめての方へ</span>
            </Link>
          </li>
          <li className="flex items-center">
            <BookOpenIcon className="h-5 w-5 mr-2" />
            <Link href="/usage" className="text-lg hover:underline">
              <span>使い方</span>
            </Link>
          </li>
        </ul>
      </div>
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 border-l-4 border-primary pl-3">
          サイト情報
        </h2>
        <ul className="space-y-3 ml-4">
          <li className="flex items-center">
            <DocumentTextIcon className="h-5 w-5 mr-2" />
            <Link href="/license" className="text-lg hover:underline">
              <span>ライセンス</span>
            </Link>
          </li>
          <li className="flex items-center">
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            <a
              href="https://halved-hamster-4a1.notion.site/1df78db44c3d80979856c735893403d4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg hover:underline"
            >
              <span>更新情報</span>
            </a>
          </li>
          <li className="flex items-center">
            <MapIcon className="h-5 w-5 mr-2" />
            <Link href="/site-map" className="text-lg hover:underline">
              <span>サイトマップ</span>
            </Link>
          </li>
        </ul>
      </div>

      <div className="bg-base-100 p-5 rounded-lg shadow-sm mt-8">
        <h2 className="text-xl font-semibold mb-3">このサイトについて</h2>
        <p className="mb-2">
          <ruby>
            風<rt>かざ</rt>
          </ruby>
          ぐるま乗換案内は、千代田区地域福祉交通「
          <ruby>
            風<rt>かざ</rt>
          </ruby>
          ぐるま」の非公式乗換案内サービスです。
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
            className="link"
          >
            こちらのフォーム
          </a>
          からお寄せください。
        </p>
      </div>
    </main>
  );
}
