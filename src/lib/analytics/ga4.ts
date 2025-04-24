"use client";

import ReactGA from "react-ga4";

/**
 * Google Analytics 4の初期化
 * @param measurementId - GA4の測定ID
 */
export const initGA = (measurementId: string): void => {
  if (process.env.NODE_ENV === "production") {
    ReactGA.initialize(measurementId);
  } else {
    console.log("GA4の追跡はプロダクション環境でのみ有効になります。");
  }
};

/**
 * ページビューイベントを送信
 * @param path - 追跡するページのパス
 */
export const sendPageview = (path: string): void => {
  if (process.env.NODE_ENV === "production") {
    ReactGA.send({ hitType: "pageview", page: path });
  }
};

/**
 * カスタムイベントを送信
 * @param category - イベントカテゴリ
 * @param action - イベントアクション
 * @param label - イベントラベル (オプション)
 * @param value - イベント値 (オプション)
 */
export const sendEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
): void => {
  if (process.env.NODE_ENV === "production") {
    ReactGA.event({
      category,
      action,
      label,
      value,
    });
  }
};
