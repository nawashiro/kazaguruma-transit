import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/layouts/PageHeader";
import LocationCategoryNavigation from "@/components/features/LocationCategoryNavigation";
import LocationSortControls from "@/components/features/LocationSortControls";
import Card from "@/components/ui/Card";
import {
  calculateDistance,
  sortLocationsByDistance,
} from "@/lib/location/location-list-state";
import {
  loadLocationPageData,
} from "@/lib/location/location-page-data";
import {
  parseLocationOrigin,
  type LocationOrigin,
} from "@/lib/location/location-origin-query";
import {
  isKeyLocationCategory,
  type KeyLocation,
  type KeyLocationCategory,
  type KeyLocationsDataResult,
} from "@/utils/addressLoader";

type CategoryPageProps = {
  params: Promise<{ "category-id": string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type LocationWithDisplayArea = KeyLocation & {
  displayAreaName?: string;
};

type DistanceLocation = LocationWithDisplayArea & {
  distance: number;
};

type LocationAreaGroup = {
  name: string;
  locations: LocationWithDisplayArea[];
};

type DistanceBand = {
  distanceKm: number;
  locations: DistanceLocation[];
};

type SuccessfulLocationData = {
  status: "success";
  categories: KeyLocationCategory[];
};

const INVALID_ORIGIN_QUERY = "__invalid-origin-query__";
const LOCATION_PAGE_TITLE = "場所をさがす";
const LOCATION_PAGE_DESCRIPTION = "位置とカテゴリから千代田区のスポットをさがす";
const CHIYODA_AREA_PREFIX = "東京都千代田区";

export const dynamicParams = false;
export const dynamic = "force-dynamic";

export async function generateStaticParams(): Promise<
  Array<{ "category-id": string }>
> {
  const data = await loadLocationPageData();
  if (data.status !== "success") {
    return [];
  }

  return data.categories.map((category) => ({
    "category-id": category["category:en"],
  }));
}

function decodeCategoryId(categoryId: unknown): string {
  if (typeof categoryId !== "string" || categoryId.length === 0) {
    notFound();
  }

  let decodedCategoryId: string;
  try {
    decodedCategoryId = decodeURIComponent(categoryId);
  } catch {
    notFound();
  }

  if (decodedCategoryId.trim().length === 0) {
    notFound();
  }

  return decodedCategoryId;
}

function hasDuplicateLocationIds(categories: KeyLocationCategory[]): boolean {
  const locationIds = new Set<string>();

  for (const category of categories) {
    for (const location of category.locations) {
      if (locationIds.has(location.id)) {
        return true;
      }
      locationIds.add(location.id);
    }
  }

  return false;
}

function hasDuplicateCategoryIds(categories: KeyLocationCategory[]): boolean {
  const categoryIds = new Set<string>();

  for (const category of categories) {
    if (categoryIds.has(category["category:en"])) {
      return true;
    }
    categoryIds.add(category["category:en"]);
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessfulLocationData(
  result: unknown,
): result is SuccessfulLocationData {
  if (!isRecord(result) || result.status !== "success") {
    return false;
  }

  const { categories } = result;
  if (
    !Array.isArray(categories) ||
    categories.length === 0 ||
    !categories.every(isKeyLocationCategory)
  ) {
    return false;
  }

  return !hasDuplicateCategoryIds(categories) && !hasDuplicateLocationIds(categories);
}

async function getOriginQueryValue(
  searchParams: CategoryPageProps["searchParams"],
): Promise<string | undefined> {
  const { origin } = await searchParams;
  return origin === undefined
    ? undefined
    : typeof origin === "string"
      ? origin
      : INVALID_ORIGIN_QUERY;
}

function normalizeAreaName(name: string): string {
  return name.startsWith(CHIYODA_AREA_PREFIX)
    ? name.slice(CHIYODA_AREA_PREFIX.length) || name
    : name;
}

function groupLocationsByProvidedArea(
  locations: KeyLocation[],
): LocationAreaGroup[] {
  const groups = new Map<string, KeyLocation[]>();

  for (const location of locations) {
    const areaName = typeof location.area === "string" ? location.area.trim() : "";
    const groupName = normalizeAreaName(areaName || "その他");
    const group = groups.get(groupName);

    if (group) {
      group.push(location);
    } else {
      groups.set(groupName, [location]);
    }
  }

  return Array.from(groups, ([name, groupedLocations]) => ({
    name,
    locations: groupedLocations,
  }));
}

function groupCategoryLocations(locations: KeyLocation[]): LocationAreaGroup[] {
  return groupLocationsByProvidedArea(locations);
}

function createAreaNameByLocationId(
  groups: readonly LocationAreaGroup[],
): Map<string, string> {
  const areaNameByLocationId = new Map<string, string>();

  for (const group of groups) {
    for (const location of group.locations) {
      areaNameByLocationId.set(location.id, group.name);
    }
  }

  return areaNameByLocationId;
}

function groupLocationsByDistance(
  locations: readonly DistanceLocation[],
): DistanceBand[] {
  const bands = new Map<number, DistanceLocation[]>();

  for (const location of locations) {
    const distanceKm = Math.round(location.distance);
    const band = bands.get(distanceKm);

    if (band) {
      band.push(location);
    } else {
      bands.set(distanceKm, [location]);
    }
  }

  return Array.from(bands, ([distanceKm, groupedLocations]) => ({
    distanceKm,
    locations: groupedLocations,
  })).sort((first, second) => first.distanceKm - second.distanceKm);
}

function DataErrorState() {
  return (
    <section className="py-8" role="alert" aria-live="assertive">
      <PageHeader title="場所データエラー" />
      <p className="mt-4">場所データを読み込めないため、一覧を表示できません。</p>
    </section>
  );
}

function OriginErrorState() {
  return (
    <div className="alert alert-error alert-soft" role="alert">
      <p>originの座標を解釈できません。町字で表示します。</p>
    </div>
  );
}

function LocationSummary({
  location,
  areaName,
}: {
  location: LocationWithDisplayArea;
  areaName?: string;
}) {
  return (
    <Link
      href={`/locations/location-detail/${encodeURIComponent(location.id)}`}
      className="card w-full min-w-0 cursor-pointer bg-base-100 shadow-sm transition-all hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {location.imageUri && (
        <figure className="relative w-full overflow-hidden">
          <img
            src={location.imageUri}
            alt={location.name}
            className="h-48 w-full max-w-full object-cover"
          />
        </figure>
      )}
      <div className="card-body min-w-0 text-left">
        <h3 className="card-title inline gap-0 break-words text-xl">
          {location.name}
        </h3>
        {areaName && <p className="break-words text-base">{areaName}</p>}
        {location.description && (
          <p className="mt-1 break-words text-base ruby-text">
            {location.description}
          </p>
        )}
      </div>
    </Link>
  );
}

function LocationGrid({
  locations,
  areaName,
}: {
  locations: readonly LocationWithDisplayArea[];
  areaName?: string;
}) {
  return (
    <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {locations.map((location) => (
        <li key={location.id} className="min-w-0">
          <LocationSummary
            location={location}
            areaName={areaName ?? location.displayAreaName}
          />
        </li>
      ))}
    </ul>
  );
}

function TownLocationList({ groups }: { groups: readonly LocationAreaGroup[] }) {
  return (
    <div className="mt-6 space-y-8">
      {groups.map((group) => (
        <section key={group.name} aria-labelledby={`area-${group.name}`}>
          <h2 id={`area-${group.name}`} className="text-xl font-bold">
            {group.name}
          </h2>
          <LocationGrid locations={group.locations} areaName={group.name} />
        </section>
      ))}
    </div>
  );
}

function DistanceLocationList({ bands }: { bands: readonly DistanceBand[] }) {
  return (
    <div className="mt-6 space-y-8">
      {bands.map((band) => (
        <section
          key={band.distanceKm}
          aria-labelledby={`distance-band-${band.distanceKm}`}
        >
          <h2
            id={`distance-band-${band.distanceKm}`}
            className="text-xl font-bold"
          >
            {band.distanceKm}キロ離れています
          </h2>
          <LocationGrid locations={band.locations} />
        </section>
      ))}
    </div>
  );
}

function DataProviderCard() {
  return (
    <Card title="データ提供元" className="ruby-text">
      <p>
        この場所データは、ボランティアがつくった
        <a
          href="https://github.com/nawashiro/chiyoda_city_main_facilities"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          千代田区主要施設座標データ
        </a>
        による「<ruby>風<rt>かざ</rt></ruby>ぐるまの停留所から徒歩圏内（600m以内）であることがわかっている場所」を使用しています。
      </p>
      <p>
        誤りが含まれていたり、古いデータが残っていたり、新たに加えてほしい場所があるときは、直接プルリクエストを送るか、
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSeZ1eufe_2aZkRWQwr-RuCceUYUMJ7WmSfUr1ZsX5QTDRqFKQ/viewform?usp=header"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          こちらのフォーム
        </a>
        からお知らせください。
      </p>
      <p>写真のご提供も歓迎しています。</p>
    </Card>
  );
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { "category-id": encodedCategoryId } = await params;
  const categoryId = decodeCategoryId(encodedCategoryId);

  let data: KeyLocationsDataResult;
  try {
    data = await loadLocationPageData();
  } catch {
    return <DataErrorState />;
  }

  if (!isSuccessfulLocationData(data)) {
    return <DataErrorState />;
  }

  const category = data.categories.find(
    (candidate) => candidate["category:en"] === categoryId,
  );
  if (!category) {
    notFound();
  }

  const originValue = await getOriginQueryValue(searchParams);
  const parsedOrigin: LocationOrigin = parseLocationOrigin(originValue);
  const isDistanceMode = parsedOrigin.originState === "valid";

  let areaGroups: LocationAreaGroup[];
  try {
    areaGroups = groupCategoryLocations(category.locations);
  } catch {
    return <DataErrorState />;
  }

  const areaNameByLocationId = createAreaNameByLocationId(areaGroups);
  let locationList: React.ReactNode;
  if (isDistanceMode) {
    const locationsWithDistance: DistanceLocation[] = category.locations.map(
      (location) => ({
        ...location,
        displayAreaName:
          areaNameByLocationId.get(location.id) ?? "その他",
        distance: calculateDistance(
          parsedOrigin.origin.lat,
          parsedOrigin.origin.lng,
          location.lat,
          location.lng,
        ),
      }),
    );
    const sortedLocations = sortLocationsByDistance(locationsWithDistance);
    const distanceBands = groupLocationsByDistance(sortedLocations);

    locationList = (
      <>
        <p className="mt-4" role="status" aria-live="polite">
          距離の近い順で表示しています。
        </p>
        <DistanceLocationList bands={distanceBands} />
      </>
    );
  } else {
    locationList = (
      <>
        {parsedOrigin.originState === "invalid" && <OriginErrorState />}
        <p className="mt-4" role="status" aria-live="polite">
          町字ごとに表示しています。
        </p>
        <TownLocationList groups={areaGroups} />
      </>
    );
  }

  return (
    <div className="py-8">
      <PageHeader
        title={LOCATION_PAGE_TITLE}
        description={LOCATION_PAGE_DESCRIPTION}
      />

      <div className="space-y-4">
        <Card title="カテゴリを選択">
          <LocationCategoryNavigation categories={data.categories} />
        </Card>

        <Card title="近いところから表示">
          <LocationSortControls />
        </Card>

        {locationList}
        <DataProviderCard />
      </div>
    </div>
  );
}
