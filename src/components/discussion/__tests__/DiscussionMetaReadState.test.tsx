import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiscussionMetaReadState } from "../DiscussionMetaReadState";

describe("DiscussionMetaReadState", () => {
  it("会話情報の読み込み中もページ見出しを保つ", () => {
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
      screen.getByRole("heading", { level: 1, name: "会話情報" }),
    ).toBeInTheDocument();
  });

  it("known dataを表示しながら取得状態を示す", () => {
    render(
      <DiscussionMetaReadState
        discussion={{ title: "テスト会話", description: "説明", authorPubkey: "a", createdAt: 1, dTag: "d", moderators: [] } as never}
        isLoading
        error={null}
        completionReason={null}
        onReload={jest.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(screen.getByText("テスト会話")).toBeInTheDocument();
  });

  it("エラーと再試行をアクセシブルに表示する", () => {
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
      screen.getByRole("heading", { level: 1, name: "会話情報" }),
    ).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("取得に失敗");
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("部分取得警告を再読み込み付きのsoftなstatusとして表示する", () => {
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
