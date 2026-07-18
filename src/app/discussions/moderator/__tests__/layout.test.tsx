import { render, screen } from "@testing-library/react";

jest.mock("@/components/discussion/DiscussionManagementTabLayout", () => ({
  DiscussionManagementTabLayout: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,
}));
jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  DiscussionTabLayout: ({
    children,
    naddr,
  }: {
    children: React.ReactNode;
    naddr?: string;
  }) => (
    <div data-testid="discussion-tab-layout" data-naddr={naddr}>
      {children}
    </div>
  ),
}));

describe("ModeratorLayout", () => {
  const originalNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;

  afterEach(() => {
    if (originalNaddr === undefined) {
      delete process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
    } else {
      process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = originalNaddr;
    }
  });

  it("リクエスト時の会話一覧NADDRを子レイアウトへ渡す", () => {
    delete process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
    const { default: ModeratorLayout, dynamic } = jest.requireActual<
      typeof import("../layout")
    >("../layout");
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = "naddr1runtime";

    render(<ModeratorLayout>管理画面</ModeratorLayout>);

    expect(dynamic).toBe("force-dynamic");
    expect(screen.getByTestId("discussion-tab-layout")).toHaveAttribute(
      "data-naddr",
      "naddr1runtime",
    );
  });
});
