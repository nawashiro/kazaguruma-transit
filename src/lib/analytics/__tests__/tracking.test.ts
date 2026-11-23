import ReactGA from "react-ga4";
import { appConfig } from "@/lib/config/app-config";
import { logger } from "@/utils/logger";

jest.mock("react-ga4", () => ({ __esModule: true, default: { event: jest.fn() } }));
jest.mock("@/lib/config/app-config", () => ({ appConfig: { gaMeasurementId: "G-TEST" } }));

import {
  OWNER_STORAGE_KEY,
  SEARCH_STARTED_KEY,
  markSearchStart,
  ownerFields,
  syncOwnerFlag,
  takeSearchStart,
  track,
} from "../tracking";

const eventMock = ReactGA.event as jest.Mock;
const config = appConfig as { gaMeasurementId: string };
const originalEnv = process.env.NODE_ENV;

function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, "NODE_ENV", { value, configurable: true });
}

beforeEach(() => {
  eventMock.mockClear();
  (logger.log as jest.Mock).mockClear();
  config.gaMeasurementId = "G-TEST";
  setNodeEnv("test");
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterAll(() => {
  setNodeEnv(originalEnv ?? "test");
});

it("sends the event name and parameters", () => {
  track("route_search", { elapsed_ms: 1234 });

  expect(eventMock).toHaveBeenCalledWith("route_search", { elapsed_ms: 1234 });
});

it("does not send when the measurement id is empty", () => {
  config.gaMeasurementId = "";
  track("route_search", { elapsed_ms: 1 });

  expect(eventMock).not.toHaveBeenCalled();
});

it("logs instead of sending in development", () => {
  setNodeEnv("development");
  track("route_search", { elapsed_ms: 1 });

  expect(eventMock).not.toHaveBeenCalled();
  expect(logger.log).toHaveBeenCalledWith("[GA Event] route_search", { elapsed_ms: 1 });
});

it("adds no owner fields for regular visitors", () => {
  expect(ownerFields()).toEqual({});
});

it("marks owner events as internal traffic", () => {
  localStorage.setItem(OWNER_STORAGE_KEY, "1");
  track("place_select", { field: "destination", source: "catalog" });

  expect(eventMock).toHaveBeenCalledWith("place_select", {
    field: "destination",
    source: "catalog",
    traffic_type: "internal",
    user_type: "owner",
  });
});

it("stores the owner flag and strips it from the URL", () => {
  window.history.replaceState(null, "", "/?owner=1&from=35%2C139");

  expect(syncOwnerFlag()).toBe(true);
  expect(localStorage.getItem(OWNER_STORAGE_KEY)).toBe("1");
  expect(window.location.search).toBe("?from=35%2C139");
});

it("clears the owner flag", () => {
  localStorage.setItem(OWNER_STORAGE_KEY, "1");
  window.history.replaceState(null, "", "/?owner=0");

  expect(syncOwnerFlag()).toBe(false);
  expect(localStorage.getItem(OWNER_STORAGE_KEY)).toBeNull();
  expect(window.location.search).toBe("");
});

it("keeps the stored flag when no parameter is present", () => {
  localStorage.setItem(OWNER_STORAGE_KEY, "1");
  window.history.replaceState(null, "", "/routes");

  expect(syncOwnerFlag()).toBe(true);
  expect(window.location.pathname).toBe("/routes");
});

it("records and consumes the search start", () => {
  markSearchStart(1000);

  expect(takeSearchStart()).toBe(1000);
  expect(takeSearchStart()).toBeNull();
  expect(sessionStorage.getItem(SEARCH_STARTED_KEY)).toBeNull();
});

it("ignores a malformed search start", () => {
  sessionStorage.setItem(SEARCH_STARTED_KEY, "abc");

  expect(takeSearchStart()).toBeNull();
  expect(sessionStorage.getItem(SEARCH_STARTED_KEY)).toBeNull();
});
