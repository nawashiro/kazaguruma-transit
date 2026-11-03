import { render, screen } from "@testing-library/react";
import HomeRouteForm from "../HomeRouteForm";

jest.mock("../DestinationSelector");
jest.mock("../OriginSelector");

describe("HomeRouteForm", () => {
  it("最新の運行情報の案内を公式バスロケーションシステムへのリンクで表示する", () => {
    const { container } = render(<HomeRouteForm popularCategories={[]} />);

    const link = screen.getByRole("link", {
      name: "最新の運行情報はこちら【千代田区公式】",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://kazaguruma.bus-go.com/sp/sp-busgo.php",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");

    expect(screen.queryByText("千代田区公式LINE")).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="https://lin.ee/"]')).toBeNull();
  });
});
