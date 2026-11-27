import { useState } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import OriginSelector from "../OriginSelector";
import { track } from "@/lib/analytics/tracking";
import type { Location } from "@/types/core";

jest.mock("@/lib/analytics/tracking", () => ({ track: jest.fn() }));

const mockFetch = jest.fn();
global.fetch = mockFetch;
const mockGeolocation = { getCurrentPosition: jest.fn() };
Object.defineProperty(navigator, "geolocation", { value: mockGeolocation, configurable: true });

function Selector({ validationError }: { validationError?: string }) {
  const [selected, setSelected] = useState<Location | null>(null);
  return <OriginSelector selectedLocation={selected} onOriginSelected={setSelected} onEdit={() => setSelected(null)} validationError={validationError} />;
}

async function submitAddress() {
  await userEvent.setup().type(screen.getByRole("textbox", { name: "出発地" }), "神田駅{Enter}");
}

function candidatesResponse(results: Array<{ name: string; address: string; lat: number; lng: number; kind: string }>) {
  return { ok: true, json: async () => ({ success: true, results }) };
}

const TWO_CANDIDATES = [
  { name: "神田駅", address: "千代田区鍛冶町二丁目6番", lat: 35.68, lng: 139.76, kind: "station" },
  { name: "神田駅前", address: "千代田区内神田三丁目13番", lat: 35.69, lng: 139.77, kind: "other" },
];

describe("OriginSelector", () => {
  beforeEach(() => { jest.clearAllMocks(); mockFetch.mockReset(); mockGeolocation.getCurrentPosition.mockReset(); });

  it("出発地のfieldsetとラベル、GPSの可視名を提供する", () => {
    const { container } = render(<Selector />);
    const group = screen.getByRole("group", { name: "出発地" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group.querySelector("legend")).toHaveTextContent("出発地");
    const input = screen.getByRole("textbox", { name: "出発地" });
    expect(within(group).queryByRole("button", { name: "検索" })).not.toBeInTheDocument();
    expect(input.closest("form")).toContainElement(input);
    const gps = within(group).getByRole("button", { name: "端末のGPSを許可する" });
    expect(gps).toHaveTextContent("端末のGPSを許可する");
    expect(gps).toHaveAccessibleName("端末のGPSを許可する");
    expect(gps).toHaveAttribute("type", "button");
    expect(container.querySelector(".card")).toBeNull();
  });

  it("Enterの検索は候補を一覧にし、選んだ候補だけを確定する", async () => {
    mockFetch.mockResolvedValueOnce(candidatesResponse(TWO_CANDIDATES));
    render(<Selector />);
    await submitAddress();
    const group = screen.getByRole("group", { name: "出発地" });
    const list = await within(group).findByRole("list", { name: "出発地の候補" });
    const options = within(list).getAllByRole("button", { name: /神田駅/ });
    expect(options).toHaveLength(2);
    expect(screen.queryByTestId("selected-origin")).not.toBeInTheDocument();

    fireEvent.click(options[1]);

    const selected = await screen.findByTestId("selected-origin");
    expect(selected.tagName).toBe("P");
    expect(selected).toHaveTextContent("神田駅前");
    expect(group).toContainElement(selected);
    expect(group).toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(within(group).getByRole("button", { name: "なおす" }));
    expect(screen.getByRole("textbox", { name: "出発地" })).toHaveFocus();
    expect(screen.queryByTestId("selected-origin")).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(`/api/geocode?q=${encodeURIComponent("神田駅")}`);
  });

  it.each(["empty", "network", "api"])("%sの失敗は入力を保持しエラーを関連付ける", async kind => {
    if (kind === "network") mockFetch.mockRejectedValueOnce(new Error("通信に失敗しました"));
    else mockFetch.mockResolvedValueOnce({ ok: kind === "empty", json: async () => kind === "empty" ? { success: true, results: [] } : { error: "住所検索に失敗しました" } });
    render(<Selector />);
    await submitAddress();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "出発地" })).toHaveAttribute("aria-invalid", "true"));
    const input = screen.getByRole("textbox", { name: "出発地" });
    expect(input).toHaveValue("神田駅");
    expect(input).toHaveAccessibleDescription(expect.stringMatching(/失敗|見つかりません|ありません/));
    expect(screen.queryByTestId("selected-origin")).not.toBeInTheDocument();
  });

  it("未確定地点のエラーを入力へ関連付ける", () => {
    render(<Selector validationError="出発地を確定してください" />);
    const input = screen.getByRole("textbox", { name: "出発地" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("出発地を確定してください"));
  });

  it("住所欄に住所か建物名の入力を促し、建物名だけの案内を残さない", () => {
    render(<Selector />);
    const input = screen.getByRole("textbox", { name: "出発地" });
    expect(input).toHaveAccessibleDescription(expect.stringContaining("住所か建物名を入力してください。"));
    expect(input).not.toHaveAccessibleDescription(expect.stringContaining("建物名だけでも大丈夫な場合がほとんどです。"));
  });

  it("GPS取得は住所フォームを送信せず、住所の逆引き結果を確定する", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(success => success({ coords: { latitude: 35.68, longitude: 139.76 } }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, location: { lat: 35.68, lng: 139.76, address: "GPS住所" } }) });
    render(<Selector />);
    const submit = jest.fn();
    document.querySelector("form")!.addEventListener("submit", submit);
    fireEvent.click(screen.getByRole("button", { name: "端末のGPSを許可する" }));
    expect(await screen.findByTestId("selected-origin")).toHaveTextContent("GPS住所");
    expect(mockFetch).toHaveBeenCalledWith("/api/geocode?lat=35.68&lng=139.76");
    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("gps_result", { outcome: "granted" });
    expect(track).toHaveBeenCalledWith("place_select", { field: "origin", source: "gps" });
  });

  it("逆引きだけが失敗しても取得済み座標を確定する", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(success => success({ coords: { latitude: 35.68, longitude: 139.76 } }));
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    render(<Selector />);
    fireEvent.click(screen.getByRole("button", { name: "端末のGPSを許可する" }));
    expect(await screen.findByTestId("selected-origin")).toHaveTextContent(/35\.68.*139\.76/);
    expect(screen.getByRole("button", { name: "なおす" })).toBeInTheDocument();
  });

  it("GPS拒否後も名前検索と入力内容を利用できる", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => error({ message: "User denied Geolocation" }));
    render(<Selector />);
    fireEvent.change(screen.getByRole("textbox", { name: "出発地" }), { target: { value: "神田駅" } });
    fireEvent.click(screen.getByRole("button", { name: "端末のGPSを許可する" }));
    expect(await screen.findByText(/位置情報の取得に失敗しました/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "出発地" })).toHaveValue("神田駅");
    expect(screen.getByRole("textbox", { name: "出発地" })).not.toBeDisabled();
    expect(track).toHaveBeenCalledWith("gps_result", { outcome: "denied" });
  });

  it("GPSのタイムアウトを区別して記録する", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => error({ code: 3, message: "Timeout" }));
    render(<Selector />);
    fireEvent.click(screen.getByRole("button", { name: "端末のGPSを許可する" }));
    await waitFor(() => expect(track).toHaveBeenCalledWith("gps_result", { outcome: "timeout" }));
  });

  it("GPS非対応のブラウザを記録する", async () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    try {
      render(<Selector />);
      fireEvent.click(screen.getByRole("button", { name: "端末のGPSを許可する" }));
      await waitFor(() => expect(track).toHaveBeenCalledWith("gps_result", { outcome: "unsupported" }));
    } finally {
      Object.defineProperty(navigator, "geolocation", { value: mockGeolocation, configurable: true });
    }
  });

  it("空の住所では取得せず入力のエラーを表示する", async () => {
    render(<Selector />);
    fireEvent.submit(screen.getByRole("textbox", { name: "出発地" }).closest("form")!);
    expect(await screen.findByText("住所を入力してください")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "出発地" })).toHaveAttribute("aria-invalid", "true");
  });
});
