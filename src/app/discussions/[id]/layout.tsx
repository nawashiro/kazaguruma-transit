import { Metadata } from "next";

export const metadata: Metadata = {
  title: "会話詳細 - 意見交換 - 風ぐるま",
};

export default function DiscussionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}