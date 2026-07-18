import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";

jest.mock("@/components/features/DateTimeSelector", () => function MockDateTimeSelector() {
  return <div />;
});
jest.mock("@/components/features/OriginSelector", () => function MockOriginSelector() {
  return <div />;
});
jest.mock("@/components/features/DestinationSelector", () => function MockDestinationSelector() {
  return <div />;
});
jest.mock("@/components/features/IntegratedRouteDisplay", () => function MockIntegratedRouteDisplay() {
  return <div />;
});
jest.mock("@/components/features/RoutePdfExport", () => function MockRoutePdfExport() {
  return <div />;
});
jest.mock("@/components/features/RateLimitModal", () => function MockRateLimitModal() {
  return null;
});
jest.mock("@/components/ui/Button", () => function MockButton({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>;
});
jest.mock("@/components/ui/ResetButton", () => function MockResetButton() {
  return <button>リセット</button>;
});

describe("Home navigation contract", () => {
  it("目的地ディープリンクを読み込み、初期画面を表示する", async () => {
    window.history.replaceState(
      {},
      "",
      "/?destination=" + encodeURIComponent(JSON.stringify({ lat: 35.7, lng: 139.78, address: "テスト目的地" })),
    );

    render(<Home />);

    expect(await screen.findByText("テスト目的地")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});
