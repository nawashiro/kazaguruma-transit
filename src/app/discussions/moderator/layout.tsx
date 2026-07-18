import { DiscussionManagementTabLayout } from "@/components/discussion/DiscussionManagementTabLayout";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";

export const dynamic = "force-dynamic";

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;

  return (
    <DiscussionManagementTabLayout>
      <DiscussionTabLayout
        baseHref="/discussions/moderator"
        naddr={discussionListNaddr}
        showNavigation={false}
      >
        {children}
      </DiscussionTabLayout>
    </DiscussionManagementTabLayout>
  );
}
