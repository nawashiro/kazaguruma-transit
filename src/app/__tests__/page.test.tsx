import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";

// モックのfetch API
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

jest.mock("../../components/OriginSelector", () => {
  return function MockOriginSelector({ onOriginSelected }: any) {
    return (
      <div data-testid="origin-selector">
        <button
          data-testid="select-origin-button"
          onClick={() =>
            onOriginSelected({
              lat: 35.6812362,
              lng: 139.7671248,
              address: "東京都千代田区丸の内１丁目",
            })
          }
        >
          出発地を選択
        </button>
      </div>
    );
  };
});

jest.mock("../../components/DestinationSelector", () => {
  return function MockDestinationSelector({ onDestinationSelected }: any) {
    return (
      <div data-testid="destination-selector">
        <button
          data-testid="select-destination-button"
          onClick={() =>
            onDestinationSelected({
              lat: 35.6895,
              lng: 139.6917,
              address: "東京都千代田区霞が関１丁目",
            })
          }
        >
          目的地を選択
        </button>
      </div>
    );
  };
});

// TransitFormのモックを試みる
try {
  jest.mock("../../components/TransitForm", () => {
    return function MockTransitForm({ onSubmit }: any) {
      return (
        <div data-testid="transit-form">
          <button
            data-testid="submit-transit-form"
            onClick={() => onSubmit({ stopId: "stop1", routeId: "route1" })}
          >
            検索
          </button>
        </div>
      );
    };
  });
} catch (error) {
  console.warn("TransitFormのモックをスキップします:", error);
}

// NearestStopFinderのモック
jest.mock("../../components/NearestStopFinder", () => {
  return function MockNearestStopFinder({ userLocation, onStopSelected }: any) {
    return (
      <div data-testid="nearest-stop-finder">
        <button
          data-testid="select-nearest-stop-button"
          onClick={() =>
            onStopSelected({
              stop_id: "nearest-stop",
              stop_name: "最寄りバス停",
              distance: 0.5,
            })
          }
        >
          最寄りのバス停を選択
        </button>
      </div>
    );
  };
});

// DateTimeSelectorのモック
jest.mock("../../components/DateTimeSelector", () => {
  return function MockDateTimeSelector({ initialStopId, onSubmit }: any) {
    return (
      <div data-testid="datetime-selector">
        <button
          data-testid="search-button"
          onClick={() =>
            onSubmit({
              stopId: initialStopId,
              dateTime: "2023-11-01T09:00",
              isDeparture: true,
            })
          }
        >
          検索
        </button>
      </div>
    );
  };
});

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("初期状態では目的地選択コンポーネントのみが表示される", () => {
    render(<Home />);

    expect(screen.getByTestId("destination-selector")).toBeInTheDocument();
    expect(screen.queryByTestId("origin-selector")).not.toBeInTheDocument();
    expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
  });

  it("目的地を選択すると出発地選択コンポーネントが表示される", async () => {
    render(<Home />);

    const selectDestinationButton = screen.getByTestId(
      "select-destination-button"
    );
    fireEvent.click(selectDestinationButton);

    await waitFor(() => {
      expect(screen.getByTestId("selected-destination")).toBeInTheDocument();
      expect(screen.getByTestId("origin-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
    });
  });

  it("リセットボタンをクリックすると初期状態に戻る", async () => {
    render(<Home />);

    // 目的地を選択
    const selectDestinationButton = screen.getByTestId(
      "select-destination-button"
    );
    fireEvent.click(selectDestinationButton);

    // 出発地を選択
    await waitFor(() => {
      const selectOriginButton = screen.getByTestId("select-origin-button");
      fireEvent.click(selectOriginButton);
    });

    // リセットボタンをクリック
    await waitFor(() => {
      const resetButton = screen.getByTestId("reset-search");
      fireEvent.click(resetButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("destination-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("origin-selector")).not.toBeInTheDocument();
      expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
    });
  });

  it("出発地変更ボタンをクリックすると出発地選択に戻る", async () => {
    render(<Home />);

    // 目的地を選択
    const selectDestinationButton = screen.getByTestId(
      "select-destination-button"
    );
    fireEvent.click(selectDestinationButton);

    // 出発地を選択
    await waitFor(() => {
      const selectOriginButton = screen.getByTestId("select-origin-button");
      fireEvent.click(selectOriginButton);
    });

    // 出発地変更ボタンをクリック
    await waitFor(() => {
      const changeOriginButton = screen.getByTestId("change-origin");
      fireEvent.click(changeOriginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-destination")).toBeInTheDocument();
      expect(screen.getByTestId("origin-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
    });
  });

  it.skip("出発地選択後に最寄りバス停検索が表示され、選択するとDateTimeSelectorに切り替わる", async () => {
    render(<Home />);

    // 目的地を選択
    const selectDestinationButton = screen.getByTestId(
      "select-destination-button"
    );
    fireEvent.click(selectDestinationButton);

    // 出発地を選択
    await waitFor(() => {
      const selectOriginButton = screen.getByTestId("select-origin-button");
      fireEvent.click(selectOriginButton);
    });

    // 最寄りバス停検索コンポーネントが表示される
    await waitFor(() => {
      expect(screen.getByTestId("nearest-stop-finder")).toBeInTheDocument();
    });

    // 最寄りバス停を選択
    const selectNearestStopButton = screen.getByTestId(
      "select-nearest-stop-button"
    );
    fireEvent.click(selectNearestStopButton);

    // DateTimeSelectorが表示されることを確認
    await waitFor(() => {
      // nearest-stop-finderが表示されなくなる
      expect(
        screen.queryByTestId("nearest-stop-finder")
      ).not.toBeInTheDocument();
      // DateTimeSelectorが表示される
      expect(screen.getByTestId("datetime-selector")).toBeInTheDocument();
    });
  });
});
