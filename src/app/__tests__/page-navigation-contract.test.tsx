import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";
import { buildRouteResultsUrl } from "@/lib/transit/route-search-query";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/components/features/LocationSuggestions", () =>
  function MockLocationSuggestions() {
    return null;
  },
);

describe("Home navigation contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("座標形式の目的地ディープリンクを読み込み、条件をURLから消さない", () => {
    const search = "?destination=35.7%2C139.78";
    window.history.replaceState({}, "", `/${search}`);

    render(<Home />);

    expect(window.location.search).toBe(search);
    expect(screen.queryByText(/35\.7/)).not.toBeNull();
    expect(screen.queryByText(/139\.78/)).not.toBeNull();
  });

  it("旧JSON形式の目的地を復元せず、URLの他条件をそのまま保持する", () => {
    const legacyDestination = encodeURIComponent(
      JSON.stringify({ lat: 35.7, lng: 139.78, address: "旧形式の目的地" }),
    );
    const search = `?destination=${legacyDestination}&time=2026-07-18T09%3A30`;
    window.history.replaceState({}, "", `/${search}`);

    render(<Home />);

    expect(window.location.search).toBe(search);
    expect(screen.queryByText("旧形式の目的地")).toBeNull();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("全条件URLの送信は結果URLを一度だけrouter.pushへ渡す", async () => {
    const query = {
      origin: { lat: 35.68, lng: 139.76 },
      destination: { lat: 35.7, lng: 139.78 },
      time: "2026-07-18T09:30",
      isDeparture: true,
      prioritizeSpeed: false,
    };
    const resultUrl = buildRouteResultsUrl(query);
    window.history.replaceState({}, "", `/?${resultUrl.split("?")[1]}`);

    render(<Home />);
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    if (!form) return;

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith(resultUrl);
  });
});
