"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ReactGA from "react-ga4";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

/**
 * GA4を初期化し、ページ遷移を追跡するためのカスタムフック
 */
export const useGA = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // GA4の初期化（アプリケーション起動時に一度だけ実行）
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }, []);

  useEffect(() => {
    if (!pathname) return;

    // URLパラメータがある場合、それらを含めたパスを生成
    const queryString = searchParams?.toString();
    const path = queryString ? `${pathname}?${queryString}` : pathname;

    // ページビューイベントを送信
    ReactGA.send({ hitType: "pageview", page: path });
  }, [pathname, searchParams]);
};
