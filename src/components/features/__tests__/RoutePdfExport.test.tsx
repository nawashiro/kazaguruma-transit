import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RoutePdfExport from "../RoutePdfExport";

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

// 権限確認APIのモック設定
// サポーター支援者の場合
const mockSupporterResponse = {
  success: true,
  canPrint: true,
  isLoggedIn: true,
  isSupporter: true,
};

// APIのモック化
global.fetch = jest.fn().mockImplementation((url) => {
  if (url === "/api/pdf/check-permission") {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockSupporterResponse),
    });
  }
  // 他のAPIエンドポイントの場合はデフォルトのレスポンスを返す
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  });
});

// react-to-printのモック
jest.mock("react-to-print", () => ({
  useReactToPrint: jest.fn().mockImplementation(() => jest.fn()),
}));

// window.URL.createObjectURLのモック
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
let mockAnchorClick: jest.SpyInstance;

beforeAll(() => {
  // window.URLのモックを設定
  Object.defineProperty(window, "URL", {
    value: {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    },
    writable: true,
  });
});

beforeEach(() => {
  // 各テストの前にモックをリセット
  mockCreateObjectURL.mockReset();
  mockRevokeObjectURL.mockReset();
  mockCreateObjectURL.mockReturnValue("blob:mock-url");
  mockAnchorClick = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);
});

afterEach(() => {
  mockAnchorClick.mockRestore();
});

describe("RoutePdfExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトではサポーター権限があるようにモック設定
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url === "/api/pdf/check-permission") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSupporterResponse),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  it("正常にPDF出力ボタンが表示されること", async () => {
    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    // ボタンが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText("印刷する")).toBeInTheDocument();
    });
  });

  it("PDFボタンをクリックするとPDF出力処理が呼ばれること", async () => {
    // APIレスポンスのモック
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url === "/api/pdf/check-permission") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSupporterResponse),
        });
      }
      if (url === "/api/pdf/generate") {
        return Promise.resolve({
          ok: true,
          blob: () =>
            Promise.resolve(new Blob(["test"], { type: "application/pdf" })),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    // ボタンが表示されることを確認し、クリック
    await waitFor(() => {
      const button = screen.getByText("印刷する");
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
    });

    // PDFダウンロードリンクが作成されることを確認
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  it("PDF生成中もアイコンのDOMノードを維持すること", async () => {
    let resolvePdfResponse: ((response: object) => void) | undefined;
    const pdfResponse = new Promise<object>((resolve) => {
      resolvePdfResponse = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValue(pdfResponse);

    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    const button = screen.getByRole("button", { name: "印刷する" });
    const downloadIcon = button.querySelector("svg");
    expect(downloadIcon).not.toBeNull();

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成中..." })).toBeDisabled();
    });
    expect(button.querySelector("svg")).toBe(downloadIcon);

    await act(async () => {
      resolvePdfResponse?.({
        ok: true,
        blob: () =>
          Promise.resolve(new Blob(["test"], { type: "application/pdf" })),
      });
    });
    expect(screen.getByRole("button", { name: "印刷する" })).toBeEnabled();
  });

  it("ダウンロードリンクが外部で除去されてもエラー表示に切り替わらないこと", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () =>
        Promise.resolve(new Blob(["test"], { type: "application/pdf" })),
    });
    mockAnchorClick.mockImplementation(function removeClickedAnchor(
      this: HTMLAnchorElement
    ) {
      this.remove();
    });

    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "印刷する" }));

    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      expect(screen.queryByText("PDF生成エラー")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "印刷する" })
      ).toBeEnabled();
    });
  });

  it("APIエラー時にエラーメッセージが表示されること", async () => {
    // エラーレスポンスを返すようにモックを設定
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url === "/api/pdf/generate") {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              success: false,
              error: "サーバーエラーが発生しました",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    render(
      <RoutePdfExport
        originStop={mockOriginStop}
        destinationStop={mockDestinationStop}
        routes={mockRoutes}
        type="direct"
        transfers={0}
      />
    );

    // ボタンをクリック
    await waitFor(() => {
      const button = screen.getByText("印刷する");
      fireEvent.click(button);
    });

    // エラーメッセージの表示を待機
    await waitFor(() => {
      expect(screen.getByText("PDF生成エラー")).toBeInTheDocument();
    });
  });
});
