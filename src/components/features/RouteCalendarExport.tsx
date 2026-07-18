"use client";

import { useState } from "react";
import { FiCalendar } from "react-icons/fi";
import Button from "@/components/ui/Button";
import { buildRouteCalendar } from "@/lib/calendar/route-calendar";
import type { RouteCalendarInput } from "@/types/calendar";
import { logger } from "@/utils/logger";

type RouteCalendarExportProps = RouteCalendarInput;

function createCalendarFilename(originName: string, destinationName: string) {
  const unsafeFilenameCharacters = /[\\/:*?"<>|]/g;
  return `乗換案内_${originName}_${destinationName}.ics`.replace(
    unsafeFilenameCharacters,
    "_"
  );
}

export default function RouteCalendarExport(props: RouteCalendarExportProps) {
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const handleDownload = () => {
    try {
      setCalendarError(null);
      const calendar = buildRouteCalendar(props);
      const blob = new Blob([calendar], {
        type: "text/calendar;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.style.display = "none";
      link.href = url;
      link.download = createCalendarFilename(
        props.originStop.stopName,
        props.destinationStop.stopName
      );
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      logger.error("カレンダー生成エラー:", error);
      setCalendarError(
        error instanceof Error
          ? error.message
          : "カレンダーの生成中にエラーが発生しました"
      );
    }
  };

  return (
    <>
      {calendarError && (
        <div
          role="alert"
          className="alert alert-error alert-soft text-base-content!"
        >
          <span>カレンダー生成エラー: {calendarError}</span>
        </div>
      )}
      <Button onClick={handleDownload}>
        <FiCalendar className="h-5 w-5" aria-hidden="true" />
        <span className="ruby-text">カレンダーに追加</span>
      </Button>
    </>
  );
}
