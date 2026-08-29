import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiscussionMetaReadState } from "../DiscussionMetaReadState";
import type { Discussion } from "@/types/discussion";

const knownDiscussion: Discussion = {
  id: "34550:" + "a".repeat(64) + ":test-discussion",
  dTag: "test-discussion",
  title: "テスト会話",
  description: "説明",
  moderators: [],
  authorPubkey: "a".repeat(64),
  createdAt: 1,
  event: {
    id: "1".repeat(64),
    kind: 34550,
    pubkey: "a".repeat(64),
    created_at: 1,
    tags: [
      ["d", "test-discussion"],
      ["name", "テスト会話"],
      ["description", "説明"],
    ],
    content: "説明",
    sig: "2".repeat(128),
  },
};

describe("DiscussionMetaReadState", () => {
  it("会話情報の読み込み中は汎用見出しを描画せず読み込み状態を保つ", () => {
    render(
      <DiscussionMetaReadState
        discussion={null}
        isLoading
        error={null}
        completionReason={null}
        onReload={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("heading", { level: 1, name: "会話情報" }),
    ).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("読み込み中");
    const message = status.querySelector<HTMLElement>(":scope > p.ruby-text");
    expect(message).not.toBeNull();
    if (!message) throw new Error("loading message paragraph was not rendered");
    expect(message).toHaveTextContent("会話情報を読み込み中");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("ready状態ではtitleとdescriptionを表示する", () => {
    render(
      <DiscussionMetaReadState
        discussion={knownDiscussion}
        isLoading={false}
        error={null}
        completionReason="eose"
        onReload={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "テスト会話" }),
    ).toBeInTheDocument();
    expect(screen.getByText("説明", { selector: "p" })).toBeInTheDocument();
  });

  it("エラー時は汎用見出しを描画せず再試行をアクセシブルに表示する", () => {
    const onReload = jest.fn();
    render(
      <DiscussionMetaReadState
        discussion={null}
        isLoading={false}
        error="会話データの取得に失敗しました"
        completionReason={null}
        onReload={onReload}
      />,
    );

    expect(
      screen.queryByRole("heading", { level: 1, name: "会話情報" }),
    ).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("取得に失敗");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("部分取得時は汎用見出しを描画せず再読み込み付きのsoftなstatusとして表示する", () => {
    const onReload = jest.fn();
    render(
      <DiscussionMetaReadState
        discussion={null}
        isLoading={false}
        error={null}
        completionReason="idle-timeout"
        onReload={onReload}
      />,
    );

    expect(
      screen.queryByRole("heading", { level: 1, name: "会話情報" }),
    ).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("表示内容は暫定です");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });
});
