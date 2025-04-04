import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SidebarLayout from "../components/SidebarLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "風ぐるま乗換案内",
  description: "千代田区福祉交通の乗換案内サービス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" data-theme="light">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
}
