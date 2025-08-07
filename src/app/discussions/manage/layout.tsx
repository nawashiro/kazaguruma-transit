import { Metadata } from "next";

export const metadata: Metadata = {
  title: "会話管理 - 意見交換 - 風ぐるま",
  description: "意見交換の会話作成・管理を行うページです。",
};

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}