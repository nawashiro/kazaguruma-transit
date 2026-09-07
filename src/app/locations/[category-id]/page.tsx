import { notFound } from "next/navigation";
import PageHeader from "@/components/layouts/PageHeader";
import {
  calculateDistance,
  sortLocationsByDistance,
} from "@/lib/location/location-list-state";
import {
  groupLocationsByArea,
  loadGeoJSON,
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

type DistanceLocation = KeyLocation & {
  distance?: number;
};

type LocationAreaGroup = {
  name: string;
  locations: KeyLocation[];
};

type SuccessfulLocationData = {
  status: "success";
  categories: KeyLocationCategory[];
};

const INVALID_ORIGIN_QUERY = "__invalid-origin-query__";

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

function groupLocationsByProvidedArea(
  locations: KeyLocation[],
): LocationAreaGroup[] {
  const groups = new Map<string, KeyLocation[]>();

  for (const location of locations) {
    const areaName = typeof location.area === "string" ? location.area.trim() : "";
    const groupName = areaName || "その他";
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

async function groupCategoryLocations(
  locations: KeyLocation[],
): Promise<LocationAreaGroup[]> {
  const allHaveArea = locations.every(
    (location) =>
      typeof location.area === "string" && location.area.trim().length > 0,
  );

  if (allHaveArea) {
    return groupLocationsByProvidedArea(locations);
  }

  const geoJSON = await loadGeoJSON();
  const groupedLocations = groupLocationsByArea(locations, geoJSON);
  return Object.entries(groupedLocations).map(([name, grouped]) => ({
    name,
    locations: grouped as KeyLocation[],
  }));
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
  location: KeyLocation;
  areaName?: string;
}) {
  return (
    <div className="card w-full bg-base-100 shadow-sm">
      <a
        href={`/locations/location-detail/${encodeURIComponent(location.id)}`}
        className="block p-4 transition-shadow hover:shadow-md"
      >
        {location.imageUri && (
          <img
            src={location.imageUri}
            alt=""
            className="mb-3 h-48 w-full rounded-xl object-cover"
          />
        )}
        <h3 className="text-xl font-bold">{location.name}</h3>
        {areaName && <p className="mt-1 text-base">{areaName}</p>}
        {location.description && (
          <p className="mt-1 text-base ruby-text">{location.description}</p>
        )}
      </a>
    </div>
  );
}

function LocationList({
  groups,
  mode,
}: {
  groups: LocationAreaGroup[];
  mode: "town" | "distance";
}) {
  if (mode === "distance") {
    return (
      <section aria-labelledby="distance-results-heading" className="mt-6">
        <h2 id="distance-results-heading" className="text-xl font-bold">
          距離の近い順
        </h2>
        <ul className="mt-4 grid gap-4">
          {groups[0]?.locations.map((location) => (
            <li key={location.id}>
              <LocationSummary location={location} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {groups.map((group) => (
        <section key={group.name} aria-labelledby={`area-${group.name}`}>
          <h2 id={`area-${group.name}`} className="text-xl font-bold">
            {group.name}
          </h2>
          <ul className="mt-4 grid gap-4">
            {group.locations.map((location) => (
              <li key={location.id}>
                <LocationSummary location={location} areaName={group.name} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
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

  if (isDistanceMode) {
    const locationsWithDistance: DistanceLocation[] = category.locations.map(
      (location) => ({
        ...location,
        distance: calculateDistance(
          parsedOrigin.origin.lat,
          parsedOrigin.origin.lng,
          location.lat,
          location.lng,
        ),
      }),
    );
    const sortedLocations = sortLocationsByDistance(locationsWithDistance);

    return (
      <div className="py-8">
        <PageHeader title={category.category} />
        <p className="mt-4" role="status" aria-live="polite">
          距離の近い順で表示しています。
        </p>
        <LocationList
          mode="distance"
          groups={[{ name: "距離の近い順", locations: sortedLocations }]}
        />
      </div>
    );
  }

  let areaGroups: LocationAreaGroup[];
  try {
    areaGroups = await groupCategoryLocations(category.locations);
  } catch {
    return <DataErrorState />;
  }

  return (
    <div className="py-8">
      <PageHeader title={category.category} />
      {parsedOrigin.originState === "invalid" && <OriginErrorState />}
      <p className="mt-4" role="status" aria-live="polite">
        町字ごとに表示しています。
      </p>
      <LocationList mode="town" groups={areaGroups} />
    </div>
  );
}
