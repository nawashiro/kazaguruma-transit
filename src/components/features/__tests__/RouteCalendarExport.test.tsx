import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RouteCalendarExport from "../RouteCalendarExport";

const mockCreateObjectURL = jest.fn(() => "blob:calendar-url");
const mockRevokeObjectURL = jest.fn();
let mockAnchorClick: jest.SpyInstance;

beforeAll(() => {
  Object.defineProperty(window, "URL", {
    value: {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    },
    writable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAnchorClick = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);
});

afterEach(() => {
  mockAnchorClick.mockRestore();
});

test("カレンダーボタンからICSを通常のリンクとして開き、URLをアンマウントまで保持する", () => {
  const { unmount } = render(
    <RouteCalendarExport
      originStop={{ stopId: "from", stopName: "出発", distance: 0 }}
      destinationStop={{ stopId: "to", stopName: "到着", distance: 0 }}
      routes={[
        {
          routeId: "route",
          routeName: "神田ルート",
          routeShortName: "神田",
          routeLongName: "神田ルート",
          routeColor: "000000",
          routeTextColor: "ffffff",
          departureTime: "09:00:00",
          arrivalTime: "09:15:00",
        },
      ]}
      selectedDateTime="2026-07-18T08:00"
    />
  );

  const button = screen.getByRole("button", { name: "カレンダーに追加" });
  expect(button).toHaveClass("btn", "btn-primary", "rounded-full");

  mockCreateObjectURL.mockReturnValueOnce("blob:first-calendar");
  mockCreateObjectURL.mockReturnValueOnce("blob:second-calendar");
  fireEvent.click(button);

  expect(mockCreateObjectURL).toHaveBeenCalledWith(
    expect.objectContaining({ type: "text/calendar;charset=utf-8" })
  );
  expect(mockAnchorClick).toHaveBeenCalledTimes(1);
  const firstLink = mockAnchorClick.mock.instances[0] as HTMLAnchorElement;
  expect(firstLink.href).toBe("blob:first-calendar");
  expect(firstLink).not.toHaveAttribute("download");
  expect(mockRevokeObjectURL).not.toHaveBeenCalled();

  fireEvent.click(button);

  const secondLink = mockAnchorClick.mock.instances[1] as HTMLAnchorElement;
  expect(secondLink.href).toBe("blob:second-calendar");
  expect(secondLink).not.toHaveAttribute("download");
  expect(mockRevokeObjectURL).not.toHaveBeenCalled();

  unmount();

  expect(mockRevokeObjectURL.mock.calls).toEqual([
    ["blob:first-calendar"],
    ["blob:second-calendar"],
  ]);
});

test("不正な日時のカレンダー生成失敗をalertで知らせ、追加操作を維持する", () => {
  render(
    <RouteCalendarExport
      originStop={{ stopId: "from", stopName: "出発", distance: 0 }}
      destinationStop={{ stopId: "to", stopName: "到着", distance: 0 }}
      routes={[
        {
          routeId: "route",
          routeName: "神田ルート",
          routeShortName: "神田",
          routeLongName: "神田ルート",
          routeColor: "000000",
          routeTextColor: "ffffff",
          departureTime: "09:00:00",
          arrivalTime: "09:15:00",
        },
      ]}
      selectedDateTime="invalid-date"
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "カレンダーに追加" }));

  const alert = screen.getByRole("alert");
  expect(mockCreateObjectURL).not.toHaveBeenCalled();
  expect(mockAnchorClick).not.toHaveBeenCalled();
  expect(alert).toHaveTextContent(
    "カレンダー生成エラー: カレンダーに必要な日付情報がありません"
  );
  expect(alert).toHaveClass(
    "alert",
    "alert-error",
    "alert-soft",
    "text-base-content!"
  );

  const buttonAfterError = screen.getByRole("button", {
    name: "カレンダーに追加",
  });
  expect(buttonAfterError).toBeInTheDocument();
  fireEvent.click(buttonAfterError);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
