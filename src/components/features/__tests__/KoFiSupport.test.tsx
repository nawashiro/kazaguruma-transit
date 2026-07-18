import { render, screen } from "@testing-library/react";
import KoFiSupport from "../KoFiSupport";

const content = {
  heading: "開発者を支援する",
  message: "継続的な支援をお願いします。",
};

describe("KoFiSupport", () => {
  it("説明文の直後にKo-fiの支援フォームを表示する", () => {
    render(<KoFiSupport username="nawashiro" content={content} />);

    const heading = screen.getByRole("heading", {
      name: "開発者を支援する",
    });
    const message = screen.getByText("継続的な支援をお願いします。");
    const iframe = screen.getByTitle("開発者を支援する（Ko-fi）");

    expect(heading).toBeInTheDocument();
    expect(message.compareDocumentPosition(iframe)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(iframe).toHaveAttribute(
      "src",
      "https://ko-fi.com/nawashiro/?hidefeed=true&widget=true&embed=true&preview=true",
    );
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe.closest("section")).toHaveClass("w-full");
    expect(iframe.closest("section")).not.toHaveClass("max-w-3xl", "mx-auto");
  });
});
