import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";

// モックのfetch API
global.fetch = jest.fn();

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

interface MockResponse {
  json: () => Promise<any>;
  ok: boolean;
  status: number;
}

const mockResponse: MockResponse = {
  json: async () => ({ routes: [] }),
  ok: true,
  status: 200,
};

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
});
