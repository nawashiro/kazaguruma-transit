import { fireEvent, render, screen } from "@testing-library/react";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";

describe("DiscussionReadStatus", () => {
  it("announces loading without showing a not-found message", () => {
    render(<DiscussionReadStatus isLoading completionReason={null} hasData={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("会話データを読み込み中");
    expect(screen.queryByText("会話が見つかりません")).not.toBeInTheDocument();
  });

  it("announces partial reads and reloads", () => {
    const onReload = jest.fn();
    render(<DiscussionReadStatus isLoading={false} completionReason="idle-timeout" hasData onReload={onReload} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("表示内容は暫定です");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("announces unavailable reads", () => {
    render(<DiscussionReadStatus isLoading={false} completionReason="hard-timeout" hasData={false} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("取得できませんでした");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
  });

  it("announces an unknown approval state and labels its retry action", () => {
    render(<DiscussionReadStatus isLoading={false} completionReason="idle-timeout" hasData approvalState="unknown" onReload={jest.fn()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("承認情報を確認中");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass(
      "alert",
      "alert-warning",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.getByRole("button", { name: "承認情報を再確認" })).toBeInTheDocument();
  });
});
