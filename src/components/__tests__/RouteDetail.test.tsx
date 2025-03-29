import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RouteDetail from "../RouteDetail";

describe("RouteDetail", () => {
  // テストデータ
  const originStop = {
    stopId: "stop1",
    stopName: "出発バス停",
    distance: 0.2,
  };

  const destinationStop = {
    stopId: "stop2",
    stopName: "目的地バス停",
    distance: 0.3,
  };

  const routes = [
    {
      routeId: "route1",
      routeName: "循環バス",
      routeShortName: "01",
      routeLongName: "循環バス01",
      routeColor: "FF0000",
      routeTextColor: "FFFFFF",
    },
  ];

  const routesWithTransfer = [
    {
      routeId: "route1",
      routeName: "循環バス",
      routeShortName: "01",
      routeLongName: "循環バス01",
      routeColor: "FF0000",
      routeTextColor: "FFFFFF",
      transfers: [
        {
          transferStop: {
            stopId: "stop3",
            stopName: "乗換バス停",
            stopLat: 35.6853,
            stopLon: 139.7537,
          },
          nextRoute: {
            routeId: "route2",
            routeName: "経由バス",
            routeShortName: "02",
            routeLongName: "経由バス02",
            routeColor: "00FF00",
            routeTextColor: "000000",
          },
        },
      ],
    },
  ];

  test("直接ルートの情報を正しく表示する", () => {
    const { container } = render(
      <RouteDetail
        originStop={originStop}
        destinationStop={destinationStop}
        routes={routes}
        type="direct"
        transfers={0}
      />
    );

    // タイトルと説明を確認
    expect(screen.getByText("直行ルートが見つかりました")).toBeInTheDocument();

    // 出発・目的地のバス停名を確認
    expect(screen.getByText("出発バス停")).toBeInTheDocument();
    expect(screen.getByText("目的地バス停")).toBeInTheDocument();

    // テキストが複数の要素に分割されている場合、textContentを使って確認
    expect(container.textContent).toContain("直接行けるバス路線があります");

    // ルート情報を確認
    expect(screen.getByText("循環バス01")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("路線ID:", { exact: false })).toBeInTheDocument();
    expect(container.textContent).toContain("route1");

    // 乗換なしバッジを確認
    expect(screen.getByText("乗換なし")).toBeInTheDocument();

    // 距離情報を確認（textContentを使用して部分一致）
    expect(container.textContent).toContain("最寄りバス停までの距離");
    expect(container.textContent).toContain("200");
    expect(container.textContent).toContain("300");
    expect(container.textContent).toContain("m");
  });

  test("乗り換えが必要なルートの情報を正しく表示する", () => {
    const { container } = render(
      <RouteDetail
        originStop={originStop}
        destinationStop={destinationStop}
        routes={routesWithTransfer}
        type="transfer"
        transfers={1}
      />
    );

    // タイトルと説明を確認
    expect(screen.getByText("乗換ルートが見つかりました")).toBeInTheDocument();

    // 出発・目的地のバス停名を確認
    expect(screen.getByText("出発バス停")).toBeInTheDocument();
    expect(screen.getByText("目的地バス停")).toBeInTheDocument();

    // テキストが複数の要素に分割されている場合、textContentを使って確認
    expect(container.textContent).toContain("回の乗換で行けます");

    // 最初のルート情報を確認
    expect(screen.getByText("最初のルート")).toBeInTheDocument();
    expect(screen.getByText("循環バス01")).toBeInTheDocument();

    // 複数ある場合は getAllByText を使用
    expect(screen.getAllByText(/ルート:/i).length).toBeGreaterThan(0);

    // 乗換情報を確認（textContentを使用して部分一致）
    expect(container.textContent).toContain("乗換バス停");
    expect(
      screen.getByText("別のバスに乗り換えてください")
    ).toBeInTheDocument();

    // 次のルート情報を確認
    expect(screen.getByText("次のルート")).toBeInTheDocument();
    expect(screen.getByText("経由バス02")).toBeInTheDocument();
    expect(container.textContent).toContain("目的地バス停");

    // 乗換回数バッジを確認
    expect(container.textContent).toContain("乗換:");
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("回");
  });

  test("ルートが見つからない場合のメッセージを表示する", () => {
    render(
      <RouteDetail
        originStop={originStop}
        destinationStop={destinationStop}
        routes={[]}
        type="none"
        transfers={0}
        message="この2つの地点を結ぶルートが見つかりませんでした"
      />
    );

    // エラーメッセージを確認
    expect(screen.getByText("ルートが見つかりません")).toBeInTheDocument();
    expect(
      screen.getByText("この2つの地点を結ぶルートが見つかりませんでした")
    ).toBeInTheDocument();

    // 警告メッセージを確認
    expect(
      screen.getByText(
        "最寄りのバス停まで歩くか、別の交通手段を検討してください。"
      )
    ).toBeInTheDocument();
  });
});
