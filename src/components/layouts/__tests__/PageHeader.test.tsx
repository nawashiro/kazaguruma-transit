import { render, screen } from "@testing-library/react";
import PageHeader from "../PageHeader";

describe("PageHeader", () => {
  it("ページタイトルと説明を左揃えの共通構造で表示する", () => {
    render(
      <PageHeader
        title="ページタイトル"
        description="ページの説明"
        eyebrow="補足"
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "ページタイトル",
    });
    const header = heading.closest("header");

    expect(header).not.toHaveClass("text-center");
    expect(heading).toHaveClass("text-3xl", "font-bold");
    expect(screen.getByText("補足")).toBeInTheDocument();
    expect(screen.getByText("ページの説明")).toBeInTheDocument();
  });
});
