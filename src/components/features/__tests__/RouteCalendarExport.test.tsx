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

test("プライマリ色のカレンダーボタンからicsファイルをダウンロードする", () => {
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
      selectedDateTime="2026-07-18T08:00"
    />
  );

  const button = screen.getByRole("button", { name: "カレンダーに追加" });
  expect(button).toHaveClass("btn", "btn-primary", "rounded-full");

  fireEvent.click(button);

  expect(mockCreateObjectURL).toHaveBeenCalledWith(
    expect.objectContaining({ type: "text/calendar;charset=utf-8" })
  );
  expect(mockAnchorClick).toHaveBeenCalledTimes(1);
  expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:calendar-url");
});
