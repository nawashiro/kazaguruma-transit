"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import DateTimeSelector from "@/components/features/DateTimeSelector";
import OriginSelector from "@/components/features/OriginSelector";
import DestinationSelector from "@/components/features/DestinationSelector";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/layouts/PageHeader";
import Announcement from "@/components/features/Announcement";
import type { Location } from "@/types/core";
import type { AddressCategory } from "@/utils/addressLoader";
import { logger } from "@/utils/logger";

interface HomeRouteFormProps {
  popularCategories: AddressCategory[];
}

export default function HomeRouteForm({ popularCategories }: HomeRouteFormProps) {
  const [selectedOrigin, setSelectedOrigin] = useState<Location | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Location | null>(null);
  const [prioritizeSpeed, setPrioritizeSpeed] = useState(false);
  const [validateLocations, setValidateLocations] = useState(false);
  const locationInputs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setPrioritizeSpeed(localStorage.getItem("prioritizeSpeed") === "true");
    } catch {
      // ブラウザが保存領域を拒否しても、画面内の選択は利用できる。
    }
    const params = new URLSearchParams(window.location.search);
    const destinationParam = params.get("destination");
    if (!destinationParam) return;
    try {
      const destination = JSON.parse(decodeURIComponent(destinationParam)) as Location;
      if (Number.isFinite(destination.lat) && Number.isFinite(destination.lng) && typeof destination.address === "string") {
        setSelectedDestination(destination);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      logger.error("目的地情報の解析に失敗しました:", error);
    }
  }, []);

  const selectPriority = (value: boolean) => {
    setPrioritizeSpeed(value);
    try {
      localStorage.setItem("prioritizeSpeed", String(value));
    } catch {
      // 保存できない端末でも、GET送信は選択値を使う。
    }
  };

  const validateSearch = (event: FormEvent<HTMLFormElement>) => {
    if (!selectedOrigin || !selectedDestination) {
      event.preventDefault();
      flushSync(() => setValidateLocations(true));
      locationInputs.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
    }
  };

  return (
    <div className="min-w-0">
      <PageHeader title={<><ruby>風<rt>かざ</rt></ruby>ぐるま乗換案内</>} description="千代田区地域福祉交通「風ぐるま」の自動案内サイト" />
      <div className="mb-6"><Announcement /></div>
      <div ref={locationInputs} className="space-y-4 min-w-0">
        <DestinationSelector categories={popularCategories} selectedLocation={selectedDestination}
          onDestinationSelected={setSelectedDestination} onEdit={() => setSelectedDestination(null)}
          validationError={validateLocations && !selectedDestination ? "目的地を確定してください" : undefined} />
        <OriginSelector selectedLocation={selectedOrigin} onOriginSelected={setSelectedOrigin} onEdit={() => setSelectedOrigin(null)}
          validationError={validateLocations && !selectedOrigin ? "出発地を確定してください" : undefined} />
        <form action="/routes" method="get" onSubmit={validateSearch} className="space-y-4 min-w-0">
          {selectedOrigin && <input type="hidden" name="origin" value={`${selectedOrigin.lat},${selectedOrigin.lng}`} />}
          {selectedDestination && <input type="hidden" name="destination" value={`${selectedDestination.lat},${selectedDestination.lng}`} />}
          <DateTimeSelector />
          <fieldset className="fieldset min-w-0 w-full border border-base-300 rounded-box bg-base-200 p-4 text-base">
            <legend className="fieldset-legend text-base">優先条件</legend>
            {[{ value: false, label: "なるべく歩きたくない、時間がかかってもいい" }, { value: true, label: "歩いてもいい、早く着きたい" }].map(option => (
              <label key={String(option.value)} className="flex items-center gap-2 text-base cursor-pointer">
                <input type="radio" className="radio shrink-0" name="prioritizeSpeed" value={String(option.value)} checked={prioritizeSpeed === option.value} onChange={() => selectPriority(option.value)} />
                <span className="ruby-text">{option.label}</span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" testId="search-route">経路を検索</Button>
        </form>
        <div className="ruby-text text-base">
          <p>※このサービスは非公式のもので、千代田区とは関係ありません</p>
          <p>※予定は変動し、実際の運行情報とは異なる場合があります</p>
          <p><a href="https://lin.ee/CgIBOSd" target="_blank" rel="noopener noreferrer" className="link">千代田区公式LINE</a>で最新の運行情報を確認できます</p>
        </div>
      </div>
    </div>
  );
}
