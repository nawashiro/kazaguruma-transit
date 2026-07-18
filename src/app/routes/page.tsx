"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/layouts/PageHeader";
import RouteSearchResults from "@/components/features/RouteSearchResults";
import Card from "@/components/ui/Card";

function RouteSearchResultsFromUrl() {
  const searchParams = useSearchParams();
  return <RouteSearchResults searchParams={searchParams.toString()} />;
}

export default function RoutesPage() {
  return (
    <div>
      <PageHeader title="経路検索結果" description="指定した条件の乗換経路" />
      <Suspense fallback={<Card>経路を検索中...</Card>}>
        <RouteSearchResultsFromUrl />
      </Suspense>
    </div>
  );
}
