import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { Location } from "@/types/core";
import type { GeocodingSearchResult } from "@/lib/location/geocoding-search";
import { useGeocodingSearch } from "../useGeocodingSearch";

const mockSearchGeocoding = jest.fn<
  Promise<GeocodingSearchResult>,
  [string]
>();
const mockRouterPush = jest.fn();

jest.mock("@/lib/location/geocoding-search", () => ({
  __esModule: true,
  searchGeocoding: (address: string) => mockSearchGeocoding(address),
}));

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

type HookState = {
  loading: boolean;
  error: string | null;
};

interface HookHarnessProps {
  onSelected: (location: Location) => void;
  onStateChange?: (state: HookState) => void;
}

function HookHarness({ onSelected, onStateChange }: HookHarnessProps) {
  const [address, setAddress] = useState("");
  const { error, loading, search } = useGeocodingSearch(onSelected);

  useEffect(() => {
    onStateChange?.({ loading, error });
  }, [error, loading, onStateChange]);

  return (
    <div>
      <label htmlFor="geocoding-address">住所</label>
      <input
        id="geocoding-address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
      <button type="button" onClick={() => void search(address)}>
        検索
      </button>
      <p aria-label="検索状態">{loading ? "検索中" : "待機中"}</p>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

describe("useGeocodingSearch race safety", () => {
  beforeEach(() => {
    mockSearchGeocoding.mockReset();
    mockRouterPush.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("新しい検索が先に成功した後は、古い検索結果で選択を上書きしない", async () => {
    const oldRequest = createDeferred<GeocodingSearchResult>();
    const newRequest = createDeferred<GeocodingSearchResult>();
    const oldLocation: Location = {
      lat: 35.681236,
      lng: 139.767125,
      address: "旧住所",
    };
    const newLocation: Location = {
      lat: 35.694043,
      lng: 139.753446,
      address: "新住所",
    };
    const onSelected = jest.fn();

    mockSearchGeocoding
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => newRequest.promise);

    render(<HookHarness onSelected={onSelected} />);
    const addressInput = screen.getByRole("textbox", { name: "住所" });
    const searchButton = screen.getByRole("button", { name: "検索" });

    fireEvent.change(addressInput, { target: { value: "旧住所" } });
    fireEvent.click(searchButton);
    fireEvent.change(addressInput, { target: { value: "新住所" } });
    fireEvent.click(searchButton);

    expect(mockSearchGeocoding).toHaveBeenNthCalledWith(1, "旧住所");
    expect(mockSearchGeocoding).toHaveBeenNthCalledWith(2, "新住所");

    await act(async () => {
      newRequest.resolve({ status: "success", location: newLocation });
      await newRequest.promise;
    });

    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenLastCalledWith(newLocation);

    await act(async () => {
      oldRequest.resolve({ status: "success", location: oldLocation });
      await oldRequest.promise;
    });

    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenLastCalledWith(newLocation);
  });

  it("保留中の検索はアンマウント後に選択と状態更新を適用しない", async () => {
    const pendingRequest = createDeferred<GeocodingSearchResult>();
    const onSelected = jest.fn();
    const onStateChange = jest.fn<void, [HookState]>();

    mockSearchGeocoding.mockImplementationOnce(() => pendingRequest.promise);

    const view = render(
      <HookHarness onSelected={onSelected} onStateChange={onStateChange} />,
    );
    const addressInput = screen.getByRole("textbox", { name: "住所" });
    const searchButton = screen.getByRole("button", { name: "検索" });

    fireEvent.change(addressInput, { target: { value: "保留中の住所" } });
    fireEvent.click(searchButton);
    const stateChangesAtUnmount = onStateChange.mock.calls.length;

    view.unmount();

    await act(async () => {
      pendingRequest.resolve({
        status: "success",
        location: {
          lat: 35.7,
          lng: 139.7,
          address: "アンマウント後の住所",
        },
      });
      await pendingRequest.promise;
    });

    expect(onSelected).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledTimes(stateChangesAtUnmount);
  });
});
