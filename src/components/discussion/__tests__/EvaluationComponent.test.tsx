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

interface EvaluationHarnessProps {
  posts: PostWithStats[];
  onEvaluate: (postId: string, rating: "+" | "-") => Promise<void>;
}

function EvaluationHarness({ posts, onEvaluate }: EvaluationHarnessProps) {
  const [evaluatedPostIds, setEvaluatedPostIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  const handleEvaluate = async (postId: string, rating: "+" | "-") => {
    await onEvaluate(postId, rating);
    setEvaluatedPostIds((previous) => {
      const next = new Set(previous);
      next.add(postId);
      return next;
    });
  };

  return (
    <EvaluationComponent
      posts={posts}
      onEvaluate={handleEvaluate}
      userEvaluations={evaluatedPostIds}
    />
  );
}

/** Reproduce Rubyful v2's textContent -> innerHTML DOM ownership transfer. */
function replaceRubyfulText(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>(".ruby-text").forEach((element) => {
    const text = element.textContent || "";
    element.innerHTML = `<ruby>${text}</ruby>`;
  });
}

function getDirectRubyTextLabels(button: HTMLElement) {
  return Array.from(button.children).filter(
    (child) => child.tagName === "SPAN" && child.classList.contains("ruby-text"),
  );
}

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

  it("Rubyfulの外部innerHTML置換後も評価成功時に次の投稿へ切り替わる", async () => {
    const firstPost = buildPost({ id: "first", content: "最初の投稿" });
    const secondPost = buildPost({ id: "second", content: "次の投稿" });
    let resolveEvaluation!: () => void;
    const evaluationFinished = new Promise<void>((resolve) => {
      resolveEvaluation = resolve;
    });
    const onEvaluate = jest.fn(async () => evaluationFinished);

    const view = render(
      <EvaluationHarness
        posts={[firstPost, secondPost]}
        onEvaluate={onEvaluate}
      />,
    );

    replaceRubyfulText(view.container);

    const yesButton = screen.getByRole("button", { name: "はい" });
    const noButton = screen.getByRole("button", { name: "いいえ" });

    let clickError: unknown;
    try {
      fireEvent.click(yesButton);
    } catch (error) {
      clickError = error;
    }
    const clickErrors =
      clickError instanceof AggregateError
        ? clickError.errors
        : clickError
          ? [clickError]
          : [];
    expect(clickErrors).toEqual([]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(onEvaluate).toHaveBeenCalledWith("first", "+");
    expect(yesButton).toBeDisabled();
    expect(noButton).toBeDisabled();
    expect(yesButton).toHaveClass("loading");
    expect(noButton).toHaveClass("loading");
    expect(yesButton).not.toHaveClass("ruby-text");
    expect(noButton).not.toHaveClass("ruby-text");
    expect(getDirectRubyTextLabels(yesButton)).toHaveLength(1);
    expect(getDirectRubyTextLabels(noButton)).toHaveLength(1);

    await act(async () => {
      resolveEvaluation();
      await evaluationFinished;
    });

    expect(screen.getByText("次の投稿")).toBeInTheDocument();
    expect(screen.queryByText("最初の投稿")).not.toBeInTheDocument();

    const currentArticle = screen.getByRole("article");
    const currentParagraph = currentArticle.querySelector("p");
    expect(currentParagraph).not.toBeNull();
    expect(currentParagraph).not.toHaveClass("ruby-text");

    screen.getAllByRole("button").forEach((button) => {
      expect(button).not.toHaveClass("ruby-text");
      expect(getDirectRubyTextLabels(button)).toHaveLength(1);
    });
  });
});
