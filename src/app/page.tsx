"use client";

import { useState } from "react";
import TransitForm from "../components/TransitForm";
import DeparturesList from "../components/DeparturesList";
import { Departure, TransitFormData } from "../types/transit";

export default function Home() {
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const handleFormSubmit = async (formData: TransitFormData) => {
    setLoading(true);
    setError(null);
    setSearchPerformed(true);

    try {
      // APIパラメータを構築
      const params = new URLSearchParams();
      if (formData.stopId) params.append("stop", formData.stopId);
      if (formData.routeId) params.append("route", formData.routeId);

      // API呼び出し
      const response = await fetch(`/api/transit?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "乗換案内の取得に失敗しました");
      }

      setDepartures(data.departures || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました"
      );
      setDepartures([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="text-center my-8">
        <h1 className="text-3xl font-bold text-primary">かざぐるま乗換案内</h1>
        <p className="mt-2 text-lg">千代田線の乗換案内サービス</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <TransitForm onSubmit={handleFormSubmit} />
        </div>

        <div className="md:col-span-2">
          {searchPerformed && (
            <div className="bg-base-200 p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">出発案内</h2>
              <DeparturesList
                departures={departures}
                loading={loading}
                error={error}
              />
            </div>
          )}
        </div>
      </div>

      <footer className="text-center text-sm text-gray-500 mt-16 mb-8">
        <p>© {new Date().getFullYear()} かざぐるま乗換案内 - 非公式サービス</p>
        <p className="mt-1">
          このサービスは
          <a
            href="https://github.com/BlinkTagInc/transit-departures-widget"
            className="text-primary hover:underline"
          >
            transit-departures-widget
          </a>
          と
          <a
            href="https://daisyui.com/"
            className="text-primary hover:underline"
          >
            DaisyUI
          </a>
          を利用しています
        </p>
      </footer>
    </div>
  );
}
