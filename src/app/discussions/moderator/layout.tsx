import { DiscussionManagementTabLayout } from "@/components/discussion/DiscussionManagementTabLayout";

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DiscussionManagementTabLayout>
      {children}
    </DiscussionManagementTabLayout>
  );
}
