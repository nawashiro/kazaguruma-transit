import type { ReactNode } from "react";
import type { Metadata } from "next";
import LocationCategoryNavigation from "@/components/features/LocationCategoryNavigation";
import LocationSortControls from "@/components/features/LocationSortControls";
import { loadLocationPageData } from "@/lib/location/location-page-data";
import type { KeyLocationsDataResult } from "@/utils/addressLoader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "千代田区内の施設・スポット検索 風ぐるまでいける場所",
  description:
    "千代田区内の施設、スポット、観光地など風ぐるまでアクセスできる場所を簡単検索。カテゴリー別、現在地周辺、キーワードで探せる便利な検索機能を提供しています。",
  keywords:
    "千代田区, 施設検索, 風ぐるま, スポット検索, 観光地, アクセス, バス停, 周辺施設",
  openGraph: {
    title: "千代田区内の施設・スポット検索 風ぐるまでいける場所",
    description:
      "千代田区内の施設、スポット、観光地など風ぐるまでアクセスできる場所を簡単検索。カテゴリー別、現在地周辺で探せます。",
  },
};

function LocationDataError() {
  return (
    <div
      data-error="location-data"
      role="alert"
      aria-live="polite"
      className="alert alert-error alert-soft mb-6 text-base-content!"
    >
      <p className="ruby-text">
        場所データを読み込めませんでした。時間をおいて再試行してください。
      </p>
    </div>
  );
}

export default async function LocationsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  let result: KeyLocationsDataResult;
  try {
    result = await loadLocationPageData();
  } catch {
    result = {
      status: "error",
      error: new Error("場所データの読み込みに失敗しました"),
    };
  }

  const categories =
    result.status === "success" && Array.isArray(result.categories)
      ? result.categories
      : null;

  return (
    <>
      {categories !== null && categories.length > 0 ? (
        <>
          <LocationCategoryNavigation categories={categories} />
          <LocationSortControls />
        </>
      ) : (
        <LocationDataError />
      )}
      {children}
    </>
  );
}
