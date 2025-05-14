"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ReactGA from "react-ga4";
import { logger } from "@/utils/logger";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * GA4を初期化し、ページ遷移を追跡するためのカスタムフック
 */
export const useGA = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 開発環境ではGAを初期化しない
    if (isDevelopment) {
      logger.log("開発環境のため、Google Analyticsは無効化されています");
      return;
    }

    // GA4の初期化（アプリケーション起動時に一度だけ実行）
    if (GA_MEASUREMENT_ID) {
      ReactGA.initialize(GA_MEASUREMENT_ID);
      logger.log("Google Analyticsが初期化されました");
    }
  }, []);

  useEffect(() => {
    if (!pathname || isDevelopment) return;

    // URLパラメータがある場合、それらを含めたパスを生成
    const queryString = searchParams?.toString();
    const path = queryString ? `${pathname}?${queryString}` : pathname;

    // ページビューイベントを送信
    if (GA_MEASUREMENT_ID) {
      ReactGA.send({ hitType: "pageview", page: path });
    }
  }, [pathname, searchParams]);
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
