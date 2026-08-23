import React from "react";
import { render, screen } from "@testing-library/react";
import {
  DiscussionManagementDataProvider,
  useDiscussionManagementData,
} from "../DiscussionManagementDataProvider";

const sharedManagement = {
  posts: [],
  approvals: [],
  referencedDiscussions: [],
  isModerationLoading: false,
  isReferencedDiscussionsLoading: false,
  referencedDiscussionCompletionReason: "eose" as const,
  moderationError: null,
  completionReason: "eose" as const,
  approvalState: "unapproved" as const,
  isLoading: false,
  error: null,
  reload: jest.fn(),
  reloadModeration: jest.fn(),
  mergeModerationEvents: jest.fn(),
  addPost: jest.fn(),
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
  removeManagementApproval: jest.fn(),
};

jest.mock("@/components/discussion/DiscussionDataProvider", () => ({
  useDiscussionManagementData: () => sharedManagement,
}));

jest.mock("@/lib/discussion/discussion-read-executor", () => ({
  executeDiscussionRead: jest.fn(),
}));

const { executeDiscussionRead } = jest.requireMock(
  "@/lib/discussion/discussion-read-executor",
) as { executeDiscussionRead: jest.Mock };

function Probe() {
  const management = useDiscussionManagementData();
  return <span>{`posts:${management.posts.length}`}</span>;
}

describe("DiscussionManagementDataProvider adapter", () => {
  it("exposes shared management state without starting its own read", () => {
    render(
      <DiscussionManagementDataProvider>
        <Probe />
      </DiscussionManagementDataProvider>,
    );

    expect(screen.getByText("posts:0")).toBeInTheDocument();
    expect(executeDiscussionRead).not.toHaveBeenCalled();
  });
});
