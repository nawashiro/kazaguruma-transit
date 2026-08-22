"use client";

import React from "react";

export {
  useDiscussionManagementData,
} from "@/components/discussion/DiscussionDataProvider";
export type {
  DiscussionManagementState,
} from "@/components/discussion/DiscussionDataProvider";

/** Compatibility adapter; the shared route provider owns management reads. */
export function DiscussionManagementDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
