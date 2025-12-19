import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EvaluationComponent } from "../EvaluationComponent";
import type { PostWithStats } from "@/types/discussion";
import type { Event } from "nostr-tools";
import { shuffleArray } from "@/lib/nostr/nostr-utils";

jest.mock("@/lib/nostr/nostr-utils", () => ({
  shuffleArray: jest.fn((array: string[]) => [...array].reverse()),
  filterUnevaluatedPosts: jest.fn((posts: PostWithStats[]) => posts),
}));

const baseEvent: Event = {
  id: "event-1",
  pubkey: "author",
  kind: 1,
  created_at: 123,
  tags: [],
  content: "content",
  sig: "sig",
};

const createPost = (
  id: string,
  content: string,
  positive = 0
): PostWithStats => ({
  id,
  content,
  authorPubkey: "author",
  discussionId: "discussion",
  createdAt: 123,
  approved: true,
  event: baseEvent,
  evaluationStats: {
    positive,
    negative: 0,
    total: positive,
    score: 0,
  },
});

describe("EvaluationComponent", () => {
  it("keeps randomized order when post ids stay the same", () => {
    const posts = [
      createPost("post-1", "Post 1"),
      createPost("post-2", "Post 2"),
      createPost("post-3", "Post 3"),
    ];

    const { rerender } = render(
      <EvaluationComponent
        posts={posts}
        onEvaluate={jest.fn().mockResolvedValue(undefined)}
        userEvaluations={new Set()}
        isRandomOrder
      />
    );

    expect(shuffleArray).toHaveBeenCalledTimes(1);

    const updatedPosts = posts.map((post, index) => ({
      ...post,
      evaluationStats: {
        ...post.evaluationStats,
        positive: index + 1,
        total: index + 1,
      },
    }));

    rerender(
      <EvaluationComponent
        posts={updatedPosts}
        onEvaluate={jest.fn().mockResolvedValue(undefined)}
        userEvaluations={new Set()}
        isRandomOrder
      />
    );

    expect(shuffleArray).toHaveBeenCalledTimes(1);
  });
});
