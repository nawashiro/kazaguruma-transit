import { render, screen } from "@testing-library/react";
import HomeRouteForm from "../HomeRouteForm";

jest.mock("../Announcement", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../DateTimeSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="date-time-selector" />,
}));
jest.mock("../DestinationSelector", () => ({
  __esModule: true,
  default: ({ validationError }: { validationError?: string }) => (
    <div data-testid="destination-selector">目的地{validationError ?? ""}</div>
  ),
}));
jest.mock("../OriginSelector", () => ({
  __esModule: true,
  default: ({ validationError }: { validationError?: string }) => (
    <div data-testid="origin-selector">出発地{validationError ?? ""}</div>
  ),
}));

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
