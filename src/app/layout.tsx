import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthStatus from "@/components/AuthStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "かざぐるま乗換案内",
  description: "千代田線の乗換案内サービス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" data-theme="light">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="flex flex-col min-h-screen">
          <div className="flex-grow">{children}</div>
          <footer className="footer px-4 py-2">
            <div className="justify-self-end">
              <AuthStatus />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
