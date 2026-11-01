import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PageHeader from "@/components/layouts/PageHeader";
import RouteSearchResults from "@/components/features/RouteSearchResults";
import { searchRoutes } from "@/lib/transit/search-routes";

export const dynamic = "force-dynamic";

interface RoutesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RoutesPage({ searchParams }: RoutesPageProps) {
  const params = new URLSearchParams();
  for (const [name, values] of Object.entries(await searchParams)) {
    for (const value of Array.isArray(values) ? values : values === undefined ? [] : [values]) {
      params.append(name, value);
    }
  }
  const result = await searchRoutes(params, await headers());
  if (result.status === "limited") redirect("/rate-limit?source=routes");

  return (
    <div>
      <PageHeader
        title="経路検索結果"
        description="自動作成されたスケジュール"
        breadcrumbs={[
          { label: "トップ", href: "/" },
          { label: "経路検索結果" },
        ]}
      />
      <RouteSearchResults result={result} />
    </div>
  );
}
