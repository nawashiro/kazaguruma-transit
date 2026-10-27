import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegratedRouteDisplay from "../IntegratedRouteDisplay";

describe("IntegratedRouteDisplay", () => {
  const mockOriginStop = {
    stopId: "origin123",
    stopName: "出発バス停",
    distance: 0.2,
    stop_lat: 35.1,
    stop_lon: 139.1,
  };

  const mockDestinationStop = {
    stopId: "dest456",
    stopName: "到着バス停",
    distance: 0.3,
    stop_lat: 35.2,
    stop_lon: 139.2,
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
      departureTime: "09:30:00",
      arrivalTime: "10:15:00",
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
            departureTime: "10:30:00",
            arrivalTime: "11:15:00",
          },
        },
      ],
    },
  ];

  const directRoutes = [
    {
      ...mockRoutes[0],
      transfers: [],
    },
  ];

  const coordinateProps = { originLat: 35, originLng: 139, destLat: 36, destLng: 140 };

  const timelineRows = () =>
    [...document.querySelectorAll("ol.timeline > li")].map((li) => li.textContent);

  const edgeClasses = (li: Element) =>
    [...li.children]
      .filter((child) => child.tagName === "HR")
      .map((hr) => hr.className);

  it("経路をタイムラインの順序付きリストで出発地から目的地まで示す", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={directRoutes}
        type="direct"
        {...coordinateProps}
      />
    );
    const timeline = document.querySelector("ol.timeline");
    expect(timeline).not.toBeNull();
    expect(timeline!.tagName).toBe("OL");
    expect(screen.queryByRole("heading", { name: "経路" })).toBeNull();
    const rows = timelineRows();
    expect(rows[0]).toContain("出発地");
    expect(rows[0]).toContain("9時19分");
    expect(rows[1]).toContain("徒歩で移動");
    expect(rows[2]).toContain("出発バス停");
    expect(rows[2]).toContain("9時30分");
    expect(rows[3]).toContain("ルート1");
    expect(rows[4]).toContain("到着バス停");
    expect(rows[4]).toContain("10時15分");
    expect(rows[5]).toContain("徒歩で移動");
    expect(rows[6]).toContain("目的地");
    expect(rows[6]).toContain("10時29分");
  });

  it("乗換経路を乗車停留所・路線名・降車停留所の順で示す", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="transfer"
      />
    );
    const rows = timelineRows();
    expect(rows[0]).toContain("出発バス停");
    expect(rows[1]).toContain("ルート1");
    expect(rows[2]).toContain("乗換バス停");
    expect(rows[3]).toContain("ここで乗り換え");
    expect(rows[4]).toContain("乗換バス停");
    expect(rows[5]).toContain("ルート2");
    expect(rows[6]).toContain("到着バス停");
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);
  });

  it("ノードを境にエッジの色が区間から区間へ引き継がれる", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="transfer"
        {...coordinateProps}
      />
    );
    const rows = [...document.querySelectorAll("ol.timeline > li")];
    expect(edgeClasses(rows[0])).toEqual(["bg-accent"]);
    expect(edgeClasses(rows[1])).toEqual(["bg-accent", "bg-accent"]);
    expect(edgeClasses(rows[2])).toEqual(["bg-accent", "bg-secondary"]);
    expect(edgeClasses(rows[3])).toEqual(["bg-secondary", "bg-secondary"]);
    expect(edgeClasses(rows[4])).toEqual(["bg-secondary", "bg-accent"]);
    expect(edgeClasses(rows[5])).toEqual(["bg-accent", "bg-accent"]);
    expect(edgeClasses(rows[6])).toEqual(["bg-accent", "bg-secondary"]);
    expect(edgeClasses(rows[7])).toEqual(["bg-secondary", "bg-secondary"]);
    expect(edgeClasses(rows[8])).toEqual(["bg-secondary", "bg-accent"]);
    expect(edgeClasses(rows[9])).toEqual(["bg-accent", "bg-accent"]);
    expect(edgeClasses(rows[10])).toEqual(["bg-accent"]);
  });

  it("出発地と目的地をGoogleマップの地点リンクで示す", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={directRoutes}
        type="direct"
        {...coordinateProps}
      />
    );
    const originLink = screen.getByRole("link", { name: "出発地" });
    expect(originLink).toHaveAttribute("href", "https://www.google.com/maps?q=35,139");
    expect(originLink).toHaveAttribute("target", "_blank");
    expect(originLink).toHaveAttribute("rel", "noopener noreferrer");
    const destinationLink = screen.getByRole("link", { name: "目的地" });
    expect(destinationLink).toHaveAttribute("href", "https://www.google.com/maps?q=36,140");
    expect(screen.getAllByRole("link", { name: /Googleマップ/ })).toHaveLength(2);
  });

  it("乗車時刻が不明なときは出発地行を表示せず時刻不明を示す", () => {
    const unknownRoutes = [
      {
        ...directRoutes[0],
        departureTime: undefined,
        arrivalTime: undefined,
      },
    ];
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={unknownRoutes}
        type="direct"
        {...coordinateProps}
      />
    );
    expect(screen.queryByText("出発地")).toBeNull();
    expect(screen.queryByText("目的地")).toBeNull();
    expect(screen.getAllByText("時刻不明").length).toBeGreaterThan(0);
  });

  it("路線名をsecondary系の太字で示す", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={directRoutes}
        type="direct"
      />
    );
    const routeName = screen.getByText("ルート1");
    expect(routeName).toHaveClass("font-bold");
    expect(routeName).toHaveClass("text-secondary-content");
    expect(routeName).toHaveClass("dark:text-secondary");
  });

  it("本文を16px相当で表現しカードで囲まない", () => {
    const { container } = render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={directRoutes}
        type="direct"
        {...coordinateProps}
      />
    );
    expect(container.querySelector(".card")).toBeNull();
    for (const time of container.querySelectorAll("time")) {
      expect(time).toHaveClass("text-base");
      expect(time.parentElement).toHaveClass("flex-wrap");
    }
  });

  it("タイムラインの全行でノード列の幅をそろえる", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="transfer"
        {...coordinateProps}
      />
    );
    const middles = [...document.querySelectorAll("ol.timeline > li > .timeline-middle")];
    expect(middles.length).toBeGreaterThan(0);
    for (const middle of middles) {
      expect(middle).toHaveClass("w-4");
    }
  });

  it("ルートが見つからない場合は適切なメッセージが表示されること", () => {
    render(
      <IntegratedRouteDisplay
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={[]}
        type="none"
      />
    );
    expect(screen.getByText("ルートが見つかりません")).toBeInTheDocument();
    expect(
      screen.getByText("この2つの地点を結ぶルートが見つかりませんでした")
    ).toBeInTheDocument();
    expect(
      screen.getByText("別の交通手段をご検討ください")
    ).toBeInTheDocument();
  });
});
