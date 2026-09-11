import type { ReactNode } from "react";

/**
 * Keeps category-only composition inside the category route segment.
 * The page owns the ordered visual shell so its PageHeader remains the first
 * content before the category and nearby Cards.
 */
export default function CategoryLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
