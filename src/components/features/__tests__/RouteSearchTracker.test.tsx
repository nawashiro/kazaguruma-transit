import { render } from "@testing-library/react";
import RouteSearchTracker from "../RouteSearchTracker";
import { takeSearchStart, track } from "@/lib/analytics/tracking";

jest.mock("@/lib/analytics/tracking", () => ({ track: jest.fn(), takeSearchStart: jest.fn() }));

const takeSearchStartMock = takeSearchStart as jest.Mock;
const trackMock = track as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

it("records one route search with the elapsed time", () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(4500);
  takeSearchStartMock.mockReturnValueOnce(1000).mockReturnValue(null);

  const { rerender } = render(<RouteSearchTracker />);

  expect(trackMock).toHaveBeenCalledWith("route_search", { elapsed_ms: 3500 });
  rerender(<RouteSearchTracker />);
  expect(trackMock).toHaveBeenCalledTimes(1);
  now.mockRestore();
});

it("records nothing when the search did not start on the form", () => {
  takeSearchStartMock.mockReturnValue(null);

  render(<RouteSearchTracker />);

  expect(trackMock).not.toHaveBeenCalled();
});

it("does not report negative elapsed time", () => {
  jest.spyOn(Date, "now").mockReturnValue(4000);
  takeSearchStartMock.mockReturnValueOnce(5000);

  render(<RouteSearchTracker />);

  expect(trackMock).toHaveBeenCalledWith("route_search", { elapsed_ms: 0 });
  jest.restoreAllMocks();
});
