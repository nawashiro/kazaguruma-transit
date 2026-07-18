/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/components/features/DateTimeSelector", () =>
  ({ onDateTimeSelected }: any) => (
    <button
      data-testid="mock-date-time-selector"
      onClick={() =>
        onDateTimeSelected({ dateTime: "2026-07-18T09:30", isDeparture: true })
      }
    />
  ),
);

jest.mock("@/components/features/OriginSelector", () =>
  ({ onOriginSelected }: any) => (
    <button
      data-testid="mock-origin-selector"
      onClick={() => onOriginSelected({ lat: 35.68, lng: 139.76, address: "テスト住所" })}
    />
  ),
);

jest.mock("@/components/features/DestinationSelector", () =>
  ({ onDestinationSelected }: any) => (
    <button
      data-testid="mock-destination-selector"
      onClick={() =>
        onDestinationSelected({ lat: 35.7, lng: 139.78, address: "テスト目的地" })
      }
    />
  ),
);

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    global.fetch = jest.fn();
  });

  it("目的地、出発地、日時を順に入力する", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    expect(screen.getByTestId("mock-origin-selector")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    expect(screen.getByTestId("mock-date-time-selector")).toBeInTheDocument();
    expect(screen.getByText("テスト目的地")).toBeInTheDocument();
    expect(screen.getByText("テスト住所")).toBeInTheDocument();
  });

  it("検索条件をGET結果ページURLへ渡し、入力ページではfetchしない", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    fireEvent.click(screen.getByTestId("mock-date-time-selector"));
    fireEvent.click(screen.getByTestId("search-route"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/routes?origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("はやさ優先をURLへ明示して端末設定に依存させない", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    fireEvent.click(screen.getByTestId("mock-date-time-selector"));
    fireEvent.click(screen.getByRole("checkbox", { name: "はやさ優先" }));
    fireEvent.click(screen.getByTestId("search-route"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("prioritizeSpeed=true"),
    );
  });

  it("リセットで目的地入力へ戻る", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByRole("button", { name: "検索条件をリセット" }));

    expect(screen.getByTestId("mock-destination-selector")).toBeInTheDocument();
  });
});
