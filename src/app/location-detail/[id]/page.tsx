import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/layouts/PageHeader";
import LocationDetailContent from "@/components/features/LocationDetailContent";
import {
  loadKeyLocationsDataResult,
  type KeyLocation,
} from "@/utils/addressLoader";
import { resolveLocationDetail } from "@/lib/location/location-detail-resolver";
import { findLocationAreaName } from "@/lib/location/location-list-state";

export const metadata: Metadata = {
  title: "場所詳細 | 風ぐるま乗換案内",
  description: "風ぐるまで行ける場所の詳細情報",
};

type LocationDetailPageProps = {
  params: Promise<{ id: string }>;
};

async function getAreaName(location: KeyLocation): Promise<string> {
  if (typeof location.area === "string" && location.area.length > 0) {
    return location.area;
  }

  try {
    return await findLocationAreaName(location);
  } catch {
    return "不明";
  }
}

function StatePage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="py-8">
      <PageHeader title={title} />
      <div className="alert alert-error" role="alert">
        <p>{message}</p>
        <Link href="/locations" className="link">
          場所一覧に戻る
        </Link>
      </div>
    </div>
  );
}

/** Resolves a location directly from the dynamic route identifier. */
export default async function LocationDetailPage({
  params,
}: LocationDetailPageProps) {
  const { id } = await params;

  let data;
  try {
    data = await loadKeyLocationsDataResult();
  } catch (error) {
    data = {
      status: "error" as const,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  const result = resolveLocationDetail(id, data);

  if (result.status === "not-found") {
    return (
      <StatePage
        title="場所が見つかりません"
        message="指定された場所は見つかりませんでした。場所一覧から選び直してください。"
      />
    );
  }

  if (result.status === "data-load-error") {
    return (
      <StatePage
        title="場所データを取得できません"
        message="場所データの取得に失敗しました。時間をおいて再試行してください。"
      />
    );
  }

  if (result.status === "error") {
    return (
      <StatePage
        title="場所詳細を表示できません"
        message={`${result.error.message}。場所一覧から選び直してください。`}
      />
    );
  }

  const location = result.location;
  return (
    <div className="py-8">
      <PageHeader title={location.name} />
      <LocationDetailContent
        location={location}
        areaName={await getAreaName(location)}
      />
      <p className="mt-6">
        <Link href="/locations" className="link">
          場所一覧に戻る
        </Link>
      </p>
    </div>
  );
}
