import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiscussionMetaReadState } from "../DiscussionMetaReadState";

describe("DiscussionMetaReadState", () => {
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

    expect(screen.getByRole("alert")).toHaveTextContent("取得に失敗");
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });
});
