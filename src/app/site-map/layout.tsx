import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "サイトマップ | 風ぐるま乗換案内ウェブサイト",
  description:
    "風ぐるま乗換案内ウェブサイトの全コンテンツを一覧できるサイトマップです。各ページへのリンクをカテゴリー別に整理して掲載しています。",
  keywords:
    "サイトマップ, 風ぐるま, 乗換案内, ページ一覧, ナビゲーション, 千代田区",
  openGraph: {
    title: "サイトマップ | 風ぐるま乗換案内ウェブサイト",
    description:
      "風ぐるま乗換案内ウェブサイトの全コンテンツを一覧できるサイトマップです。各ページへのリンクをわかりやすく整理しています。",
  },
};

export default function SiteMapLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
