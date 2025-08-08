/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";

// モックデータの定義
const mockData = {
  success: true,
  data: {
    journeys: [],
    stops: [],
  },
};

// モックのfetch API
global.fetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockData),
  });
});

// コンポーネントのモック
jest.mock(
  "@/components/features/DateTimeSelector",
  () =>
    ({ onDateTimeSelected }: any) =>
      (
        <div
          data-testid="mock-date-time-selector"
          onClick={() =>
            onDateTimeSelected({
              dateTime: "2023-11-01T09:00",
              isDeparture: true,
            })
          }
        />
      )
);

jest.mock(
  "@/components/features/OriginSelector",
  () =>
    ({ onOriginSelected }: any) =>
      (
        <div
          data-testid="mock-origin-selector"
          onClick={() =>
            onOriginSelected({ lat: 35.68, lng: 139.76, address: "テスト住所" })
          }
        />
      )
);

jest.mock(
  "@/components/features/DestinationSelector",
  () =>
    ({ onDestinationSelected }: any) =>
      (
        <div
          data-testid="mock-destination-selector"
          onClick={() =>
            onDestinationSelected({
              lat: 35.7,
              lng: 139.78,
              address: "テスト目的地",
            })
          }
        />
      )
);

jest.mock("@/components/features/IntegratedRouteDisplay", () => () => (
  <div data-testid="mock-route-display" />
));

jest.mock("@/components/features/RoutePdfExport", () => () => (
  <div data-testid="mock-pdf-export" />
));

jest.mock(
  "@/components/ui/Button",
  () =>
    ({ children, onClick, testId }: any) =>
      (
        <button data-testid={testId || "mock-button"} onClick={onClick}>
          {children}
        </button>
      )
);

jest.mock("@/components/ui/ResetButton", () => ({ onReset }: any) => (
  <button data-testid="mock-reset-button" onClick={onReset}>
    リセット
  </button>
));

jest.mock(
  "@/components/features/RateLimitModal",
  () =>
    ({ isOpen }: any) =>
      isOpen ? <div data-testid="mock-rate-limit-modal" /> : null
);

// 初心者ガイド関連のコンポーネントもモック
jest.mock("@/components/features/FirstVisitGuideModal", () => () => (
  <div data-testid="mock-first-visit-modal">初回訪問ガイドモーダル</div>
));

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("初期状態では目的地選択コンポーネントが表示される", () => {
    render(<Home />);

    // 初期表示では目的地選択コンポーネントが表示される
    expect(screen.getByTestId("mock-destination-selector")).toBeInTheDocument();
    // 出発地選択コンポーネントは表示されない
    expect(
      screen.queryByTestId("mock-origin-selector")
    ).not.toBeInTheDocument();
  });

  test("目的地を選択すると出発地選択コンポーネントが表示される", async () => {
    render(<Home />);

    // 目的地を選択
    const destinationSelector = screen.getByTestId("mock-destination-selector");
    fireEvent.click(destinationSelector);

    // 目的地選択後は出発地選択コンポーネントが表示される
    expect(screen.getByTestId("mock-origin-selector")).toBeInTheDocument();
    // 目的地情報も表示される
    expect(screen.getByText(/テスト目的地/)).toBeInTheDocument();
  });

  test("出発地を選択すると日時選択コンポーネントが表示される", async () => {
    render(<Home />);

    // 目的地を選択
    const destinationSelector = screen.getByTestId("mock-destination-selector");
    fireEvent.click(destinationSelector);

    // 出発地を選択
    const originSelector = screen.getByTestId("mock-origin-selector");
    fireEvent.click(originSelector);

    // 日時選択コンポーネントが表示される
    expect(screen.getByTestId("mock-date-time-selector")).toBeInTheDocument();
    // 目的地と出発地の情報が表示される
    expect(screen.getByText(/テスト目的地/)).toBeInTheDocument();
    expect(screen.getByText(/テスト住所/)).toBeInTheDocument();
  });

  test("リセットボタンをクリックすると初期状態に戻る", async () => {
    render(<Home />);

    // 目的地を選択
    const destinationSelector = screen.getByTestId("mock-destination-selector");
    fireEvent.click(destinationSelector);

    // リセットボタンをクリック
    const resetButton = screen.getByTestId("mock-reset-button");
    fireEvent.click(resetButton);

    // 初期状態に戻る
    expect(screen.getByTestId("mock-destination-selector")).toBeInTheDocument();
    expect(
      screen.queryByTestId("mock-origin-selector")
    ).not.toBeInTheDocument();
  });

  test("初回訪問ガイドモーダルがメインページに含まれている", () => {
    render(<Home />);

    // 初回訪問ガイドモーダルが含まれていることを確認
    expect(screen.getByTestId("mock-first-visit-modal")).toBeInTheDocument();
  });
});
