"use client";

import { useGA } from "@/lib/analytics/useGA";
import { Suspense } from "react";

/**
 * Google Analytics 4を初期化するためのクライアントコンポーネント
 * App Routerでは、このコンポーネントをlayout.tsxに配置する
 */
export default function GoogleAnalytics() {
  return (
    <Suspense>
      <GATracker />
    </Suspense>
  );
}

// 実際のGA追跡を行うコンポーネント
function GATracker() {
  // GA4の初期化とページ遷移の追跡
  useGA();

  // このコンポーネントは何もレンダリングしない
  return null;
}
