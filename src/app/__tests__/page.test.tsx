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

  it("非公式サービス案内の直後にAIエージェント向け案内を初期状態で閉じて表示し、開閉できる", () => {
    render(<Home />);

    const unofficialServiceCard = screen
      .getByText("※このサービスは非公式のもので、千代田区とは関係ありません")
      .closest("section");
    const aiAgentGuidanceCard = screen.getByTestId("ai-agent-guidance-card");
    const aiAgentGuidance = screen.getByTestId("ai-agent-guidance");

    expect(unofficialServiceCard?.nextElementSibling).toBe(aiAgentGuidanceCard);
    expect(screen.getByText("AIエージェントのかたへ").tagName).toBe("SUMMARY");
    expect(aiAgentGuidance).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText("AIエージェントのかたへ"));
    expect(aiAgentGuidance).toHaveAttribute("open");

    fireEvent.click(screen.getByText("AIエージェントのかたへ"));
    expect(aiAgentGuidance).not.toHaveAttribute("open");
  });

  it("AIエージェントに必要な聞き取り、座標調査、検索結果リンクの手順を示す", () => {
    render(<Home />);

    fireEvent.click(screen.getByText("AIエージェントのかたへ"));

    expect(screen.getByText(/ユーザーの具体的な希望を知らない/)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /出発地、目的地、到着時刻または出発時刻、速さを優先し歩きを許容するか/,
      ),
    ).toHaveLength(2);
    expect(screen.getByText(/座標がわからない/)).toBeInTheDocument();
    expect(screen.getByText(/ウェブ検索し、座標を調査する/)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Given: あなたはAIエージェントで、ユーザーから「風ぐるま乗換案内を使いたい」と指示されている",
      ),
    ).toHaveLength(2);
    expect(screen.getByText("When: あなたは不明なパラメータがない")).toBeInTheDocument();
    expect(
      screen.getByText(
        "https://kazaguruma-transit.nawashiro.dev/routes?origin={lat}%2C{lon}&destination={lat}%2C{lon}&time={YYYY}-{MM}-{DD}T{hh}%3A{mm}&isDeparture={boolean}&prioritizeSpeed={boolean}",
      ),
    ).toBeInTheDocument();
  });
});
