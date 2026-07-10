import { fireEvent, render, screen } from "@testing-library/react";
import { DiscussionReadStatus } from "@/components/discussion/DiscussionReadStatus";

describe("DiscussionReadStatus", () => {
  it("announces partial reads and reloads", () => {
    const onReload = jest.fn();
    render(<DiscussionReadStatus isLoading={false} completionReason="idle-timeout" hasData onReload={onReload} />);
    expect(screen.getByRole("status")).toHaveTextContent("表示内容は暫定です");
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("announces unavailable reads", () => {
    render(<DiscussionReadStatus isLoading={false} completionReason="hard-timeout" hasData={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("取得できませんでした");
  });

  it("announces an unknown approval state and labels its retry action", () => {
    render(<DiscussionReadStatus isLoading={false} completionReason="idle-timeout" hasData approvalState="unknown" onReload={jest.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("承認情報を確認中");
    expect(screen.getByRole("button", { name: "承認情報を再確認" })).toBeInTheDocument();
  });
});
