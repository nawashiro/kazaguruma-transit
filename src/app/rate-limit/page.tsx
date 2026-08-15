import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/layouts/PageHeader";
import { getRateLimitReturnPath } from "@/lib/navigation/rate-limit-source";

type RateLimitPageProps = {
  searchParams: Promise<{ source?: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "リクエスト制限に達しました",
};

export default async function RateLimitPage({
  searchParams,
}: RateLimitPageProps) {
  const { source } = await searchParams;
  const mappedSource = Array.isArray(source) ? source[0] : source;
  const returnPath = getRateLimitReturnPath(mappedSource);

  return (
    <div className="py-8 ruby-text">
      <PageHeader title="リクエスト制限に達しました" />
      <section className="space-y-4" aria-label="リクエスト制限の説明">
        <p>
          1時間あたり60リクエストの制限に達しました。
        </p>
        <p>
          1時間待ってから再試行してください。
        </p>
        <p>
          この制限はブラウザを閉じても継続します。
        </p>
        <Link
          href={returnPath}
          className="link"
        >
          発生元の画面へ戻る
        </Link>
      </section>
    </div>
  );
}
