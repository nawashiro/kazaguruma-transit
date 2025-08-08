import { Metadata } from "next";

export const metadata: Metadata = {
  title: "投稿承認管理 - 風ぐるま",
  description: "投稿の承認・管理を行うページです。",
};

export default function ApproveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
