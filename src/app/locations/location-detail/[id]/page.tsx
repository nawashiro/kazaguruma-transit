import type { Metadata } from "next";
import generatedLocationData from "@/generated/location-data.json";
import PageHeader from "@/components/layouts/PageHeader";
import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  LocationDataSnapshot,
  LocationPageCategory,
  LocationPageLocation,
} from "@/types/location-pages";

const locationData: LocationDataSnapshot = generatedLocationData;
const LOCATION_DETAIL_FALLBACK_TITLE = "場所詳細 | 風ぐるま乗換案内";
const LOCATION_DETAIL_DESCRIPTION = "風ぐるまで行ける場所の詳細情報";
const LOCATION_DETAIL_TITLE_SUFFIX = " - 場所詳細";

export const dynamicParams = false;

export function generateStaticParams() {
  return locationData.categories.flatMap((category) =>
    category.locations.map((location) => ({ id: location.id })),
  );
}

type LocationDetailPageProps = {
  params: Promise<{ id: string }>;
};

type LocationMatch = {
  category: LocationPageCategory;
  location: LocationPageLocation;
};

function findUniqueLocation(id: string): LocationMatch | undefined {
  let match: LocationMatch | undefined;

  for (const category of locationData.categories) {
    for (const location of category.locations) {
      if (location.id !== id) {
        continue;
      }

      if (match) {
        return undefined;
      }

      match = { category, location };
    }
  }

  return match;
}

export async function generateMetadata({
  params,
}: LocationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const match = findUniqueLocation(id);

  return {
    title: match
      ? `${match.location.name}${LOCATION_DETAIL_TITLE_SUFFIX}`
      : LOCATION_DETAIL_FALLBACK_TITLE,
    description: LOCATION_DETAIL_DESCRIPTION,
  };
}

function destinationHref(location: LocationPageLocation): string {
  return `/?destination=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
}

function LocationDetailMarkup({
  category,
  location,
}: LocationMatch) {
  const areaName = location.areaName || "地域不明";
  const imageCopyright = location.imageCopyright ?? location.imageCopylight;

  return (
    <div className="space-y-4">
      <p>
        <Link
          href={`/locations/${encodeURIComponent(category.id)}`}
          className="link"
        >
          {category.name}カテゴリに戻る
        </Link>
      </p>

      <dl className="text-base join space-x-2">
        <dt className="font-bold join-item">地域</dt>
        <dd className="join-item">{areaName}</dd>
      </dl>

      {location.imageUri && (
        <figure className="relative aspect-[4/3] w-full overflow-hidden">
          <img
            src={location.imageUri}
            alt=""
            className="object-cover w-full h-full rounded-xl"
          />
        </figure>
      )}

      {location.description && (
        <div className="mt-4 ruby-text">
          <p className="text-base">{location.description}</p>
        </div>
      )}

      {location.uri && (
        <p className="mt-4">
          <a
            href={location.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="link ruby-text"
          >
            ウェブサイトを見る
          </a>
        </p>
      )}

      <div className="mt-6 ruby-text">
        <h2 className="text-xl font-bold mb-4">提供</h2>
        <dl className="list">
          <div className="list-row">
            <dt>座標データ提供</dt>
            <dd>{location.nodeCopyright}</dd>
          </div>
          {imageCopyright && (
            <div className="list-row">
              <dt>画像提供</dt>
              <dd>{imageCopyright}</dd>
            </div>
          )}
          {location.description && location.descriptionCopyright && (
            <div className="list-row">
              <dt>説明文提供</dt>
              <dd>{location.descriptionCopyright}</dd>
            </div>
          )}
          <div className="list-row">
            <dt>ライセンス</dt>
            <dd>
              <a
                href={location.licenceUri}
                target="_blank"
                rel="noopener noreferrer"
                className="link ml-1"
              >
                {location.licence}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4">
        <a
          href={destinationHref(location)}
          className="btn btn-primary text-base inline-flex ruby-text gap-0 rounded-full dark:rounded-sm min-h-[44px] h-fit dark:text-white"
        >
          ここへ行く
        </a>
      </p>
    </div>
  );
}

export default async function LocationDetailPage({
  params,
}: LocationDetailPageProps) {
  const { id } = await params;
  const match = findUniqueLocation(id);

  if (!match) {
    notFound();
  }

  return (
    <div className="py-8">
      <p className="mb-4">
        <Link href="/locations" className="link">
          場所一覧に戻る
        </Link>
      </p>
      <PageHeader title={match.location.name} />
      <LocationDetailMarkup {...match} />
    </div>
  );
}
