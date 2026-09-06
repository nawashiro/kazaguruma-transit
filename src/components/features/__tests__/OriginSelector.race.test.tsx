import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Location } from "@/types/core";
import OriginSelector from "../OriginSelector";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => mockRouterPush(url),
  }),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const originalFetch = global.fetch;
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockGetCurrentPosition = jest.fn<
  void,
  [PositionCallback, PositionErrorCallback?, PositionOptions?]
>();
const mockGeolocation: Pick<Geolocation, "getCurrentPosition"> = {
  getCurrentPosition: mockGetCurrentPosition,
};
let originalGeolocationDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockGetCurrentPosition.mockReset();
  originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "geolocation",
  );
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: mockGeolocation,
    writable: true,
  });
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
  if (originalGeolocationDescriptor) {
    Object.defineProperty(
      navigator,
      "geolocation",
      originalGeolocationDescriptor,
    );
  } else {
    delete (navigator as unknown as { geolocation?: Geolocation }).geolocation;
  }
});

describe("OriginSelector race safety", () => {
  it("保留中のGPS逆ジオコードはアンマウント後に地点選択を適用しない", async () => {
    const gpsPosition: GeolocationPosition = {
      coords: {
        latitude: 35.681236,
        longitude: 139.767125,
        accuracy: 1,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 0,
      toJSON: () => ({}),
    };
    const gpsLocation: Location = {
      lat: gpsPosition.coords.latitude,
      lng: gpsPosition.coords.longitude,
      address: "GPSの住所",
    };
    const reverseUrl = `/api/geocode?address=${gpsLocation.lat},${gpsLocation.lng}`;
    const reverseRequest = createDeferred<Response>();
    const onOriginSelected = jest.fn();

    mockFetch.mockImplementation((input) => {
      const url = String(input);
      if (url === reverseUrl) return reverseRequest.promise;
      return Promise.reject(new Error(`Unexpected geocoding URL: ${url}`));
    });
    mockGetCurrentPosition.mockImplementation((success) => {
      void success(gpsPosition);
    });

    const { unmount } = render(
      <OriginSelector onOriginSelected={onOriginSelected} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "端末のGPSを許可する" }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(reverseUrl);

    unmount();

    await act(async () => {
      reverseRequest.resolve(
        createJsonResponse({
          success: true,
          results: [
            {
              lat: gpsLocation.lat,
              lng: gpsLocation.lng,
              formattedAddress: gpsLocation.address,
            },
          ],
        }),
      );
      await reverseRequest.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onOriginSelected).not.toHaveBeenCalled();
  });
});
