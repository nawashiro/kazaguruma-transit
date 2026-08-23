"use client";

import { usePathname } from "next/navigation";
import { DiscussionManagementProvider } from "./DiscussionManagementProvider";
import { DiscussionManagementDataProvider } from "@/components/discussion/DiscussionManagementDataProvider";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";
import { DiscussionDataProvider } from "@/components/discussion/DiscussionDataProvider";

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
    <DiscussionDataProvider
      discussionListNaddr={discussionListNaddr}
      scope="management"
      read={false}
    >
      <DiscussionManagementProvider discussionListNaddr={discussionListNaddr}>
        <DiscussionTabLayout
          baseHref="/discussions"
          naddr={discussionListNaddr}
          showNavigation={false}
        >
          <DiscussionManagementDataProvider>
            {children}
          </DiscussionManagementDataProvider>
        </DiscussionTabLayout>
      </DiscussionManagementProvider>
    </DiscussionDataProvider>
  );
}
