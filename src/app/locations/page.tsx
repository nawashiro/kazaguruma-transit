import { redirect } from "next/navigation";
import PageHeader from "@/components/layouts/PageHeader";
import { loadLocationPageData } from "@/lib/location/location-page-data";

type LocationPageData = Awaited<ReturnType<typeof loadLocationPageData>>;

function LocationDataError() {
  return (
    <div className="py-8">
      <PageHeader title="場所データを表示できません" />
      <div
        className="alert alert-error alert-soft text-base-content!"
        role="alert"
      >
        <p className="font-semibold">エラー</p>
        <p>場所データの取得に失敗しました。時間をおいて再試行してください。</p>
      </div>
    </div>
  );
}

function getFirstCategoryId(result: LocationPageData): string | null {
  if (
    result.status !== "success" ||
    !Array.isArray(result.categories) ||
    result.categories.length === 0
  ) {
    return null;
  }

  const categoryId = result.categories[0]?.["category:en"];
  return typeof categoryId === "string" && categoryId.trim().length > 0
    ? categoryId
    : null;
}

export default async function LocationsPage() {
  let result: LocationPageData;

  try {
    result = await loadLocationPageData();
  } catch {
    return <LocationDataError />;
  }

  const categoryId = getFirstCategoryId(result);
  if (categoryId === null) {
    return <LocationDataError />;
  }

  redirect(`/locations/${encodeURIComponent(categoryId)}`);
}
