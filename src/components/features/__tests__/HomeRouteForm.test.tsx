import { fireEvent, render, screen } from "@testing-library/react";
import HomeRouteForm from "../HomeRouteForm";
import { markSearchStart, track } from "@/lib/analytics/tracking";
import type { Location } from "@/types/core";

jest.mock("@/lib/analytics/tracking", () => ({ track: jest.fn(), markSearchStart: jest.fn() }));
jest.mock("../DestinationSelector", () => function DestinationSelector({
  onDestinationSelected,
}: {
  onDestinationSelected: (location: Location) => void;
}) {
  return (
    <button type="button" onClick={() => onDestinationSelected({ lat: 35.69, lng: 139.75, address: "目的地" })}>
      目的地を選ぶ
    </button>
  );
});
jest.mock("../OriginSelector", () => function OriginSelector({
  onOriginSelected,
}: {
  onOriginSelected: (location: Location) => void;
}) {
  return (
    <button type="button" onClick={() => onOriginSelected({ lat: 35.69, lng: 139.76, address: "出発地" })}>
      出発地を選ぶ
    </button>
  );
});

const trackMock = track as jest.Mock;
const markSearchStartMock = markSearchStart as jest.Mock;

function searchForm() {
  return screen.getByRole("button", { name: "経路を検索" }).closest("form")!;
}

describe("HomeRouteForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("最新の運行情報の案内を公式バスロケーションシステムへのリンクで表示する", () => {
    const { container } = render(<HomeRouteForm routeDestinations={[]} />);

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

  it("両方の地点が未確定なら validation_failed を送り、送信を止める", () => {
    render(<HomeRouteForm routeDestinations={[]} />);

    const notCanceled = fireEvent.submit(searchForm());

    expect(notCanceled).toBe(false);
    expect(trackMock).toHaveBeenCalledWith("validation_failed", { missing: "both" });
    expect(markSearchStartMock).not.toHaveBeenCalled();
  });

  it("出発地だけ未確定なら missing=origin を送る", () => {
    render(<HomeRouteForm routeDestinations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "目的地を選ぶ" }));

    fireEvent.submit(searchForm());

    expect(trackMock).toHaveBeenCalledWith("validation_failed", { missing: "origin" });
  });

  it("両方の地点が確定していれば開始時刻を保存する", () => {
    render(<HomeRouteForm routeDestinations={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "目的地を選ぶ" }));
    fireEvent.click(screen.getByRole("button", { name: "出発地を選ぶ" }));

    fireEvent.submit(searchForm());

    expect(trackMock).not.toHaveBeenCalledWith("validation_failed", expect.anything());
    expect(markSearchStartMock).toHaveBeenCalledTimes(1);
  });
});
