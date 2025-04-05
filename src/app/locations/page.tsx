"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  loadKeyLocationsData,
  KeyLocationCategory,
  KeyLocation,
  convertToLocation,
} from "../../utils/addressLoader";

// 2点間の距離を計算する関数（ハーバーサイン公式）
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  // 緯度経度をラジアンに変換
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lon1Rad = (lon1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const lon2Rad = (lon2 * Math.PI) / 180;

  // ハーバーサイン公式
  const R = 6371; // 地球の半径（キロメートル）
  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // キロメートル単位の距離
};

interface LocationWithDistance extends KeyLocation {
  distance?: number;
}

export default function LocationsPage() {
  const [categories, setCategories] = useState<KeyLocationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortedByDistance, setSortedByDistance] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationsSorted, setLocationsSorted] = useState<
    LocationWithDistance[]
  >([]);
  const [positionLoading, setPositionLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchLocationData() {
      try {
        setLoading(true);
        const data = await loadKeyLocationsData();
        setCategories(data);
        setError(null);
      } catch (err) {
        setError("施設データの読み込みに失敗しました");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchLocationData();
  }, []);

  const toggleCategory = (category: string) => {
    if (activeCategory === category) {
      setActiveCategory(null);
      setSortedByDistance(false);
    } else {
      setActiveCategory(category);
      if (sortedByDistance && currentPosition) {
        const categoryLocations =
          categories.find((c) => c.category === category)?.locations || [];

        const locationsWithDistance = categoryLocations.map((location) => {
          const distance = calculateDistance(
            currentPosition.lat,
            currentPosition.lng,
            location.lat,
            location.lng
          );
          return { ...location, distance };
        });

        const sorted = [...locationsWithDistance].sort(
          (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
        );

        setLocationsSorted(sorted);
      }
    }
  };

  const handleGoToLocation = (location: KeyLocation) => {
    // ホームページに遷移して目的地として設定
    const locationObj = convertToLocation(location);
    router.push(
      `/?destination=${encodeURIComponent(JSON.stringify(locationObj))}`
    );
  };

  const sortByDistance = () => {
    setPositionLoading(true);
    setSortedByDistance(false);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setCurrentPosition({ lat: userLat, lng: userLng });

          if (activeCategory) {
            const categoryLocations =
              categories.find((c) => c.category === activeCategory)
                ?.locations || [];

            const locationsWithDistance = categoryLocations.map((location) => {
              const distance = calculateDistance(
                userLat,
                userLng,
                location.lat,
                location.lng
              );
              return { ...location, distance };
            });

            // 距離で昇順ソート（近い順）
            const sorted = [...locationsWithDistance].sort(
              (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
            );

            setLocationsSorted(sorted);
            setSortedByDistance(true);
            setPositionLoading(false);
          }
        },
        (error) => {
          console.error("位置情報の取得に失敗しました:", error);
          setError(
            "位置情報の取得に失敗しました。ブラウザの位置情報サービスを有効にしてください。"
          );
          setPositionLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setError("お使いのブラウザは位置情報をサポートしていません。");
      setPositionLoading(false);
    }
  };

  // 距離に基づいてロケーションをグループ化する関数
  const groupLocationsByDistance = (locations: LocationWithDistance[]) => {
    const groups: { [key: number]: LocationWithDistance[] } = {};

    locations.forEach((location) => {
      if (location.distance !== undefined) {
        // 距離を1km単位で丸める
        const roundedDistance = Math.floor(location.distance);
        if (!groups[roundedDistance]) {
          groups[roundedDistance] = [];
        }
        groups[roundedDistance].push(location);
      }
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <header className="text-center my-4">
          <h1 className="text-3xl font-bold">場所をさがす</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="ml-3 text-lg font-medium">施設データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <header className="text-center my-4">
          <h1 className="text-3xl font-bold">場所をさがす</h1>
        </header>
        <div className="alert alert-error max-w-lg mx-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">場所をさがす</h1>
        <p className="mt-2 text-xl">カテゴリから探す</p>
      </header>

      <div className="mb-4 space-y-4">
        {!sortedByDistance ? (
          <button
            className="btn btn-outline"
            onClick={sortByDistance}
            disabled={positionLoading || !activeCategory}
          >
            {positionLoading ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                位置情報取得中...
              </>
            ) : (
              "近い順に並べ替える"
            )}
          </button>
        ) : (
          <button
            className="btn btn-outline"
            onClick={() => setSortedByDistance(false)}
          >
            通常表示に戻す
          </button>
        )}
        <p className="text-sm text-gray-500">
          スマホから利用しないと正確な位置情報が取得できない可能性があります。
        </p>
      </div>

      <div className="card bg-base-100 shadow-lg mb-6 overflow-hidden">
        <div className="card-body p-4">
          <h2 className="card-title">カテゴリを選択</h2>

          <div className="flex flex-row flex-wrap gap-2 mb-4">
            {categories.map((category) => (
              <button
                key={category.category}
                className={`btn border px-2 py-1 h-auto min-h-0 rounded-md justify-start font-medium
                  ${
                    activeCategory === category.category
                      ? "btn-primary border-primary text-primary-content"
                      : "btn-outline hover:border-primary/50 hover:bg-primary/5"
                  }
                `}
                onClick={() => toggleCategory(category.category)}
              >
                {category.category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeCategory && (
        <div className="animate-fadeIn">
          {sortedByDistance ? (
            // 位置情報に基づいてソートされた表示
            <div>
              {Object.entries(groupLocationsByDistance(locationsSorted))
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([distance, locations]) => (
                  <div key={distance}>
                    <h2 className="text-lg font-semibold my-3 pb-1 border-b border-base-300">
                      {distance}キロ離れています
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {locations.map((location) => (
                        <div
                          key={location.id}
                          className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow"
                        >
                          {location.imageUri && (
                            <figure className="relative h-48 w-full">
                              <Image
                                src={location.imageUri}
                                alt={location.name}
                                fill
                                style={{ objectFit: "cover" }}
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              />
                              {location.imageCopylight && (
                                <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                                  {location.imageCopylight}
                                </div>
                              )}
                            </figure>
                          )}

                          <div className="card-body">
                            <h2 className="card-title">{location.name}</h2>
                            {location.distance !== undefined && (
                              <p className="text-sm text-gray-500">
                                約{location.distance.toFixed(1)}km
                              </p>
                            )}

                            {location.description && (
                              <p className="text-sm mt-1 line-clamp-3">
                                {location.description}
                              </p>
                            )}

                            {location.uri && (
                              <a
                                href={location.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link link-primary text-sm"
                              >
                                ウェブサイトを見る
                              </a>
                            )}

                            <div className="card-actions justify-between mt-4">
                              <div className="dropdown dropdown-top">
                                <div
                                  tabIndex={0}
                                  role="button"
                                  className="btn btn-sm"
                                >
                                  詳細
                                </div>
                                <div
                                  tabIndex={0}
                                  className="dropdown-content z-[1] p-3 shadow-lg bg-base-200 rounded-box w-52"
                                >
                                  <p className="text-xs mb-1">
                                    座標データ提供:
                                  </p>
                                  <p className="text-xs mb-2">
                                    {location.nodeCopyright}
                                  </p>
                                  {location.description &&
                                    location.descriptionCopyright && (
                                      <>
                                        <p className="text-xs mb-1">
                                          説明文提供:
                                        </p>
                                        <p className="text-xs mb-2">
                                          {location.descriptionCopyright}
                                        </p>
                                      </>
                                    )}
                                  <p className="text-xs mb-1">ライセンス:</p>
                                  <a
                                    href={location.licenceUri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link link-primary text-xs"
                                  >
                                    {location.licence}
                                  </a>
                                </div>
                              </div>

                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleGoToLocation(location)}
                              >
                                ここへ行く
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // 通常表示（カテゴリ順）
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories
                .find((c) => c.category === activeCategory)
                ?.locations.map((location) => (
                  <div
                    key={location.id}
                    className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow"
                  >
                    {location.imageUri && (
                      <figure className="relative h-48 w-full">
                        <Image
                          src={location.imageUri}
                          alt={location.name}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        {location.imageCopylight && (
                          <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                            {location.imageCopylight}
                          </div>
                        )}
                      </figure>
                    )}

                    <div className="card-body">
                      <h2 className="card-title">{location.name}</h2>

                      {location.description && (
                        <p className="text-sm mt-1 line-clamp-3">
                          {location.description}
                        </p>
                      )}

                      {location.uri && (
                        <a
                          href={location.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary text-sm"
                        >
                          ウェブサイトを見る
                        </a>
                      )}

                      <div className="card-actions justify-between mt-4">
                        <div className="dropdown dropdown-top">
                          <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-sm"
                          >
                            詳細
                          </div>
                          <div
                            tabIndex={0}
                            className="dropdown-content z-[1] p-3 shadow-lg bg-base-200 rounded-box w-52"
                          >
                            <p className="text-xs mb-1">座標データ提供:</p>
                            <p className="text-xs mb-2">
                              {location.nodeCopyright}
                            </p>
                            {location.description &&
                              location.descriptionCopyright && (
                                <>
                                  <p className="text-xs mb-1">説明文提供:</p>
                                  <p className="text-xs mb-2">
                                    {location.descriptionCopyright}
                                  </p>
                                </>
                              )}
                            <p className="text-xs mb-1">ライセンス:</p>
                            <a
                              href={location.licenceUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary text-xs"
                            >
                              {location.licence}
                            </a>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleGoToLocation(location)}
                        >
                          ここへ行く
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
