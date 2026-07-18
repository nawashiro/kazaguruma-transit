"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DateTimeSelector from "@/components/features/DateTimeSelector";
import OriginSelector from "@/components/features/OriginSelector";
import DestinationSelector from "@/components/features/DestinationSelector";
import Button from "@/components/ui/Button";
import ResetButton from "@/components/ui/ResetButton";
import PageHeader from "@/components/layouts/PageHeader";
import Card from "@/components/ui/Card";
import AwardRecognition from "@/components/features/AwardRecognition";
import type { Location, TransitFormData } from "@/types/core";
import { buildRouteResultsUrl } from "@/lib/transit/route-search-query";
import { logger } from "@/utils/logger";

export default function Home() {
  const router = useRouter();
  const [selectedOrigin, setSelectedOrigin] = useState<Location | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Location | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState("");
  const [isDeparture, setIsDeparture] = useState(true);
  const [prioritizeSpeed, setPrioritizeSpeed] = useState(false);

  useEffect(() => {
    const savedPrioritizeSpeed = localStorage.getItem("prioritizeSpeed");
    if (savedPrioritizeSpeed) {
      setPrioritizeSpeed(savedPrioritizeSpeed === "true");
    }

    const params = new URLSearchParams(window.location.search);
    const destinationParam = params.get("destination");
    if (!destinationParam) return;

    try {
      const destination = JSON.parse(decodeURIComponent(destinationParam)) as Location;
      if (
        Number.isFinite(destination.lat) &&
        Number.isFinite(destination.lng) &&
        typeof destination.address === "string"
      ) {
        setSelectedDestination(destination);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      logger.error("目的地情報の解析に失敗しました:", error);
    }
  }, []);

  const resetSearch = () => {
    setSelectedOrigin(null);
    setSelectedDestination(null);
    setSelectedDateTime("");
  };

  const handleDateTimeSelected = (formData: TransitFormData) => {
    setSelectedDateTime(formData.dateTime || "");
    setIsDeparture(formData.isDeparture ?? true);
  };

  const handleSearch = () => {
    if (!selectedOrigin || !selectedDestination || !selectedDateTime) return;

    router.push(
      buildRouteResultsUrl({
        origin: selectedOrigin,
        destination: selectedDestination,
        time: selectedDateTime,
        isDeparture,
        prioritizeSpeed,
      }),
    );
  };

  const locationText = (location: Location): string =>
    location.address || `緯度: ${location.lat.toFixed(6)}, 経度: ${location.lng.toFixed(6)}`;

  const renderInput = () => {
    if (!selectedDestination) {
      return <DestinationSelector onDestinationSelected={setSelectedDestination} />;
    }

    if (!selectedOrigin) {
      return (
        <div className="flex flex-col gap-4">
          <Card title="選択された目的地">
            <p data-testid="selected-destination">{locationText(selectedDestination)}</p>
          </Card>
          <OriginSelector onOriginSelected={setSelectedOrigin} />
          <ResetButton onReset={resetSearch} className="order-first" />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <Card title="選択された目的地">
          <p data-testid="selected-destination">{locationText(selectedDestination)}</p>
        </Card>
        <Card title="選択された出発地">
          <p data-testid="selected-origin">{locationText(selectedOrigin)}</p>
        </Card>
        <Card title="日時の選択">
          <DateTimeSelector onDateTimeSelected={handleDateTimeSelected} />
          <div className="form-control mt-4 space-y-2">
            <p className="text-sm /60 mt-1 ruby-text">
              早く到着したい場合はオンにしてください。<br />
              歩きを最小限にしたい場合はオフにしてください。
            </p>
            <label className="flex cursor-pointer items-center space-x-2">
              <span className="label-text ruby-text">はやさ優先</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={prioritizeSpeed}
                onChange={(event) => {
                  setPrioritizeSpeed(event.target.checked);
                  localStorage.setItem("prioritizeSpeed", String(event.target.checked));
                }}
                aria-label="はやさ優先"
              />
              <span className="label-text" aria-hidden="true">
                {prioritizeSpeed ? "ON" : "OFF"}
              </span>
            </label>
          </div>
          <div className="card-actions justify-center">
            <Button
              className="w-full"
              onClick={handleSearch}
              disabled={!selectedDateTime}
              testId="search-route"
            >
              検索
            </Button>
          </div>
        </Card>
        <ResetButton onReset={resetSearch} className="order-first" />
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title={
          <>
            <ruby>風<rt>かざ</rt></ruby>ぐるま乗換案内
          </>
        }
        description="千代田区福祉交通の乗換案内サービス"
      />
      <div className="mb-6"><AwardRecognition /></div>
      <div className="space-y-4">
        <div aria-live="polite" className="space-y-4">{renderInput()}</div>
        <Card bodyClassName="ruby-text">
          <p>※このサービスは非公式のもので、千代田区とは関係ありません</p>
          <p>※予定は変動し、実際の運行情報とは異なる場合があります</p>
          <p><a href="https://lin.ee/CgIBOSd" target="_blank" rel="noopener noreferrer" className="link">千代田区公式LINE</a>で最新の運行情報を確認できます</p>
        </Card>
      </div>
    </div>
  );
}
