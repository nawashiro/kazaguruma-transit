"use client";

import { usePathname } from "next/navigation";
import { DiscussionManagementDataProvider } from "@/components/discussion/DiscussionManagementDataProvider";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";

const MANAGEMENT_PATHS = new Set([
  "/discussions",
  "/discussions/manage",
  "/discussions/moderator",
]);

export function DiscussionManagementShell({
  children,
  discussionListNaddr,
}: {
  children: React.ReactNode;
  discussionListNaddr?: string;
}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  if (!MANAGEMENT_PATHS.has(pathname)) return children;

  return (
    <DiscussionTabLayout
      baseHref="/discussions"
      naddr={discussionListNaddr}
      showNavigation={false}
    >
      <DiscussionManagementDataProvider>
        {children}
      </DiscussionManagementDataProvider>
    </DiscussionTabLayout>
  );
}
