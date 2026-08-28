"use client";

import { usePathname } from "next/navigation";
import { DiscussionManagementProvider } from "./DiscussionManagementProvider";
import { DiscussionManagementTabLayout } from "./DiscussionManagementTabLayout";

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
    <DiscussionManagementProvider discussionListNaddr={discussionListNaddr}>
      <DiscussionManagementTabLayout renderLayout={pathname === "/discussions"}>
        {children}
      </DiscussionManagementTabLayout>
    </DiscussionManagementProvider>
  );
}
