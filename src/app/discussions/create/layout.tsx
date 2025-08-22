import { Metadata } from "next";

export const metadata: Metadata = {
  title: "会話を作成 - 風ぐるま",
  description: "新しい会話を作成して、地域の交通について話し合いましょう。",
};

export default function CreateDiscussionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}