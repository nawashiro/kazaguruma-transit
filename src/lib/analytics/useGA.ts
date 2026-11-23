"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ReactGA from "react-ga4";
import { appConfig } from "@/lib/config/app-config";
import { ownerFields, syncOwnerFlag } from "./tracking";

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

    const owner = syncOwnerFlag();
    const key = `${pathname}?${queryString}`;
    if (previousPage.current?.key === key) return;

    const page = {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_referrer: previousPage.current?.location ?? sanitizeUrl(document.referrer),
      ...ownerFields(),
    };
    ReactGA.set(page);
    if (!ReactGA.isInitialized) {
      ReactGA.initialize(GA_MEASUREMENT_ID, {
        gtagOptions: {
          send_page_view: false,
          ...(owner ? { debug_mode: true } : {}),
        },
      });
    }

    ReactGA.send({ hitType: "pageview", ...page });
    previousPage.current = { key, location: page.page_location };
  }, [pathname, queryString]);
};
