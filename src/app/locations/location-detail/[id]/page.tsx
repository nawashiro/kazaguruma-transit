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
import { imageLicenseLabel } from "@/lib/location/image-license";
import {
  isAbsoluteHttpUrl,
  resolveLocationImage,
} from "@/lib/location/location-image";
import {
  evaluateOpeningHours,
  type OpeningDay,
} from "@/lib/location/opening-hours";
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

function decodeLocationId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
  if (!isAbsoluteHttpUrl(href)) {
    return null;
  }
  return (
    <p className="mt-4 flex justify-end">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline h-auto min-h-[44px] w-full gap-0 whitespace-normal text-base sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Pencil aria-hidden="true" className="mr-2 size-4" />
        <span className="text-base">編集する（OpenStreetMapを開きます）</span>
        <span className="sr-only">（新しいタブで開きます）</span>
      </a>
    </p>
  );
}

function BasicInfoSection({ location }: { location: LocationWithArea }) {
  const phone = location.phone;
  const websiteUri = isAbsoluteHttpUrl(location.websiteUri)
    ? location.websiteUri
    : null;
  const wikipediaUri = isAbsoluteHttpUrl(location.wikipediaUri)
    ? location.wikipediaUri
    : null;
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

function jstDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function formatNextChange(date: Date, now: Date): string {
  const time = formatTimeTokyo(date);
  if (jstDateKey(date) === jstDateKey(now)) {
    return time;
  }
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (jstDateKey(date) === jstDateKey(tomorrow)) {
    return `明日${time}`;
  }
  return `${formatDateTokyo(date).text} ${time}`;
}

function WeekSchedule({ week }: { week?: OpeningDay[] }) {
  if (week === undefined || week.length === 0) {
    return null;
  }
  return (
    <dl className="mt-2 space-y-1">
      {week.map((day) => {
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
                day.intervals.map((interval, index) => (
                  <span key={`${iso}-${index}`}>
                    {index > 0 && "、"}
                    <time dateTime={interval.start.toISOString()}>
                      {formatTimeTokyo(interval.start)}
                    </time>
                    -
                    <time dateTime={interval.end.toISOString()}>
                      {interval.endsAtDayEnd
                        ? "24:00"
                        : formatTimeTokyo(interval.end)}
                    </time>
                  </span>
                ))
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function OpeningHoursSection({ location }: { location: LocationWithArea }) {
  const rule = location.openingHours;
  if (typeof rule !== "string" || rule.trim().length === 0) {
    return null;
  }
  const now = new Date();
  const evaluation = evaluateOpeningHours(rule, now);
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
        <WeekSchedule week={evaluation.week} />
        <p className="mt-2 text-base">目安なので、正確な時間は施設に問い合わせてください。</p>
        {showWarning && <p className="mt-2 text-base">祝日は通常と異なる場合があります。</p>}
      </section>
    );
  }

  const statusText = evaluation.state === "open" ? "営業中" : "営業時間外";
  const nextText =
    evaluation.nextChange !== undefined
      ? `${formatNextChange(evaluation.nextChange, now)}${evaluation.state === "open" ? "まで" : "から"}`
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
      <WeekSchedule week={evaluation.week} />
      <p className="mt-2 text-base">目安なので、正確な時間は施設に問い合わせてください。</p>
      {showWarning && <p className="mt-2 text-base">祝日は通常と異なる場合があります。</p>}
    </section>
  );
}

function ProviderSection({ hasImage }: { hasImage: boolean }) {
  return (
    <section aria-labelledby="provider-heading" className="ruby-text">
      <h2 id="provider-heading" className="mb-4 text-xl font-bold">
        提供
      </h2>
      <dl className="space-y-2 text-base">
        <div>
          <dt className="font-bold">座標・電話・ウェブサイト・営業時間</dt>
          <dd>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              OpenStreetMap contributors
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
            （ODbL 1.0）
          </dd>
        </div>
        <div>
          <dt className="font-bold">バリアフリー情報</dt>
          <dd>OpenStreetMapのwheelchairタグ</dd>
        </div>
        {hasImage && (
          <div>
            <dt className="font-bold">画像</dt>
            <dd>各画像の作者とライセンス（画像の下に表示）</dd>
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
  location: LocationWithArea;
  areaName: string | null;
}) {
  const image = resolveLocationImage(location);
  const relatedPages = (location.relatedPages ?? []).filter(
    (page) => hasNonEmptyText(page.name) && isAbsoluteHttpUrl(page.url),
  );

  return (
    <div className="space-y-4">
      <EditLocationLink location={location} />
      {areaName !== null && (
        <dl className="text-base join space-x-2">
          <dt className="font-bold join-item">地域</dt>
          <dd className="join-item">{areaName}</dd>
        </dl>
      )}

      {image !== null && (
        <figure className="relative w-full overflow-hidden">
          <img
            src={image.uri}
            alt=""
            className="h-full w-full rounded-xl object-cover aspect-[4/3]"
          />
          <figcaption className="mt-2 text-base">
            {image.creator}・
            <a
              href={image.license}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              {imageLicenseLabel(image.license)}
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
          </figcaption>
        </figure>
      )}

      <BarrierDetailBlock
        wheelchair={location.wheelchair}
        osmElement={location.osmElement}
        relatedPages={relatedPages}
      />

      <OpeningHoursSection location={location} />

      <BasicInfoSection location={location} />

      <ProviderSection hasImage={image !== null} />

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
  const { id: rawId } = await params;
  const { result } = await loadAndResolveLocation(decodeLocationId(rawId));

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
  const { id: rawId } = await params;
  const { data, result } = await loadAndResolveLocation(decodeLocationId(rawId));

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
