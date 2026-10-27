"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import Button from "@/components/ui/Button";
import { buildRouteCalendar } from "@/lib/calendar/route-calendar";
import type { RouteCalendarInput } from "@/types/calendar";
import { logger } from "@/utils/logger";

type RouteCalendarExportProps = RouteCalendarInput;

export default function RouteCalendarExport(props: RouteCalendarExportProps) {
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const calendarUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = calendarUrls.current;
    return () => {
      urls.forEach((url) => window.URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const handleOpen = () => {
    try {
      setCalendarError(null);
      const calendar = buildRouteCalendar(props);
      const blob = new Blob([calendar], {
        type: "text/calendar;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      calendarUrls.current.add(url);
      const link = document.createElement("a");
      link.style.display = "none";
      link.href = url;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
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
          <p className="ruby-text">カレンダー生成エラー: {calendarError}</p>
        </div>
      )}
      <Button onClick={handleOpen}>
        <Calendar className="mr-2 h-5 w-5" aria-hidden="true" />
        カレンダーに追加
      </Button>
    </>
  );
}
