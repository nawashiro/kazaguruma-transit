import { Metadata } from "next";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";

export const metadata: Metadata = {
  title: "意見交換 - 風ぐるま",
  description: "風ぐるまの利用体験について意見交換を行う場所です。",
};

export default function DiscussionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isDiscussionsEnabled()) {
    return (
      <div className="py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">意見交換機能</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
