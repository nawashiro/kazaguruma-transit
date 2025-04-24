import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SidebarLayout from "../components/SidebarLayout";
import GoogleAnalytics from "../components/GoogleAnalytics";
import StructuredData from "../components/StructuredData";
import CustomHead from "../components/CustomHead";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "風ぐるま乗換案内【非公式】",
  description:
    "千代田区の地域福祉交通「風ぐるま」の乗換案内サービス。出発地・目的地を指定するだけで最適なルートを案内します。簡単・便利に千代田区内を移動できます。",
  keywords:
    "風ぐるま, 千代田区, 福祉交通, 乗換案内, 時刻表, バス, 地域交通, バリアフリー",
  authors: [{ name: "Nawashiro" }],
  openGraph: {
    title: "風ぐるま乗換案内【非公式】",
    description:
      "千代田区の地域福祉交通「風ぐるま」の乗換案内サービス。出発地・目的地を指定するだけで最適なルートを案内します。",
    url: process.env.NEXT_PUBLIC_APP_URL,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "風ぐるま乗換案内【非公式】",
    description:
      "千代田区福祉交通「風ぐるま」の乗換案内。出発地・目的地を指定するだけで最適なルートを案内します。",
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" data-theme="light">
      <head>
        <StructuredData />
        <CustomHead />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <GoogleAnalytics />
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
}
