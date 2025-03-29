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

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("初期状態では出発地選択コンポーネントのみが表示される", () => {
    render(<Home />);

    expect(screen.getByTestId("origin-selector")).toBeInTheDocument();
    expect(
      screen.queryByTestId("destination-selector")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
  });

  it("出発地を選択すると目的地選択コンポーネントが表示される", async () => {
    render(<Home />);

    const selectOriginButton = screen.getByTestId("select-origin-button");
    fireEvent.click(selectOriginButton);

    await waitFor(() => {
      expect(screen.getByTestId("selected-origin")).toBeInTheDocument();
      expect(screen.getByTestId("destination-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
    });
  });

  it("目的地を選択すると乗換案内検索フォームが表示される", async () => {
    render(<Home />);

    // 出発地を選択
    const selectOriginButton = screen.getByTestId("select-origin-button");
    fireEvent.click(selectOriginButton);

    // 目的地を選択
    await waitFor(() => {
      const selectDestinationButton = screen.getByTestId(
        "select-destination-button"
      );
      fireEvent.click(selectDestinationButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-origin")).toBeInTheDocument();
      expect(screen.getByTestId("selected-destination")).toBeInTheDocument();
      expect(screen.getByTestId("transit-form")).toBeInTheDocument();
    });
  });

  it("出発地変更ボタンをクリックすると出発地選択に戻る", async () => {
    render(<Home />);

    // 出発地を選択
    const selectOriginButton = screen.getByTestId("select-origin-button");
    fireEvent.click(selectOriginButton);

    // 目的地を選択
    await waitFor(() => {
      const selectDestinationButton = screen.getByTestId(
        "select-destination-button"
      );
      fireEvent.click(selectDestinationButton);
    });

    // 出発地変更ボタンをクリック
    await waitFor(() => {
      const changeOriginButton = screen.getByTestId("change-origin");
      fireEvent.click(changeOriginButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("origin-selector")).toBeInTheDocument();
      expect(
        screen.queryByTestId("destination-selector")
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
    });
  });

  it("目的地変更ボタンをクリックすると目的地選択に戻る", async () => {
    render(<Home />);

    // 出発地を選択
    const selectOriginButton = screen.getByTestId("select-origin-button");
    fireEvent.click(selectOriginButton);

    // 目的地を選択
    await waitFor(() => {
      const selectDestinationButton = screen.getByTestId(
        "select-destination-button"
      );
      fireEvent.click(selectDestinationButton);
    });

    // 目的地変更ボタンをクリック
    await waitFor(() => {
      const changeDestinationButton = screen.getByTestId("change-destination");
      fireEvent.click(changeDestinationButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-origin")).toBeInTheDocument();
      expect(screen.getByTestId("destination-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("transit-form")).not.toBeInTheDocument();
    });
  });
});
