import { Metadata } from "next";

export const metadata: Metadata = {
  title: "会話を編集 - 風ぐるま",
  description: "会話の設定を編集します。",
};

export default function EditDiscussionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}