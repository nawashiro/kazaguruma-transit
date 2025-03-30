"use client";

import { useState, useEffect } from "react";
import { Location } from "../types/transit";
import {
  AddressCategory,
  AddressLocation,
  loadAddressData,
  convertToLocation,
} from "../utils/addressLoader";

interface LocationSuggestionsProps {
  onLocationSelected: (location: Location) => void;
}

export default function LocationSuggestions({
  onLocationSelected,
}: LocationSuggestionsProps) {
  const [categories, setCategories] = useState<AddressCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAddressData() {
      try {
        setLoading(true);
        const data = await loadAddressData();
        setCategories(data);
        setError(null);

        // 最初のカテゴリを自動的に開く
        if (data.length > 0) {
          setActiveCategory(data[0].category);
        }
      } catch (err) {
        setError("住所データの読み込みに失敗しました");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchAddressData();
  }, []);

  const handleLocationSelect = (location: AddressLocation) => {
    onLocationSelected(convertToLocation(location));
  };

  const toggleCategory = (category: string) => {
    if (activeCategory === category) {
      setActiveCategory(null);
    } else {
      setActiveCategory(category);
    }
  };

  if (loading) {
    return (
      <div className="card bg-base-100 shadow-lg mb-6 overflow-hidden">
        <div className="card-body items-center text-center">
          <div className="flex items-center justify-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="ml-3 text-lg font-medium">
              施設データを読み込み中...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-base-100 shadow-lg mb-6 overflow-hidden">
        <div className="card-body">
          <div className="alert alert-error">
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
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-lg mb-6 overflow-hidden">
      <div className="card-body p-4">
        <h2 className="card-title justify-center text-2xl font-bold mb-4 text-primary">
          よく利用される施設から選択
        </h2>

        <div className="flex flex-row flex-wrap gap-2 mb-4">
          {categories.map((category) => {
            return (
              <button
                key={category.category}
                className={`btn border px-2 py-1 h-auto min-h-0 rounded-md justify-start font-medium
                  ${
                    activeCategory === category.category
                      ? "btn-primary border-primary text-primary-content"
                      : "btn-ghost border-base-200 hover:border-primary/50 hover:bg-primary/5"
                  }
                `}
                onClick={() => toggleCategory(category.category)}
              >
                {category.category}
              </button>
            );
          })}
        </div>

        {activeCategory && (
          <div className="bg-base-200 rounded-box p-3 animate-fadeIn max-h-64 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {categories
                .find((c) => c.category === activeCategory)!
                .locations.map((location) => (
                  <button
                    key={location.name}
                    className="btn btn-sm h-auto min-h-0 py-2 btn-outline btn-primary justify-start normal-case w-full"
                    onClick={() => handleLocationSelect(location)}
                    title={location.name}
                  >
                    <div className="flex items-center w-full overflow-hidden">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-2 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="truncate">{location.name}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

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
