"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ReactGA from "react-ga4";
import { logger } from "@/utils/logger";
import { appConfig } from "@/lib/config/app-config";

const GA_MEASUREMENT_ID = appConfig.gaMeasurementId;
const isDevelopment = process.env.NODE_ENV === "development";

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

export const useGA = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() ?? "";
  const previousPage = useRef<{ key: string; location: string } | null>(null);

  useEffect(() => {
    if (!pathname || isDevelopment || !GA_MEASUREMENT_ID) return;

    const key = `${pathname}?${queryString}`;
    if (previousPage.current?.key === key) return;

    const page = {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_referrer: previousPage.current?.location ?? sanitizeUrl(document.referrer),
    };
    ReactGA.set(page);
    if (!ReactGA.isInitialized) {
      ReactGA.initialize(GA_MEASUREMENT_ID, {
        gtagOptions: { send_page_view: false },
      });
    }

    ReactGA.send({ hitType: "pageview", ...page });
    previousPage.current = { key, location: page.page_location };
  }, [pathname, queryString]);
};

/**
 * カスタムイベントを送信する関数
 */
export const sendEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  // 開発環境ではイベントをコンソールに出力するだけ
  if (isDevelopment) {
    logger.log(`[GA Event] ${category} / ${action} / ${label} / ${value}`);
    return;
  }

  // GA4のイベント送信
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      category,
      action,
      label,
      value,
    });
  }
};
