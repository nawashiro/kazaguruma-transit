"use client";

import { useGA } from "@/lib/analytics/useGA";

/**
 * Google Analytics 4を初期化するためのクライアントコンポーネント
 * App Routerでは、このコンポーネントをlayout.tsxに配置する
 */
export default function GoogleAnalytics() {
  // GA4の初期化とページ遷移の追跡
  useGA();

  // このコンポーネントは何もレンダリングしない
  return null;
}
