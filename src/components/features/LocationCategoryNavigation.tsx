"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useRef, type KeyboardEvent } from "react";
import {
  parseLocationOrigin,
  serializeLocationOrigin,
} from "@/lib/location/location-origin-query";

export type LocationCategoryNavigationCategory = {
  category: string;
  "category:en": string;
};

export type LocationCategoryNavigationProps = {
  categories: readonly LocationCategoryNavigationCategory[];
};

function normalizePathname(pathname: string | null): string {
  if (!pathname) {
    return "/";
  }

  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

function isCategoryPath(pathname: string | null, categoryId: string): boolean {
  const normalizedPathname = normalizePathname(pathname);
  const categoryPath = `/locations/${encodeURIComponent(categoryId)}`;

  if (normalizedPathname === categoryPath) {
    return true;
  }

  try {
    return decodeURIComponent(normalizedPathname) === `/locations/${categoryId}`;
  } catch {
    return false;
  }
}

function categoryPath(categoryId: string): string {
  return `/locations/${encodeURIComponent(categoryId)}`;
}

function categoryHref(
  categoryId: string,
  originQuery: string | null,
): string {
  const path = categoryPath(categoryId);
  return originQuery === null
    ? path
    : `${path}?origin=${encodeURIComponent(originQuery)}`;
}

export default function LocationCategoryNavigation({
  categories,
}: LocationCategoryNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const isCategoryPage = categories.some(({ "category:en": categoryId }) =>
    isCategoryPath(pathname, categoryId),
  );
  const parsedOrigin = isCategoryPage
    ? parseLocationOrigin(searchParams?.get("origin"))
    : { originState: "absent" as const };
  const originQuery =
    parsedOrigin.originState === "valid"
      ? serializeLocationOrigin(parsedOrigin.origin)
      : null;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLAnchorElement>, currentIndex: number) => {
      if (categories.length === 0) {
        return;
      }

      let targetIndex: number;
      switch (event.key) {
        case "ArrowRight":
          targetIndex = (currentIndex + 1) % categories.length;
          break;
        case "ArrowLeft":
          targetIndex = (currentIndex - 1 + categories.length) % categories.length;
          break;
        case "Home":
          targetIndex = 0;
          break;
        case "End":
          targetIndex = categories.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      linkRefs.current[targetIndex]?.focus();
    },
    [categories.length],
  );

  return (
    <nav
      aria-label="場所カテゴリ"
      className="tabs tabs-box mb-6 w-full overflow-x-auto"
    >
      <ul className="flex min-w-max">
        {categories.map(({ category, "category:en": categoryId }, index) => {
          const isCurrent = isCategoryPath(pathname, categoryId);
          return (
            <li key={categoryId} className="shrink-0">
              <Link
                href={categoryHref(categoryId, originQuery)}
                ref={(element) => {
                  linkRefs.current[index] = element;
                }}
                className={`tab min-h-[44px] min-w-[44px] whitespace-nowrap px-4 font-bold ruby-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${isCurrent ? " tab-active" : ""}`}
                aria-current={isCurrent ? "page" : undefined}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                {category}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
