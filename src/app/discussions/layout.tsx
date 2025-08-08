import { Metadata } from "next";

export const metadata: Metadata = {
  title: "意見交換 - 風ぐるま",
  description: "風ぐるまの利用体験について意見交換を行う場所です。",
};

export default function DiscussionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}