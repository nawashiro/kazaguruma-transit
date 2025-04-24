import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "風ぐるま初心者ガイド | 利用方法・乗り方のご案内",
  description:
    "千代田区の福祉交通「風ぐるま」の乗り方や基本情報をご紹介。初めて利用する方にもわかりやすく解説しています。料金、支払い方法、サービス内容など詳しくご案内。",
  keywords:
    "風ぐるま, 初心者ガイド, 乗り方, 料金, 利用方法, 千代田区, 福祉交通",
  openGraph: {
    title: "風ぐるま初心者ガイド | 利用方法・乗り方のご案内",
    description:
      "千代田区の福祉交通「風ぐるま」の乗り方や基本情報をご紹介。初めて利用する方にもわかりやすく解説しています。",
  },
};

export default function BeginnerGuideLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
