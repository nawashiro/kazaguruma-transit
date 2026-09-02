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
      fireEvent.click(screen.getByRole("button", { name: "はい" }));
    });
    expect(onEvaluate).toHaveBeenCalledWith("approved", "+");
  });

  it("keeps approval-unknown posts out of evaluation until state is resolved", () => {
    const unknown = buildPost({ id: "unknown", content: "checking", approvalState: "unknown" });
    const view = render(<EvaluationComponent posts={[unknown]} onEvaluate={async () => undefined} userEvaluations={new Set()} />);
    expect(screen.getByText("評価可能な投稿がありません")).toBeInTheDocument();
    expect(screen.queryByText("checking")).not.toBeInTheDocument();

    view.rerender(
      <EvaluationComponent
        posts={[{ ...unknown, approved: true, approvalState: "approved" }]}
        onEvaluate={async () => undefined}
        userEvaluations={new Set()}
      />
    );
    expect(screen.getByText("checking")).toBeInTheDocument();
  });

  it("既定の評価タイトルを妥当性を尋ねる文言で表示する", () => {
    render(
      <EvaluationComponent
        posts={[buildPost({})]}
        onEvaluate={async () => undefined}
        userEvaluations={new Set()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "この論点は妥当だと思いますか？" }),
    ).toBeInTheDocument();
  });

  it("評価タイトルの過剰な補足文を表示しない", () => {
    render(
      <EvaluationComponent
        posts={[buildPost({})]}
        onEvaluate={async () => undefined}
        userEvaluations={new Set()}
      />,
    );

    expect(
      screen.queryByText(
        "論点が妥当だと思う、賛成できるなどの投稿は「はい」を押してください。",
      ),
    ).not.toBeInTheDocument();
  });

  it("評価本文の段落にtext-balanceを付与しない", () => {
    render(
      <EvaluationComponent
        posts={[buildPost({ content: "本文の確認" })]}
        onEvaluate={async () => undefined}
        userEvaluations={new Set()}
      />,
    );

    expect(screen.getByText("本文の確認")).not.toHaveClass("text-balance");
  });

  it("投稿カードの外側で評価ボタンをprogressの前に表示する", () => {
    render(
      <EvaluationComponent
        posts={[buildPost({})]}
        onEvaluate={async () => undefined}
        userEvaluations={new Set()}
      />,
    );

    const article = screen.getByRole("article");
    const evaluationGroup = screen.getByRole("group", { name: "投稿の評価" });
    const progress = screen.getByRole("progressbar");

    expect(article).not.toContainElement(evaluationGroup);
    expect(article.compareDocumentPosition(evaluationGroup)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(evaluationGroup.compareDocumentPosition(progress)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("評価進捗のARIAラベルからコロンを除く", () => {
    render(
      <EvaluationComponent
        posts={[buildPost({})]}
        onEvaluate={async () => undefined}
        userEvaluations={new Set()}
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-label",
      "評価進捗 0%完了",
    );
  });
});
