import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeparturesList from "../DeparturesList";
import { Departure } from "../../types/transit";

describe("DeparturesList", () => {
  const mockDepartures: Departure[] = [
    {
      routeId: "route1",
      routeName: "千代田線",
      stopId: "stop1",
      stopName: "大手町",
      direction: "不明",
      scheduledTime: new Date(Date.now() + 5 * 60000).toISOString(),
      realtime: true,
      delay: 0,
    },
    {
      routeId: "route1",
      routeName: "千代田線",
      stopId: "stop1",
      stopName: "大手町",
      direction: "不明",
      scheduledTime: new Date(Date.now() + 15 * 60000).toISOString(),
      realtime: false,
      delay: null,
    },
  ];

  it("renders loading state correctly", () => {
    render(<DeparturesList departures={[]} loading={true} error={null} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders error state correctly", () => {
    const errorMessage = "エラーが発生しました";
    render(
      <DeparturesList departures={[]} loading={false} error={errorMessage} />
    );

    expect(screen.getByTestId("error-message")).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("renders empty state correctly", () => {
    render(<DeparturesList departures={[]} loading={false} error={null} />);

    expect(screen.getByTestId("no-departures")).toBeInTheDocument();
    expect(
      screen.getByText(
        "出発便が見つかりませんでした。条件を変更して再度お試しください。"
      )
    ).toBeInTheDocument();
  });

  it("renders departures correctly", () => {
    render(
      <DeparturesList
        departures={mockDepartures}
        loading={false}
        error={null}
      />
    );

    expect(screen.getByTestId("departures-list")).toBeInTheDocument();
    expect(screen.getByTestId("departure-0")).toBeInTheDocument();
    expect(screen.getByTestId("departure-1")).toBeInTheDocument();

    // 路線名が表示されていることを確認
    expect(screen.getAllByText("千代田線").length).toBe(2);

    // 定刻の表示を確認
    expect(screen.getByText("（定刻）")).toBeInTheDocument();

    // 時刻表の表示を確認
    expect(screen.getByText("（時刻表）")).toBeInTheDocument();
  });

  it("renders delayed time correctly", () => {
    const delayedDeparture: Departure[] = [
      {
        ...mockDepartures[0],
        delay: 600, // 10分遅れ
      },
    ];

    render(
      <DeparturesList
        departures={delayedDeparture}
        loading={false}
        error={null}
      />
    );

    expect(screen.getByText("（10分遅れ）")).toBeInTheDocument();
  });
});
