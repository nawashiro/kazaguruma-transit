import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegratedRouteDisplay from "../../components/IntegratedRouteDisplay";

describe("IntegratedRouteDisplay", () => {
  const mockOriginStop = {
    stopId: "origin123",
    stopName: "出発バス停",
    distance: 0.2,
  };

  const mockDestinationStop = {
    stopId: "dest456",
    stopName: "到着バス停",
    distance: 0.3,
  };

  const mockTransferStop = {
    stopId: "transfer789",
    stopName: "乗換バス停",
    stopLat: 35.789,
    stopLon: 139.789,
  };

  const mockRoutes = [
    {
      routeId: "route1",
      routeName: "ルート1",
      routeShortName: "R1",
      routeLongName: "出発地〜乗換地ルート",
      routeColor: "FF0000",
      routeTextColor: "FFFFFF",
      transfers: [
        {
          transferStop: mockTransferStop,
          nextRoute: {
            routeId: "route2",
            routeName: "ルート2",
            routeShortName: "R2",
            routeLongName: "乗換地〜目的地ルート",
            routeColor: "0000FF",
            routeTextColor: "FFFFFF",
          },
        },
      ],
    },
  ];

  const mockDepartures = [
    {
      stopId: "origin123",
      routeId: "route1",
      routeName: "1番バス",
      time: "9:30",
      timeUntilDeparture: "10分",
      scheduledTime: "2023-11-01T09:30:00",
      headsign: "〇〇方面行き",
    },
    {
      stopId: "origin123",
      routeId: "route1",
      routeName: "1番バス",
      time: "10:00",
      timeUntilDeparture: "40分",
      scheduledTime: "2023-11-01T10:00:00",
      headsign: "〇〇方面行き",
    },
  ];

  it("出発/到着バス停情報が表示されること", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="transfer"
        transfers={1}
        departures={mockDepartures}
      />
    );

    const busStops = screen.getAllByText("出発バス停");
    expect(busStops.length).toBeGreaterThan(0);

    const destStops = screen.getAllByText("到着バス停");
    expect(destStops.length).toBeGreaterThan(0);

    const distanceTexts = screen.getAllByText(/出発地からの距離/);
    expect(distanceTexts.length).toBeGreaterThan(0);

    const destDistanceTexts = screen.getAllByText(/目的地からの距離/);
    expect(destDistanceTexts.length).toBeGreaterThan(0);
  });

  it("経路情報が表示されること", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="transfer"
        transfers={1}
        departures={mockDepartures}
      />
    );

    expect(screen.getByText("乗換ルートが見つかりました")).toBeInTheDocument();
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("出発地〜乗換地ルート")).toBeInTheDocument();

    const transferElements = screen.getAllByText(/乗換:/);
    expect(transferElements.length).toBeGreaterThan(0);

    const transferStops = screen.getAllByText(/乗換バス停/);
    expect(transferStops.length).toBeGreaterThan(0);

    expect(screen.getByText("R2")).toBeInTheDocument();
    expect(screen.getByText("乗換地〜目的地ルート")).toBeInTheDocument();
  });

  it("出発時刻情報が表示されること", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="transfer"
        transfers={1}
        departures={mockDepartures}
      />
    );

    expect(screen.getByText("次の出発時刻")).toBeInTheDocument();

    const timeElements = screen.getAllByText("9:30");
    expect(timeElements.length).toBeGreaterThan(0);

    const waitTimeElements = screen.getAllByText("10分");
    expect(waitTimeElements.length).toBeGreaterThan(0);

    if (screen.queryByText("その他の出発時刻")) {
      const tableRows = screen.getAllByRole("row");
      expect(tableRows.length).toBeGreaterThan(1);
    }
  });

  it("ルートが見つからない場合は適切なメッセージが表示されること", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={[]}
        type="none"
        transfers={0}
        departures={[]}
      />
    );

    const titleElements = screen.getAllByText("ルートが見つかりません");
    expect(titleElements.length).toBe(1);

    expect(
      screen.getByText("この2つの地点を結ぶルートが見つかりませんでした")
    ).toBeInTheDocument();
    expect(screen.getByText(/最寄りのバス停まで歩くか/)).toBeInTheDocument();
  });
});
