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

// ロケーションの一意のキーを生成する関数
const generateLocationKey = (location: KeyLocation): string => {
  return `${location.name}_${location.lat}_${location.lng}`;
};

export default function LocationsPage() {
  const [categories, setCategories] = useState<KeyLocationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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
    } else {
      setActiveCategory(category);
    }
  };

  const handleGoToLocation = (location: KeyLocation) => {
    // ホームページに遷移して目的地として設定
    const locationObj = convertToLocation(location);
    router.push(
      `/?destination=${encodeURIComponent(JSON.stringify(locationObj))}`
    );
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
          <h3 className="text-xl font-bold mb-4">{activeCategory}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories
              .find((c) => c.category === activeCategory)
              ?.locations.map((location) => (
                <div
                  key={generateLocationKey(location)}
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
                        <div tabIndex={0} role="button" className="btn btn-sm">
                          詳細
                        </div>
                        <div
                          tabIndex={0}
                          className="dropdown-content z-[1] p-3 shadow-lg bg-base-200 rounded-box w-52"
                        >
                          <p className="text-xs mb-1">データ提供:</p>
                          <p className="text-xs mb-2">{location.copyright}</p>
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
