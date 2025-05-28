import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "風ぐるま乗換案内の使いかた | 千代田区内移動支援",
  description:
    "千代田区内の風ぐるま乗換案内の使い方をわかりやすくご説明。出発地・目的地の選び方や風ぐるまで行ける場所の探し方など、便利な使い方をご紹介します。",
  keywords:
    "風ぐるま, 乗換案内, 使い方, 千代田区, 移動支援, 交通案内, バスルート",
  openGraph: {
    title: "風ぐるま乗換案内の使いかた",
    description:
      "千代田区内の風ぐるま乗換案内の使い方をわかりやすくご説明。出発地・目的地の選び方や便利な機能をご紹介します。",
  },
};

export default function UsageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
