import { useState } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import OriginSelector from "../OriginSelector";
import type { Location } from "@/types/core";

const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockRouterPush }) }));
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

describe("OriginSelector", () => {
  beforeEach(() => { jest.clearAllMocks(); mockFetch.mockReset(); mockGeolocation.getCurrentPosition.mockReset(); });

  it("出発地のfieldsetとラベル、検索submit、GPSの可視名を提供する", () => {
    const { container } = render(<Selector />);
    const group = screen.getByRole("group", { name: "出発地" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group.querySelector("legend")).toHaveTextContent("出発地");
    const input = screen.getByRole("textbox", { name: "出発地" });
    const search = within(group).getByRole("button", { name: "検索" });
    expect(search).toHaveAttribute("type", "submit");
    expect(search).toHaveAttribute("aria-label", "検索");
    expect(search.textContent?.trim()).toBe("");
    expect(search.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(search.closest("form")).toContainElement(input);
    const gps = within(group).getByRole("button", { name: "端末のGPSを許可する" });
    expect(gps).toHaveTextContent("端末のGPSを許可する");
    expect(gps).not.toHaveAttribute("aria-label");
    expect(gps).toHaveAttribute("type", "button");
    expect(container.querySelector(".card")).toBeNull();
  });

  it("Enterの検索は先頭候補を同じfieldsetに確定し、なおすで入力へフォーカスする", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, results: [
      { lat: 35.68, lng: 139.76, formattedAddress: "先頭の住所" },
      { lat: 36, lng: 140, formattedAddress: "二番目" },
    ] }) });
    render(<Selector />);
    await submitAddress();
    const selected = await screen.findByTestId("selected-origin");
    expect(selected.tagName).toBe("P");
    expect(selected).toHaveTextContent("先頭の住所");
    const group = screen.getByRole("group", { name: "出発地" });
    expect(group).toContainElement(selected);
    expect(group).toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(within(group).getByRole("button", { name: "なおす" }));
    expect(screen.getByRole("textbox", { name: "出発地" })).toHaveFocus();
    expect(screen.queryByTestId("selected-origin")).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(`/api/geocode?address=${encodeURIComponent("千代田区 神田駅")}`);
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

  it("GPS取得は住所フォームを送信せず、住所の逆引き結果を確定する", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(success => success({ coords: { latitude: 35.68, longitude: 139.76 } }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, results: [{ formattedAddress: "GPS住所" }] }) });
    render(<Selector />);
    const submit = jest.fn();
    document.querySelector("form")!.addEventListener("submit", submit);
    fireEvent.click(screen.getByRole("button", { name: "端末のGPSを許可する" }));
    expect(await screen.findByTestId("selected-origin")).toHaveTextContent("GPS住所");
    expect(mockFetch).toHaveBeenCalledWith("/api/geocode?address=35.68,139.76");
    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
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
    expect(screen.getByRole("button", { name: "検索" })).not.toBeDisabled();
  });

  it("空の住所では取得せず入力のエラーを表示する", async () => {
    render(<Selector />);
    fireEvent.submit(screen.getByRole("button", { name: "検索" }).closest("form")!);
    expect(await screen.findByText("住所を入力してください")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "出発地" })).toHaveAttribute("aria-invalid", "true");
  });

  it("逆引きの429でも利用制限へ案内し地点を確定しない", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(success => success({ coords: { latitude: 35.68, longitude: 139.76 } }));
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ limitExceeded: true }) });
    render(<Selector />);
    fireEvent.click(screen.getByRole("button", { name: "端末のGPSを許可する" }));
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/rate-limit?source=home"));
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("selected-origin")).not.toBeInTheDocument();
  });

  it("429では一度だけ利用制限へ案内する", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ limitExceeded: true }) });
    const view = render(<Selector />);
    await submitAddress();
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/rate-limit?source=home"));
    view.rerender(<Selector />);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "出発地" })).toHaveValue("神田駅");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
