import { useState } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import DestinationSelector from "../DestinationSelector";
import { track } from "@/lib/analytics/tracking";
import type { Location } from "@/types/core";

jest.mock("@/lib/analytics/tracking", () => ({ track: jest.fn() }));

const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockRouterPush }) }));
const mockFetch = jest.fn();
global.fetch = mockFetch;
const location: Location = { lat: 35.694, lng: 139.753, address: "千代田区役所" };
const categories = [{ category: "公共施設", categoryId: "1302", locations: [{ name: location.address!, lat: location.lat, lng: location.lng }] }];

function Selector({ validationError }: { validationError?: string }) {
  const [selected, setSelected] = useState<Location | null>(null);
  return <DestinationSelector categories={categories} selectedLocation={selected} onDestinationSelected={setSelected} onEdit={() => setSelected(null)} validationError={validationError} />;
}

async function submitAddress(value = "神田駅") {
  await userEvent.setup().type(screen.getByRole("textbox", { name: "目的地" }), `${value}{Enter}`);
}

function expectInputError() {
  const input = screen.getByRole("textbox", { name: "目的地" });
  expect(input).toHaveAttribute("aria-invalid", "true");
  const ids = input.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
  expect(ids.some(id => document.getElementById(id)?.textContent?.match(/失敗|見つかりません|ありません|確定/))).toBe(true);
  expect(input).toHaveValue("神田駅");
}

describe("DestinationSelector", () => {
  beforeEach(() => { jest.clearAllMocks(); mockFetch.mockReset(); });

  it("目的地のlegendとlabelを持ち、アイコンのみの検索submitを提供する", () => {
    const { container } = render(<Selector />);
    const group = screen.getByRole("group", { name: "目的地" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group.querySelector("legend")).toHaveTextContent("目的地");
    const input = screen.getByRole("textbox", { name: "目的地" });
    const button = within(group).getByRole("button", { name: "検索" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-label", "検索");
    expect(button.textContent?.trim()).toBe("");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button.closest("form")).toContainElement(input);
    expect(container.querySelector(".card")).toBeNull();
  });

  it("名前で検索をよく使う施設より先に表示する", () => {
    render(<Selector />);
    const group = screen.getByRole("group", { name: "目的地" });
    const form = screen.getByRole("textbox", { name: "目的地" }).closest("form")!;
    const suggestions = screen.getByText("よく利用される施設から選択");
    expect(group).toContainElement(form);
    expect(group).toContainElement(suggestions);
    expect(form.compareDocumentPosition(suggestions) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("Enterで検索し、候補を一覧にして選んだ1件だけを確定する", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, results: [
      { name: location.address, address: "千代田区九段南一丁目2番", lat: location.lat, lng: location.lng, kind: "public" },
      { name: "千代田区役所 食堂", address: "千代田区九段南一丁目2番", lat: 36, lng: 140, kind: "food" },
    ] }) });
    render(<Selector />);
    await submitAddress();
    const group = screen.getByRole("group", { name: "目的地" });
    expect(screen.queryByTestId("selected-destination")).not.toBeInTheDocument();
    const candidateList = await within(group).findByRole("list", { name: "目的地の候補から選ぶ" });
    const options = within(candidateList).getAllByRole("button");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("千代田区役所");
    expect(options[0]).toHaveTextContent("千代田区九段南一丁目2番");

    fireEvent.click(options[0]);

    const selected = await screen.findByTestId("selected-destination");
    expect(selected.tagName).toBe("P");
    expect(selected).toHaveTextContent("千代田区役所");
    expect(group).toContainElement(selected);
    const edit = within(group).getByRole("button", { name: "なおす" });
    expect(group).toContainElement(document.activeElement as HTMLElement);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`/api/geocode?q=${encodeURIComponent("神田駅")}`);
    expect(track).toHaveBeenCalledWith("place_search", { field: "destination", outcome: "found" });
    expect(track).toHaveBeenCalledWith("place_select", { field: "destination", source: "address" });
    fireEvent.click(edit);
    expect(screen.getByRole("textbox", { name: "目的地" })).toHaveFocus();
    expect(screen.queryByTestId("selected-destination")).not.toBeInTheDocument();
  });

  it("注入された施設を選ぶと同じグループに確定しブラウザ取得しない", () => {
    render(<Selector />);
    fireEvent.click(screen.getByText("公共施設", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "千代田区役所" }));
    expect(within(screen.getByRole("group", { name: "目的地" })).getByTestId("selected-destination")).toHaveTextContent("千代田区役所");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("place_select", { field: "destination", source: "catalog" });
  });

  it.each(["empty", "network", "api"])("%sの失敗は入力を保持しエラーを関連付ける", async kind => {
    if (kind === "network") mockFetch.mockRejectedValueOnce(new Error("通信に失敗しました"));
    else mockFetch.mockResolvedValueOnce({ ok: kind === "empty", json: async () => kind === "empty" ? { success: true, results: [] } : { error: "住所検索に失敗しました" } });
    render(<Selector />);
    await submitAddress();
    await waitFor(expectInputError);
    expect(screen.queryByTestId("selected-destination")).not.toBeInTheDocument();
  });

  it("未確定地点の検証エラーを入力へ関連付ける", () => {
    render(<Selector validationError="目的地を確定してください" />);
    const input = screen.getByRole("textbox", { name: "目的地" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("目的地を確定してください"));
  });

  it("空の住所では取得せず入力のエラーを表示する", async () => {
    render(<Selector />);
    fireEvent.submit(screen.getByRole("button", { name: "検索" }).closest("form")!);
    expect(await screen.findByText("住所を入力してください")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "目的地" })).toHaveAttribute("aria-invalid", "true");
  });

  it("429では一度だけ利用制限へ案内する", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ limitExceeded: true }) });
    const view = render(<Selector />);
    await submitAddress();
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/rate-limit?source=home"));
    view.rerender(<Selector />);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "目的地" })).toHaveValue("神田駅");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
