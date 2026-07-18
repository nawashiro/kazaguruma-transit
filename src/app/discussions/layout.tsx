import { Metadata } from "next";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import PageHeader from "@/components/layouts/PageHeader";

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
        <PageHeader
          title="意見交換機能"
          description="この機能は現在利用できません。"
        />
      </div>
    );
  }

  return <>{children}</>;
}
