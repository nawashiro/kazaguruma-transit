import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/layouts/PageHeader";
import {
  convertToLocation,
  loadKeyLocationsDataResult,
  type KeyLocation,
  type KeyLocationsDataResult,
} from "@/utils/addressLoader";
import { resolveLocationDetail } from "@/lib/location/location-detail-resolver";
import { findLocationAreaName } from "@/lib/location/location-list-state";

const LOCATION_DETAIL_FALLBACK_TITLE = "場所詳細 | 風ぐるま乗換案内";
const LOCATION_DETAIL_DESCRIPTION = "風ぐるまで行ける場所の詳細情報";
const LOCATION_DETAIL_TITLE_SUFFIX = " - 場所詳細";
const DUPLICATE_LOCATION_ID_ERROR = "場所識別子が重複しています";
const DUPLICATE_LOCATION_ID_MESSAGE =
  `${DUPLICATE_LOCATION_ID_ERROR}。\n\n管理者にお問い合わせください。\nこのエラーはサーバー管理者しか修正できません。`;

type LocationDetailPageProps = {
  params: Promise<{ id: string }>;
};

async function resolveLocationDetailForPage(id: unknown) {
  let data: KeyLocationsDataResult;
  try {
    data = await loadKeyLocationsDataResult();
  } catch (error) {
    data = {
      status: "error",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  return resolveLocationDetail(id, data);
}

export async function generateMetadata({
  params,
}: LocationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await resolveLocationDetailForPage(id);

  return {
    title:
      result.status === "success"
        ? `${result.location.name}${LOCATION_DETAIL_TITLE_SUFFIX}`
        : LOCATION_DETAIL_FALLBACK_TITLE,
    description: LOCATION_DETAIL_DESCRIPTION,
  };
}

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

function DestinationLink({ location }: { location: KeyLocation }) {
  const locationObject = convertToLocation(location);

  return (
    <Link
      href={`/?destination=${encodeURIComponent(JSON.stringify(locationObject))}`}
      className="btn btn-primary text-base inline-flex rounded-full dark:rounded-sm min-h-[44px] h-fit dark:text-white"
    >
      <span className="ruby-text">ここへ行く</span>
    </Link>
  );
}

/** Displays location details without dialog lifecycle or focus management. */
function LocationDetailMarkup({
  location,
  areaName,
}: {
  location: KeyLocation;
  areaName: string | null;
}) {
  return (
    <div className="space-y-4">
      {areaName && (
        <dl className="text-base join space-x-2">
          <dt className="font-bold join-item">地域</dt>
          <dd className="join-item">{areaName}</dd>
        </dl>
      )}

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
          {location.imageCopyright && (
            <div className="list-row">
              <dt>画像提供</dt>
              <dd>{location.imageCopyright}</dd>
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

      <div className="mt-4">
        <DestinationLink location={location} />
      </div>

    </div>
  );
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
      <p className="mb-4">
        <Link href="/locations" className="link">
          場所一覧に戻る
        </Link>
      </p>
      <PageHeader title={title} />
      <div className="alert alert-error alert-soft text-base-content!">
        <h2>エラー</h2>
        <p className="whitespace-pre-line">{message}</p>
      </div>
    </div>
  );
}

/** Resolves a location directly from the dynamic route identifier. */
export default async function LocationDetailPage({
  params,
}: LocationDetailPageProps) {
  const { id } = await params;
  const result = await resolveLocationDetailForPage(id);

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
    const message =
      result.error.message === DUPLICATE_LOCATION_ID_ERROR
        ? DUPLICATE_LOCATION_ID_MESSAGE
        : `${result.error.message}。場所一覧から選び直してください。`;

    return (
      <StatePage
        title="場所詳細を表示できません"
        message={message}
      />
    );
  }

  const location = result.location;
  return (
    <div className="py-8">
      <p className="mb-4">
        <Link href="/locations" className="link">
          場所一覧に戻る
        </Link>
      </p>
      <PageHeader title={location.name} />
      <LocationDetailMarkup
        location={location}
        areaName={await getAreaName(location)}
      />
    </div>
  );
}
