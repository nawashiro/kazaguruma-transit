import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RoutePdfExport from "../RoutePdfExport";
import { useReactToPrint } from "react-to-print";

// モックデータ
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

const mockRoutes = [
  {
    routeId: "route1",
    routeName: "ルート1",
    routeShortName: "R1",
    routeLongName: "出発地〜目的地直通ルート",
    routeColor: "FF0000",
    routeTextColor: "FFFFFF",
    departureTime: "9:30",
    arrivalTime: "10:15",
  },
];

// react-to-printのモック
jest.mock("react-to-print", () => ({
  useReactToPrint: jest.fn().mockImplementation(() => jest.fn()),
}));

describe("RoutePdfExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("PDFダウンロードボタンがレンダリングされること", () => {
    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    const button = screen.getByRole("button", { name: /PDF出力/i });
    expect(button).toBeInTheDocument();
  });

  it("PDFボタンをクリックするとPDF出力処理が呼ばれること", async () => {
    // モックハンドラー
    const mockPrintHandler = jest.fn();
    (useReactToPrint as jest.Mock).mockImplementation(() => mockPrintHandler);

    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    const button = screen.getByRole("button", { name: /PDF出力/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPrintHandler).toHaveBeenCalled();
    });
  });

  it("ルート情報が表示用コンポーネントに正しく渡されること", () => {
    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    // 印刷プレビューに表示される情報を確認
    expect(screen.getByText("乗り換え案内")).toBeInTheDocument();
    expect(screen.getByText("出発：出発バス停")).toBeInTheDocument();
    expect(screen.getByText("到着：到着バス停")).toBeInTheDocument();
  });
});
