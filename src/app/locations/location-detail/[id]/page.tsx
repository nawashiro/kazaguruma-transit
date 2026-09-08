import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layouts/PageHeader";
import type { LocationDetailResult } from "@/types/access-route-pages";
import {
  resolveLocationDetail,
} from "@/lib/location/location-detail-resolver";
import { loadLocationPageData } from "@/lib/location/location-page-data";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "@/utils/addressLoader";

const LOCATION_DETAIL_FALLBACK_TITLE = "場所詳細 | 風ぐるま乗換案内";
const LOCATION_DETAIL_DESCRIPTION = "風ぐるまで行ける場所の詳細情報";
const LOCATION_DETAIL_TITLE_SUFFIX = " - 場所詳細";
const DATA_LOAD_ERROR_MESSAGE =
  "場所データの取得に失敗しました。時間をおいて再試行してください。";
const INVALID_DATA_ERROR_MESSAGE =
  "場所データの形式が不正です。時間をおいて再試行してください。";
const DUPLICATE_ID_ERROR_MESSAGE =
  "場所識別子が重複しています。時間をおいて再試行してください。";
const CHIYODA_AREA_PREFIX = "東京都千代田区";

export const dynamicParams = false;
export const dynamic = "force-static";

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  const data = await loadLocationPageData();
  if (data.status !== "success") {
    return [];
  }

  return data.categories.flatMap((category) =>
    category.locations.map((location) => ({ id: location.id })),
  );
}

type LocationDetailPageProps = {
  params: Promise<{ id: string }>;
};

type ResolvedLocationDetail = LocationDetailResult<KeyLocation>;

type LocationDetailPageData = {
  data: KeyLocationsDataResult;
  result: ResolvedLocationDetail;
};

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function loadAndResolveLocation(id: string): Promise<LocationDetailPageData> {
  let data: KeyLocationsDataResult;

  try {
    data = await loadLocationPageData();
  } catch (error) {
    data = {
      status: "error",
      error: normalizeError(error),
    };
  }

  return {
    data,
    result: resolveLocationDetail(id, data),
  };
}

function hasNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeAreaName(name: string): string {
  return name.startsWith(CHIYODA_AREA_PREFIX)
    ? name.slice(CHIYODA_AREA_PREFIX.length) || name
    : name;
}

function resolveAreaName(location: KeyLocation): string | null {
  const providedArea = location.area;
  if (hasNonEmptyText(providedArea)) {
    return normalizeAreaName(providedArea);
  }

  return null;
}

function findLocationCategory(
  data: KeyLocationsDataResult,
  location: KeyLocation,
): KeyLocationCategory | null {
  if (data.status !== "success" || !Array.isArray(data.categories)) {
    return null;
  }

  return (
    data.categories.find((category) =>
      category.locations.some((candidate) => candidate.id === location.id),
    ) ?? null
  );
}

function LocationBackLink({
  category,
}: {
  category: KeyLocationCategory | null;
}) {
  if (category === null) {
    return (
      <Link href="/locations" className="link">
        場所一覧に戻る
      </Link>
    );
  }

  return (
    <Link
      href={`/locations/${encodeURIComponent(category["category:en"])}`}
      className="link"
    >
      {category.category}に戻る
    </Link>
  );
}

function DestinationLink({ location }: { location: KeyLocation }) {
  const destination = {
    lat: location.lat,
    lng: location.lng,
    address: location.name,
  };

  return (
    <a
      href={`/?destination=${encodeURIComponent(JSON.stringify(destination))}`}
      className="btn btn-primary inline-flex h-fit min-h-[44px] gap-0 rounded-full text-base dark:rounded-sm dark:text-white"
    >
      ここへ行く
    </a>
  );
}

function LocationProvidedInformation({ location }: { location: KeyLocation }) {
  const imageUri = location.imageUri;
  const description = location.description;
  const nodeCopyright = location.nodeCopyright;
  const licence = location.licence;
  const licenceUri = location.licenceUri;
  const imageCopyrightValue = location.imageCopyright;
  const legacyImageCopyrightValue = location.imageCopylight;
  const descriptionCopyrightValue = location.descriptionCopyright;
  const hasImage = hasNonEmptyText(imageUri);
  const hasDescription = hasNonEmptyText(description);
  const imageCopyright = hasNonEmptyText(imageCopyrightValue)
    ? imageCopyrightValue
    : hasNonEmptyText(legacyImageCopyrightValue)
      ? legacyImageCopyrightValue
      : null;
  const descriptionCopyright = hasNonEmptyText(descriptionCopyrightValue)
    ? descriptionCopyrightValue
    : null;

  return (
    <section className="mt-6 ruby-text" aria-labelledby="location-provided-heading">
      <h2 id="location-provided-heading" className="mb-4 text-xl font-bold">
        提供
      </h2>
      <dl className="list">
        {hasNonEmptyText(nodeCopyright) && (
          <div className="list-row">
            <dt>座標データ提供</dt>
            <dd>{nodeCopyright}</dd>
          </div>
        )}
        {hasImage && imageCopyright !== null && (
          <div className="list-row">
            <dt>画像提供</dt>
            <dd>{imageCopyright}</dd>
          </div>
        )}
        {hasDescription && descriptionCopyright !== null && (
          <div className="list-row">
            <dt>説明文提供</dt>
            <dd>{descriptionCopyright}</dd>
          </div>
        )}
        {hasNonEmptyText(licence) && (
          <div className="list-row">
            <dt>ライセンス</dt>
            <dd>
              {hasNonEmptyText(licenceUri) && isHttpUrl(licenceUri) ? (
                <a
                  href={licenceUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link ml-1"
                >
                  {licence}
                </a>
              ) : (
                licence
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function LocationDetailContent({
  location,
  areaName,
}: {
  location: KeyLocation;
  areaName: string | null;
}) {
  const imageUriValue = location.imageUri;
  const descriptionValue = location.description;
  const websiteUriValue = location.uri;
  const imageUri = hasNonEmptyText(imageUriValue) ? imageUriValue : null;
  const description = hasNonEmptyText(descriptionValue) ? descriptionValue : null;
  const websiteUri =
    hasNonEmptyText(websiteUriValue) && isHttpUrl(websiteUriValue)
      ? websiteUriValue
      : null;

  return (
    <div className="space-y-4">
      {areaName !== null && (
        <dl className="text-base join space-x-2">
          <dt className="font-bold join-item">地域</dt>
          <dd className="join-item">{areaName}</dd>
        </dl>
      )}

      {imageUri !== null && (
        <figure className="relative aspect-[4/3] w-full overflow-hidden">
          <img
            src={imageUri}
            alt=""
            className="h-full w-full rounded-xl object-cover"
          />
        </figure>
      )}

      {description !== null && (
        <div className="mt-4 ruby-text">
          <p className="text-base">{description}</p>
        </div>
      )}

      {websiteUri !== null && (
        <p className="mt-4">
          <a
            href={websiteUri}
            target="_blank"
            rel="noopener noreferrer"
            className="link ruby-text"
          >
            ウェブサイトを見る
          </a>
        </p>
      )}

      <LocationProvidedInformation location={location} />

      <div className="mt-4">
        <DestinationLink location={location} />
      </div>
    </div>
  );
}

function DataErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-8">
      <p className="mb-4">
        <Link href="/locations" className="link">
          場所一覧に戻る
        </Link>
      </p>
      <PageHeader title={title} />
      <div className="alert alert-error alert-soft text-base-content!" role="alert">
        <p>{message}</p>
      </div>
    </div>
  );
}

function getErrorMessage(
  result: Extract<ResolvedLocationDetail, { status: "error" }>,
): string {
  return result.reason === "duplicate-id"
    ? DUPLICATE_ID_ERROR_MESSAGE
    : INVALID_DATA_ERROR_MESSAGE;
}

export async function generateMetadata({
  params,
}: LocationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const { result } = await loadAndResolveLocation(id);

  return {
    title:
      result.status === "success"
        ? `${result.location.name}${LOCATION_DETAIL_TITLE_SUFFIX}`
        : LOCATION_DETAIL_FALLBACK_TITLE,
    description: LOCATION_DETAIL_DESCRIPTION,
  };
}

/** Resolves a location directly from the nested route identifier. */
export default async function LocationDetailPage({
  params,
}: LocationDetailPageProps) {
  const { id } = await params;
  const { data, result } = await loadAndResolveLocation(id);

  if (
    result.status === "not-found" ||
    (result.status === "error" && result.reason === "invalid-request-id")
  ) {
    return notFound();
  }

  if (result.status === "data-load-error") {
    return (
      <DataErrorState
        title="場所データを取得できません"
        message={DATA_LOAD_ERROR_MESSAGE}
      />
    );
  }

  if (result.status === "error") {
    return (
      <DataErrorState
        title="場所詳細を表示できません"
        message={getErrorMessage(result)}
      />
    );
  }

  const category = findLocationCategory(data, result.location);
  const areaName = resolveAreaName(result.location);

  return (
    <div className="py-8">
      <p className="mb-4">
        <LocationBackLink category={category} />
      </p>
      <PageHeader title={result.location.name} />
      <LocationDetailContent location={result.location} areaName={areaName} />
    </div>
  );
}
