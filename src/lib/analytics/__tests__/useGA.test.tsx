import { StrictMode } from "react";
import { renderHook } from "@testing-library/react";
import ReactGA from "react-ga4";
import { useGA } from "../useGA";

jest.mock("@/lib/config/app-config", () => ({
  appConfig: { gaMeasurementId: "G-TEST" },
}));

let mockPathname: string | null;
let mockSearchParams: URLSearchParams;

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

type Command = [string, ...unknown[]];

const commands = (): Command[] =>
  (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer.map(
    (entry) => Array.from(entry) as Command,
  );
const pageviews = () =>
  commands().filter(([command, event]) => command === "event" && event === "page_view");

function navigate(url: string) {
  window.history.replaceState(null, "", url);
  mockPathname = window.location.pathname;
  mockSearchParams = new URLSearchParams(window.location.search);
}

beforeEach(() => {
  ReactGA.reset();
  (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  navigate("/routes?from=35.123,139.456&to=35.789,139.987#35.555,139.111");
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "https://example.com/shared?from=35.123,139.456#139.987",
  });
});

afterEach(() => {
  document.querySelectorAll('script[src*="googletagmanager.com"]').forEach(
    (script) => script.remove(),
  );
});

it("disables the initial automatic pageview and configures sanitized URL defaults", () => {
  renderHook(useGA);

  expect(commands().filter(([command]) => command === "config")).toEqual([
    ["config", "G-TEST", { send_page_view: false }],
  ]);
  expect(commands()[0]).toEqual(["set", {
    page_path: "/routes",
    page_location: "http://localhost/routes",
    page_referrer: "https://example.com/shared",
  }]);
});

it("sends one sanitized initial pageview without changing the shared URL", () => {
  const sharedUrl = window.location.href;
  renderHook(useGA);

  expect(pageviews()).toEqual([
    ["event", "page_view", {
      page_path: "/routes",
      page_location: "http://localhost/routes",
      page_referrer: "https://example.com/shared",
    }],
  ]);
  expect(window.location.href).toBe(sharedUrl);
  expect(JSON.stringify(commands())).not.toMatch(/[?#]|35\.123|139\.987/);
});

it("tracks pathname and query-only navigation once each with a sanitized previous URL", () => {
  const { rerender } = renderHook(useGA);
  navigate("/locations?lat=35.123&lng=139.987#map");
  rerender();
  navigate("/locations?lat=36.123&lng=140.987#map");
  rerender();
  mockSearchParams = new URLSearchParams(window.location.search);
  rerender();

  expect(pageviews()).toEqual([
    ["event", "page_view", expect.objectContaining({ page_path: "/routes" })],
    ["event", "page_view", {
      page_path: "/locations",
      page_location: "http://localhost/locations",
      page_referrer: "http://localhost/routes",
    }],
    ["event", "page_view", {
      page_path: "/locations",
      page_location: "http://localhost/locations",
      page_referrer: "http://localhost/locations",
    }],
  ]);
  expect(commands().filter(([command]) => command === "set").at(-1)).toEqual([
    "set", {
      page_path: "/locations",
      page_location: "http://localhost/locations",
      page_referrer: "http://localhost/locations",
    },
  ]);
  expect(JSON.stringify(commands())).not.toMatch(/[?#]|35\.123|139\.987|36\.123|140\.987/);
});

it("does not duplicate initialization or pageviews when StrictMode replays effects", () => {
  renderHook(useGA, { wrapper: StrictMode });

  expect(commands().filter(([command]) => command === "config")).toHaveLength(1);
  expect(pageviews()).toHaveLength(1);
});

it.each(["", "not a URL", "https://[invalid"])(
  "uses an empty referrer for %j",
  (referrer) => {
    Object.defineProperty(document, "referrer", { configurable: true, value: referrer });
    renderHook(useGA);

    expect(pageviews()).toEqual([
      ["event", "page_view", expect.objectContaining({ page_referrer: "" })],
    ]);
  },
);

it("waits for the pathname before initializing and sending a pageview", () => {
  mockPathname = null;
  const { rerender } = renderHook(useGA);
  expect(commands()).toEqual([]);

  mockPathname = "/routes";
  rerender();
  expect(pageviews()).toHaveLength(1);
});
