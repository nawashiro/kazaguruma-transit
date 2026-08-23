"use client";

import React from "react";

export { useDiscussionContentData } from "@/components/discussion/DiscussionDataProvider";
export type { DiscussionContentState } from "@/components/discussion/DiscussionDataProvider";

/** Compatibility adapter; the shared route provider owns all content reads. */
export function DiscussionContentDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
