"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  loadKeyLocationsData,
  KeyLocationCategory,
  KeyLocation,
  convertToLocation,
} from "../../utils/addressLoader";
import { logger } from "../../utils/logger";
import RateLimitModal from "../../components/RateLimitModal";
import LocationDetailModal from "../../components/LocationDetailModal";
import {
  loadGeoJSON,
  groupLocationsByArea,
  formatAreaName,
  getAreaNameFromCoordinates,
} from "../../utils/clientGeoUtils";
import Card from "@/components/common/Card";
import CarouselCard from "@/components/common/CarouselCard";
import { rubyfulRun } from "@/lib/rubyful/rubyfulRun";
import Button from "@/components/common/Button";

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

  // 住所検索のための状態
  const [address, setAddress] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRateLimitModalOpen, setIsRateLimitModalOpen] = useState(false);

  // 町村ごとの分類のための状態
  const [locationsByArea, setLocationsByArea] = useState<{
    [areaName: string]: LocationWithDistance[];
  }>({});
  const [geoJsonLoading, setGeoJsonLoading] = useState(false);

  // モーダル表示のための状態
  const [selectedLocation, setSelectedLocation] =
    useState<LocationWithDistance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLocationAreaName, setSelectedLocationAreaName] = useState<
    string | null
  >(null);

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

  // カテゴリが変更されたときに町村ごとに分類する
  useEffect(() => {
    async function classifyLocationsByArea() {
      if (!activeCategory) return;

      try {
        setGeoJsonLoading(true);
        const categoryLocations =
          categories.find((c) => c.category === activeCategory)?.locations ||
          [];

        if (categoryLocations.length > 0 && !sortedByDistance) {
          const geoJSON = await loadGeoJSON();
          const groupedLocations = groupLocationsByArea(
            categoryLocations,
            geoJSON
          );
          setLocationsByArea(groupedLocations);
        }
      } catch (err) {
        logger.log("GeoJSON分類エラー:", err);
      } finally {
        setGeoJsonLoading(false);
      }
    }

    classifyLocationsByArea();
  }, [activeCategory, categories, sortedByDistance]);

  const toggleCategory = (category: string) => {
    if (activeCategory === category) {
      setActiveCategory(null);
      setSortedByDistance(false);
      setLocationsByArea({});
    } else {
      setActiveCategory(category);
      // 新しいカテゴリが選択されたが、現在地情報がある場合は距離順にソートする
      if (currentPosition) {
        // 現在地情報が存在する場合は、新しいカテゴリの施設も距離でソート
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
        setSortedByDistance(true);
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
    // カテゴリが選択されていない場合はソート状態をリセットしない
    if (activeCategory) {
      setSortedByDistance(false);
    }

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
          } else {
            // カテゴリが選択されていない場合は成功メッセージで通知する
            setSearchError(null); // 前のエラーをクリア
          }
          setPositionLoading(false);
        },
        (error) => {
          console.error("位置情報の取得に失敗しました:", error);
          setSearchError(
            "位置情報の取得に失敗しました。検索機能で住所を指定してください。"
          );
          setPositionLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setSearchError(
        "お使いのブラウザは位置情報をサポートしていません。検索機能で住所を指定してください。"
      );
      setPositionLoading(false);
    }
  };

  // 住所検索を行う関数
  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchLoading(true);
    setSearchError(null);

    // 入力値のバリデーション
    if (!address.trim()) {
      setSearchError("住所を入力してください");
      setSearchLoading(false);
      return;
    }

    try {
      // 「千代田区」が含まれていない場合は接頭辞として追加
      let searchAddress = address.trim();
      if (!searchAddress.includes("千代田区")) {
        searchAddress = `千代田区 ${searchAddress}`;
      }

      // Geocoding APIを呼び出し
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(searchAddress)}`
      );
      const data = await response.json();
      logger.log("Geocode API Response:", data);

      if (response.status === 429 && data.limitExceeded) {
        setIsRateLimitModalOpen(true);
        setSearchLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "ジオコーディングに失敗しました");
      }

      if (data.success && data.results?.length > 0) {
        const firstResult = data.results[0];
        const userPosition = {
          lat: firstResult.lat,
          lng: firstResult.lng,
        };

        setCurrentPosition(userPosition);

        if (activeCategory) {
          const categoryLocations =
            categories.find((c) => c.category === activeCategory)?.locations ||
            [];

          const locationsWithDistance = categoryLocations.map((location) => {
            const distance = calculateDistance(
              userPosition.lat,
              userPosition.lng,
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
        }
      } else {
        throw new Error("住所が見つかりませんでした");
      }
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました"
      );
    } finally {
      setSearchLoading(false);
    }
  };

  // 距離に基づいてロケーションをグループ化する関数
  const groupLocationsByDistance = (locations: LocationWithDistance[]) => {
    const groups: { [key: number]: LocationWithDistance[] } = {};

    locations.forEach((location) => {
      if (location.distance !== undefined) {
        // 距離を1km単位で丸める
        const roundedDistance = Math.round(location.distance);
        if (!groups[roundedDistance]) {
          groups[roundedDistance] = [];
        }
        groups[roundedDistance].push(location);
      }
    });

    return groups;
  };

  // モーダルを開く関数
  const openLocationModal = async (location: LocationWithDistance) => {
    setSelectedLocation(location);

    // 町名を取得
    try {
      const geoJSON = await loadGeoJSON();
      const area = getAreaNameFromCoordinates(
        location.lat,
        location.lng,
        geoJSON
      );
      setSelectedLocationAreaName(area ? formatAreaName(area) : "不明");
    } catch (err) {
      logger.log("町名取得エラー:", err);
      setSelectedLocationAreaName("不明");
    }

    setIsModalOpen(true);
  };

  // モーダルを閉じる関数
  const closeLocationModal = () => {
    setIsModalOpen(false);
  };

  // 施設カードのコンポーネント（再利用のため抽出）
  const LocationCard = ({ location }: { location: LocationWithDistance }) => {
    const [areaName, setAreaName] = useState<string | null>(null);

    // コンポーネントマウント時に町名を取得
    useEffect(() => {
      const fetchAreaName = async () => {
        try {
          const geoJSON = await loadGeoJSON();
          const area = getAreaNameFromCoordinates(
            location.lat,
            location.lng,
            geoJSON
          );
          setAreaName(area ? formatAreaName(area) : "不明");
        } catch (err) {
          logger.log("町名取得エラー:", err);
          setAreaName("不明");
        }
      };

      fetchAreaName();
    }, [location.lat, location.lng]);

    return (
      <button
        onClick={() => openLocationModal(location)}
        aria-label={`${location.name}の詳細を表示`}
        className="card cursor-pointer bg-base-100 shadow-sm hover:shadow-lg transition-all w-full h-fit"
      >
        {location.imageUri && (
          <figure className="relative">
            <img
              src={location.imageUri}
              alt={location.name}
              className="object-cover h-48 w-full"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </figure>
        )}

        <div className="card-body text-left">
          <h2 className="card-title ">{location.name}</h2>

          {areaName && <p className="text-sm /60">{areaName}</p>}

          {location.description && (
            <p className="text-sm mt-1 inline ruby-text">
              {location.description}
            </p>
          )}
        </div>
      </button>
    );
  };

  rubyfulRun(
    [
      loading,
      error,
      currentPosition,
      searchError,
      isModalOpen,
      locationsSorted,
      sortByDistance,
    ],
    !loading
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center my-4">
          <h1 className="text-3xl font-bold ">場所をさがす</h1>
        </div>
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
          <h1 className="text-3xl font-bold ">場所をさがす</h1>
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
    <>
      <header className="text-center my-4 ruby-text">
        <h1 className="text-3xl font-bold">場所をさがす</h1>
        <p className="mt-2 text-xl ">
          位置とカテゴリから千代田区のスポットをさがす
        </p>
      </header>

      <main className="space-y-4">
        <Card title="近いところから表示">
          {searchError && (
            <div className="alert alert-error ruby-text">
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
              <span>{searchError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div>
              <p className="text-xs mb-1 ruby-text">モバイル端末向け</p>
              <Button
                onClick={sortByDistance}
                disabled={positionLoading}
                loading={positionLoading}
                className="w-full md:w-fit"
              >
                <p>現在地を取得</p>
              </Button>
            </div>

            <div className="divider divider-horizontal sm:flex hidden">
              または
            </div>
            <div className="divider sm:hidden">または</div>

            <div className="flex-1">
              <p className="text-xs mb-1 ruby-text">
                PC向け / 任意の場所から選びたい
              </p>
              <form
                onSubmit={handleAddressSearch}
                className="flex flex-col sm:flex-row gap-2"
              >
                <div className="form-control flex-1">
                  <input
                    type="text"
                    placeholder="住所を入力（例：神田駿河台）"
                    className="input outline w-full"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={searchLoading}
                  />
                </div>
                <Button
                  type="submit"
                  className="btn btn-primary"
                  disabled={searchLoading}
                >
                  検索
                </Button>
              </form>
            </div>
          </div>

          {currentPosition && (
            <div className="alert alert-success ruby-text">
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                位置情報を取得しました！カテゴリを選択すると最寄りの施設が表示されます
              </span>
            </div>
          )}
        </Card>

        <Card title="カテゴリを選択">
          <div className="flex flex-row flex-wrap gap-2 mb-4" role="tablist">
            {categories.map((category) => (
              <button
                key={category.category}
                className={`btn border px-2 py-1 h-auto min-h-0 rounded-md justify-start font-medium ruby-text
                ${
                  activeCategory === category.category
                    ? "btn-primary border-primary text-primary-content"
                    : "btn-outline hover:border-primary/50 hover:bg-primary/5"
                }
              `}
                onClick={() => toggleCategory(category.category)}
                role="tab"
                aria-label={`${category.category}カテゴリを${
                  activeCategory === category.category ? "閉じる" : "開く"
                }`}
              >
                <p>{category.category}</p>
              </button>
            ))}
          </div>
        </Card>

        {activeCategory && (
          <div className="animate-fadeIn mb-6">
            {geoJsonLoading && (
              <div className="flex items-center justify-center py-4">
                <span className="loading loading-spinner loading-md text-primary"></span>
                <p className="ml-3">施設を町村ごとに分類中...</p>
              </div>
            )}

            {sortedByDistance ? (
              // 位置情報に基づいてソートされた表示
              <div>
                {Object.entries(groupLocationsByDistance(locationsSorted))
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([distance, locations]) => (
                    <div key={distance}>
                      <h2 className="text-lg font-semibold my-3 pb-1 border-b border-base-300 ">
                        {distance}キロ離れています
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {locations.map((location) => (
                          <div key={location.id} className="contents">
                            <LocationCard location={location} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              // 町村ごとに分類した表示
              <div>
                {Object.entries(locationsByArea)
                  .sort(([areaNameA], [areaNameB]) =>
                    areaNameA.localeCompare(areaNameB)
                  )
                  .map(([areaName, locations]) => (
                    <div key={areaName}>
                      <h2 className="text-lg font-semibold my-3 pb-1 border-b border-base-300 ">
                        {areaName}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {locations.map((location) => (
                          <LocationCard key={location.id} location={location} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="md:flex md:justify-center ruby-text">
          <div className="carousel w-full md:max-w-3xl">
            {/* お悩みハンドブックへのリンクカード */}
            <CarouselCard
              id="slide1"
              title="悩みがあるけど、どうしたらいい？"
              prevSlideId="slide3"
              nextSlideId="slide2"
            >
              <p className="text-sm /80 mb-2">
                支援が欲しいけど、なにがあるのかわからない。
                <br />
                あてはまる悩みにチェックをつけると、役立つ支援がわかります。
              </p>
              <a
                href="https://compass.graffer.jp/handbook/landing"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline w-fit h-fit py-2"
              >
                <p>お悩みハンドブックウェブサイトへ</p>
              </a>
            </CarouselCard>

            {/* せかいビバークへのリンクカード */}
            <CarouselCard
              id="slide2"
              title="今夜、安心して泊まれる場所がない"
              prevSlideId="slide1"
              nextSlideId="slide3"
            >
              <p className="text-sm /80 mb-2">
                帰る家はありますか？
                <br />
                あったとして、安心できる場所ですか？
                <br />
                こちらから緊急お助けパックを受け取ってください。
              </p>
              <a
                href="https://sekaibivouac.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline w-fit h-fit py-2 inline"
              >
                <p>せかいビバークウェブサイトへ</p>
              </a>
            </CarouselCard>

            {/* イベント情報へのリンクカード */}
            <CarouselCard
              id="slide3"
              title="イベントを知る"
              prevSlideId="slide2"
              nextSlideId="slide1"
            >
              <p className="text-sm /80 mb-2">
                千代田区で開催されるイベント情報はこちら。
              </p>
              <a
                href="https://visit-chiyoda.tokyo/app/event"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline w-fit h-fit py-2 inline"
              >
                <p>千代田区観光協会ウェブサイトへ</p>
              </a>
              <a
                href="https://www.city.chiyoda.lg.jp/cgi-bin/event_cal_multi/calendar.cgi"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline w-fit h-fit py-2 inline"
              >
                <p>千代田区ウェブサイトへ</p>
              </a>
            </CarouselCard>
          </div>
        </div>

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
            による「風ぐるまの停留所から徒歩圏内（600m以内）であることがわかっている場所」を使用しています。
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
      </main>

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

      {/* モーダルコンポーネント */}
      {isModalOpen && (
        <LocationDetailModal
          location={selectedLocation}
          onClose={closeLocationModal}
          onGoToLocation={handleGoToLocation}
          areaName={selectedLocationAreaName}
        />
      )}

      {/* レート制限モーダル */}
      <RateLimitModal
        isOpen={isRateLimitModalOpen}
        onClose={() => setIsRateLimitModalOpen(false)}
      />
    </>
  );
}
