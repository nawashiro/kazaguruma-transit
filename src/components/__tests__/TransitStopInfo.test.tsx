import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransitStopInfo from "../TransitStopInfo";

describe("TransitStopInfo", () => {
  const mockLocation = {
    lat: 35.6812,
    lng: 139.7671,
    address: "東京都千代田区",
  };

  it("出発バス停情報を正しく表示する", () => {
    const mockStopInfo = {
      stop_id: "stop1",
      stop_name: "千代田駅",
      distance: 0.3,
    };

    render(
      <TransitStopInfo
        stopInfo={mockStopInfo}
        location={mockLocation}
        type="origin"
      />
    );

    expect(screen.getByText(/出発バス停.*千代田駅/)).toBeInTheDocument();
    expect(screen.getByText(/出発地.*からの距離: 約/)).toBeInTheDocument();
    expect(screen.getByText(/300/)).toBeInTheDocument();
    expect(screen.getByText(/m/)).toBeInTheDocument();

    // 距離が600m未満なので警告は表示されない
    expect(screen.queryByText(/離れています/)).not.toBeInTheDocument();
  });

  it("目的地バス停情報を正しく表示する", () => {
    const mockStopInfo = {
      stop_id: "stop2",
      stop_name: "霞ヶ関駅",
      distance: 0.5,
    };

    render(
      <TransitStopInfo
        stopInfo={mockStopInfo}
        location={mockLocation}
        type="destination"
      />
    );

    expect(screen.getByText(/目的地バス停.*霞ヶ関駅/)).toBeInTheDocument();
    expect(screen.getByText(/目的地.*からの距離: 約/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/m/)).toBeInTheDocument();
  });

  it("距離が600m以上の場合は警告を表示する", () => {
    const mockStopInfo = {
      stop_id: "stop3",
      stop_name: "東京駅",
      distance: 0.8,
    };

    const { container } = render(
      <TransitStopInfo
        stopInfo={mockStopInfo}
        location={mockLocation}
        type="origin"
      />
    );

    expect(screen.getByText(/出発バス停.*東京駅/)).toBeInTheDocument();

    // 距離表示をチェック（複数箇所にある可能性あり）
    const distanceElements = screen.getAllByText(/800/);
    expect(distanceElements.length).toBeGreaterThanOrEqual(1);

    // 警告メッセージが表示されていることを確認
    expect(screen.getByText(/離れています/)).toBeInTheDocument();

    // 警告アラートが表示されていることを確認（クラス名で検索）
    const alertElement = container.querySelector(".alert-warning");
    expect(alertElement).toBeInTheDocument();

    // 徒歩時間もチェック
    expect(screen.getByText(/徒歩約/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
    expect(screen.getByText(/分/)).toBeInTheDocument();
  });
});
