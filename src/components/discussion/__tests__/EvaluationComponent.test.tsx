import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EvaluationComponent } from "../EvaluationComponent";
import type { PostWithStats } from "@/types/discussion";

const buildPost = (overrides: Partial<PostWithStats>): PostWithStats => ({
  id: "post-1",
  content: "approved post",
  authorPubkey: "author",
  discussionId: "34550:author:demo",
  createdAt: 100,
  approved: true,
  event: {
    id: "event-1",
    kind: 1111,
    pubkey: "author",
    created_at: 100,
    tags: [["a", "34550:author:demo"]],
    content: "approved post",
    sig: "sig",
  },
  evaluationStats: {
    positive: 0,
    negative: 0,
    total: 0,
    score: 0,
  },
  ...overrides,
});

describe("EvaluationComponent", () => {
  it("shows only approved posts for evaluation", () => {
    const approved = buildPost({ id: "approved", content: "approved text" });
    const unapproved = buildPost({
      id: "pending",
      content: "pending text",
      approved: false,
    });

    render(
      <EvaluationComponent
        posts={[approved, unapproved]}
        onEvaluate={async () => undefined}
        userEvaluations={new Set()}
      />
    );

    expect(screen.getByText("approved text")).toBeInTheDocument();
    expect(screen.queryByText("pending text")).not.toBeInTheDocument();
  });

  it("submits NIP-25 style rating callback for approved post", async () => {
    const onEvaluate = jest.fn(async () => undefined);
    const approved = buildPost({ id: "approved", content: "approved text" });

    render(
      <EvaluationComponent
        posts={[approved]}
        onEvaluate={onEvaluate}
        userEvaluations={new Set()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "この投稿に賛成" }));
    });
    expect(onEvaluate).toHaveBeenCalledWith("approved", "+");
  });
});
