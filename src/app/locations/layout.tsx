import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "千代田区内の施設・スポット検索 風ぐるまでいける場所",
  description:
    "千代田区内の施設、スポット、観光地など風ぐるまでアクセスできる場所を簡単検索。カテゴリー別、現在地周辺、キーワードで探せる便利な検索機能を提供しています。",
  keywords:
    "千代田区, 施設検索, 風ぐるま, スポット検索, 観光地, アクセス, バス停, 周辺施設",
  openGraph: {
    title: "千代田区内の施設・スポット検索 風ぐるまでいける場所",
    description:
      "千代田区内の施設、スポット、観光地など風ぐるまでアクセスできる場所を簡単検索。カテゴリー別、現在地周辺で探せます。",
  },
};

export default function LocationsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
