import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiscussionManagementTabLayout } from "../DiscussionManagementTabLayout";

const usePathname = jest.fn(() => "/discussions/manage");

jest.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("DiscussionManagementTabLayout", () => {
  it("renders the shared management tabs as a tabs-box", () => {
    render(
      <DiscussionManagementTabLayout>
        <div>content</div>
      </DiscussionManagementTabLayout>,
    );

    expect(screen.getByRole("tablist")).toHaveClass("tabs", "tabs-box");
    expect(screen.getByRole("tab", { name: "会話一覧" })).toHaveAttribute(
      "href",
      "/discussions",
    );
    expect(screen.getByRole("tab", { name: "掲載依頼" })).toHaveAttribute(
      "href",
      "/discussions/manage",
    );
    expect(screen.getByRole("tab", { name: "モデレーター" })).toHaveAttribute(
      "href",
      "/discussions/moderator",
    );
    expect(screen.getByRole("heading", { level: 1, name: "意見交換" })).toBeInTheDocument();
    expect(
      screen.getByText("意見交換を行うために自由に利用していい場所です。誰でも新しい会話を作成できます。"),
    ).toBeInTheDocument();
  });

  it("marks the current management route active", () => {
    usePathname.mockReturnValue("/discussions/moderator");
    render(<DiscussionManagementTabLayout><div /></DiscussionManagementTabLayout>);

    expect(screen.getByRole("tab", { name: "モデレーター" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
