import { render } from "@testing-library/react";
import ReactGA from "react-ga4";
import { useGA } from "@/lib/analytics/useGA";
import { SEARCH_STARTED_KEY } from "@/lib/analytics/tracking";
import RouteSearchTracker from "../RouteSearchTracker";

jest.mock("@/lib/config/app-config", () => ({ appConfig: { gaMeasurementId: "G-TEST" } }));
jest.mock("next/navigation", () => ({
  usePathname: () => "/routes",
  useSearchParams: () => new URLSearchParams("origin=35.0,139.0"),
}));

type Command = [string, ...unknown[]];

const commands = (): Command[] =>
  (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer.map(
    (entry) => Array.from(entry) as Command,
  );
const routeSearches = () =>
  commands().filter(([command, event]) => command === "event" && event === "route_search");

function Initializer() {
  useGA();
  return null;
}

beforeEach(() => {
  ReactGA.reset();
  localStorage.clear();
  sessionStorage.clear();
  (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  sessionStorage.setItem(SEARCH_STARTED_KEY, "1000");
});

afterEach(() => {
  document.querySelectorAll('script[src*="googletagmanager.com"]').forEach((script) => script.remove());
  jest.restoreAllMocks();
});

it("delivers route_search after the measurement id is configured when the tracker mounts first", () => {
  jest.spyOn(Date, "now").mockReturnValue(4500);

  render(
    <>
      <RouteSearchTracker />
      <Initializer />
    </>,
  );

  expect(routeSearches()).toEqual([
    ["event", "route_search", { elapsed_ms: 3500 }],
  ]);
  const names = commands().map(([command, event]) => `${command}:${String(event)}`);
  expect(names.indexOf("event:route_search")).toBeGreaterThan(names.indexOf("config:G-TEST"));
});

it("does not hold back events once the id is configured", () => {
  render(<Initializer />);
  render(<RouteSearchTracker />);

  expect(routeSearches()).toHaveLength(1);
});
