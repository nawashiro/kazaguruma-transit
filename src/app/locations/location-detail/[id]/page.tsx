import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layouts/PageHeader";
import type { BreadcrumbItem } from "@/components/layouts/Breadcrumbs";
import type { LocationDetailResult } from "@/types/access-route-pages";
import {
  resolveLocationDetail,
} from "@/lib/location/location-detail-resolver";
import {
  loadLocationPageData,
  type LocationWithArea,
  type LocationCategoryWithArea,
  type LocationPageDataResult,
} from "@/lib/location/location-page-data";
import { BarrierDetailBlock } from "@/components/features/BarrierAccessibility";
import { evaluateOpeningHours } from "@/lib/location/opening-hours";
import { Pencil } from "lucide-react";

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
export const dynamic = "force-dynamic";

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

type ResolvedLocationDetail = LocationDetailResult<LocationWithArea>;

type LocationDetailPageData = {
  data: LocationPageDataResult;
  result: ResolvedLocationDetail;
};

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function loadAndResolveLocation(id: string): Promise<LocationDetailPageData> {
  let data: LocationPageDataResult;

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

function resolveAreaName(location: LocationWithArea): string | null {
  const providedArea = location.area;
  if (hasNonEmptyText(providedArea)) {
    return normalizeAreaName(providedArea);
  }

  return null;
}

function findLocationCategory(
  data: LocationPageDataResult,
  location: LocationWithArea,
): LocationCategoryWithArea | null {
  if (data.status !== "success" || !Array.isArray(data.categories)) {
    return null;
  }

  return (
    data.categories.find((category) =>
      category.locations.some((candidate) => candidate.id === location.id),
    ) ?? null
  );
}

function locationBreadcrumbs(
  category: LocationCategoryWithArea | null,
  title: string,
): BreadcrumbItem[] {
  if (category === null) {
    return [{ label: "場所一覧", href: "/locations" }, { label: title }];
  }

  return [
    { label: "場所一覧", href: "/locations" },
    {
      label: category.category,
      href: `/locations/${encodeURIComponent(category.categoryId)}`,
    },
    { label: title },
  ];
}

function DestinationLink({ location }: { location: LocationWithArea }) {
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

function EditLocationLink({ location }: { location: LocationWithArea }) {
  const href = location.osmEditUrl;
  if (!hasNonEmptyText(href)) {
    return null;
  }
  return (
    <p className="mt-4 flex justify-end">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline h-auto min-h-[44px] gap-2 whitespace-normal text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Pencil aria-hidden="true" className="size-4" />
        <span>編集する（OpenStreetMapを開きます）</span>
        <span className="sr-only">（新しいタブで開きます）</span>
      </a>
    </p>
  );
}

function BasicInfoSection({ location }: { location: LocationWithArea }) {
  const phone = location.phone;
  const websiteUri = hasNonEmptyText(location.websiteUri) ? location.websiteUri : null;
  const wikipediaUri = hasNonEmptyText(location.wikipediaUri) ? location.wikipediaUri : null;
  if (phone === undefined && websiteUri === null && wikipediaUri === null) {
    return null;
  }
  return (
    <section aria-labelledby="basic-info-heading" className="ruby-text">
      <h2 id="basic-info-heading" className="mb-4 text-xl font-bold">
        基本情報
      </h2>
      <dl className="list text-base">
        {phone !== undefined && (
          <div className="list-row">
            <dt>電話</dt>
            <dd>
              <a href={phone.tel} className="link min-h-[44px] inline-flex items-center text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                {phone.display}
              </a>
            </dd>
          </div>
        )}
        {websiteUri !== null && (
          <div className="list-row">
            <dt>ウェブサイト</dt>
            <dd>
              <a
                href={websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="link min-h-[44px] inline-flex items-center text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                ウェブサイトを開く
                <span className="sr-only">（新しいタブで開きます）</span>
              </a>
            </dd>
          </div>
        )}
        {wikipediaUri !== null && (
          <div className="list-row">
            <dt>Wikipedia</dt>
            <dd>
              <a
                href={wikipediaUri}
                target="_blank"
                rel="noopener noreferrer"
                className="link min-h-[44px] inline-flex items-center text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Wikipediaを開く
                <span className="sr-only">（新しいタブで開きます）</span>
              </a>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function formatTimeTokyo(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function formatDateTokyo(date: Date): { text: string; iso: string } {
  const timeZone = "Asia/Tokyo";
  const text = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone,
  }).format(date);
  const iso = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
  return { text, iso };
}

function OpeningHoursSection({ location }: { location: LocationWithArea }) {
  const rule = location.openingHours;
  if (typeof rule !== "string" || rule.trim().length === 0) {
    return null;
  }
  const evaluation = evaluateOpeningHours(rule, new Date());
  const showWarning = evaluation.showHolidayWarning;

  if (evaluation.state === "unknown") {
    return (
      <section aria-labelledby="hours-heading" className="ruby-text">
        <h2 id="hours-heading" className="mb-4 text-xl font-bold">
          営業時間
        </h2>
        <p className="text-base">
          <code>{evaluation.raw}</code>
        </p>
        <p className="mt-2 text-base">目安なので、正確な時間は施設に問い合わせてください。</p>
        {showWarning && <p className="mt-2 text-base">祝日は通常と異なる場合があります。</p>}
      </section>
    );
  }

  if (evaluation.state === "all-day") {
    return (
      <section aria-labelledby="hours-heading" className="ruby-text">
        <h2 id="hours-heading" className="mb-4 text-xl font-bold">
          営業時間
        </h2>
        <p className="text-base">24時間営業</p>
        <p className="mt-2 text-base">目安なので、正確な時間は施設に問い合わせてください。</p>
        {showWarning && <p className="mt-2 text-base">祝日は通常と異なる場合があります。</p>}
      </section>
    );
  }

  const statusText = evaluation.state === "open" ? "営業中" : "営業時間外";
  const nextText =
    evaluation.nextChange !== undefined
      ? evaluation.state === "open"
        ? `${formatTimeTokyo(evaluation.nextChange)}まで`
        : `${formatTimeTokyo(evaluation.nextChange)}から`
      : undefined;

  return (
    <section aria-labelledby="hours-heading" className="ruby-text">
      <h2 id="hours-heading" className="mb-4 text-xl font-bold">
        営業時間
      </h2>
      <p className="text-base">
        {statusText}
        {nextText !== undefined && ` ${nextText}`}
      </p>
      {evaluation.week !== undefined && (
        <dl className="mt-2 space-y-1">
          {evaluation.week.map((day) => {
            const { text, iso } = formatDateTokyo(day.date);
            return (
              <div key={iso} className="flex gap-2 text-base">
                <dt>
                  <time dateTime={iso}>{text}</time>
                </dt>
                <dd>
                  {day.closed || day.intervals.length === 0 ? (
                    "休み"
                  ) : (
                    <>
                      {day.intervals.map((interval, index) => (
                        <span key={`${iso}-${index}`}>
                          {index > 0 && "、"}
                          <time dateTime={interval.start.toISOString()}>
                            {formatTimeTokyo(interval.start)}
                          </time>
                          -
                          <time dateTime={interval.end.toISOString()}>
                            {formatTimeTokyo(interval.end)}
                          </time>
                        </span>
                      ))}
                    </>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <p className="mt-2 text-base">目安なので、正確な時間は施設に問い合わせてください。</p>
      {showWarning && <p className="mt-2 text-base">祝日は通常と異なる場合があります。</p>}
    </section>
  );
}

function LocationDetailContent({
  location,
  areaName,
}: {
  location: LocationWithArea;
  areaName: string | null;
}) {
  const imageUri = hasNonEmptyText(location.imageUri) ? location.imageUri : null;
  const imageCreator = hasNonEmptyText(location.imageCreator)
    ? location.imageCreator
    : null;
  const imageLicense = hasNonEmptyText(location.imageLicense)
    ? location.imageLicense
    : null;

  return (
    <div className="space-y-4">
      <EditLocationLink location={location} />
      {areaName !== null && (
        <dl className="text-base join space-x-2">
          <dt className="font-bold join-item">地域</dt>
          <dd className="join-item">{areaName}</dd>
        </dl>
      )}

      {imageUri !== null && (
        <figure className="relative w-full overflow-hidden">
          <img
            src={imageUri}
            alt=""
            className="h-full w-full rounded-xl object-cover aspect-[4/3]"
          />
          {imageCreator !== null && imageLicense !== null && (
            <figcaption className="mt-2 text-base">
              {imageCreator}・
              <a
                href={imageLicense}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                {imageLicense}
                <span className="sr-only">（新しいタブで開きます）</span>
              </a>
            </figcaption>
          )}
        </figure>
      )}

      <BarrierDetailBlock
        wheelchair={location.wheelchair}
        osmElement={location.osmElement}
        relatedPages={location.relatedPages}
      />

      <OpeningHoursSection location={location} />

      <BasicInfoSection location={location} />

      <div className="mt-4">
        <DestinationLink location={location} />
      </div>
    </div>
  );
}

function DataErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-8">
      <PageHeader
        title={title}
        breadcrumbs={[{ label: "場所一覧", href: "/locations" }, { label: title }]}
      />
      <div className="alert alert-error alert-soft text-base-content!" role="alert">
        <p className="font-semibold">エラー</p>
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
      <PageHeader
        title={result.location.name}
        breadcrumbs={locationBreadcrumbs(category, result.location.name)}
      />
      <LocationDetailContent location={result.location} areaName={areaName} />
    </div>
  );
}
