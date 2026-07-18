import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "受賞について | 風ぐるま乗換案内",
  description:
    "風ぐるま乗換案内が受賞した、都知事杯オープンデータ・ハッカソン2025 行政課題解決賞について紹介します。",
};

export default function AwardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
