import generatedLocationData from "@/generated/location-data.json";
import LocationCategoryList from "@/components/features/LocationCategoryList";
import PageHeader from "@/components/layouts/PageHeader";
import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  LocationDataSnapshot,
  LocationPageCategory,
} from "@/types/location-pages";

const locationData: LocationDataSnapshot = generatedLocationData;

export const dynamicParams = false;

export function generateStaticParams() {
  return locationData.categories.map((category) => ({
    "category-id": category.id,
  }));
}

type CategoryPageProps = {
  params: Promise<{ "category-id": string }>;
};

function decodeCategoryId(categoryId: string): string | undefined {
  let decodedCategoryId = categoryId;

  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const nextCategoryId = decodeURIComponent(decodedCategoryId);
      if (nextCategoryId === decodedCategoryId) {
        return decodedCategoryId;
      }
      decodedCategoryId = nextCategoryId;
    } catch {
      return undefined;
    }
  }

  return decodedCategoryId;
}

function findCategory(categoryId: string): LocationPageCategory | undefined {
  const decodedCategoryId = decodeCategoryId(categoryId);
  if (decodedCategoryId === undefined) {
    return undefined;
  }

  return locationData.categories.find(
    (category) => category.id === decodedCategoryId,
  );
}

export default async function LocationCategoryPage({
  params,
}: CategoryPageProps) {
  const { "category-id": categoryId } = await params;
  const category = findCategory(categoryId);

  if (!category) {
    notFound();
  }

  return (
    <div className="py-8">
      <p className="mb-4">
        <Link href="/locations" className="link">
          場所一覧に戻る
        </Link>
      </p>
      <PageHeader title={category.name} />
      <LocationCategoryList locations={category.locations} />
    </div>
  );
}
