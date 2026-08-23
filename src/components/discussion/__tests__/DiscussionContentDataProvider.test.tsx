import React from "react";
import { render, screen } from "@testing-library/react";
import {
  DiscussionContentDataProvider,
  useDiscussionContentData,
} from "../DiscussionContentDataProvider";

const sharedContent = {
  posts: [],
  approvals: [],
  isLoading: false,
  error: null,
  completionReason: "eose" as const,
  approvalState: "unapproved" as const,
  reload: jest.fn(),
  mergeModerationEvents: jest.fn(),
  addPost: jest.fn(),
  addApproval: jest.fn(),
  removeApproval: jest.fn(),
};

jest.mock("@/components/discussion/DiscussionDataProvider", () => ({
  useDiscussionContentData: () => sharedContent,
}));

jest.mock("@/lib/nostr/nostr-read-executor", () => ({
  executeNostrRead: jest.fn(),
}));

const { executeNostrRead } = jest.requireMock(
  "@/lib/nostr/nostr-read-executor",
) as { executeNostrRead: jest.Mock };

function Probe() {
  const content = useDiscussionContentData();
  return <span>{`posts:${content.posts.length}`}</span>;
}

describe("DiscussionContentDataProvider adapter", () => {
  it("exposes shared content state without starting its own read", () => {
    render(
      <DiscussionContentDataProvider>
        <Probe />
      </DiscussionContentDataProvider>,
    );

    expect(screen.getByText("posts:0")).toBeInTheDocument();
    expect(executeNostrRead).not.toHaveBeenCalled();
  });
});
