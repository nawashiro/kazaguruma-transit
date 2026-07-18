import { DiscussionManagementTabLayout } from "@/components/discussion/DiscussionManagementTabLayout";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";

const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DiscussionTabLayout
      baseHref="/discussions/moderator"
      naddr={discussionListNaddr}
      showNavigation={false}
    >
      <DiscussionManagementTabLayout>
        {children}
      </DiscussionManagementTabLayout>
    </DiscussionTabLayout>
  );
}
