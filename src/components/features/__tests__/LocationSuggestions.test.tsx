import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import type { AddressCategory, AddressLocation } from "@/utils/addressLoader";
import LocationSuggestions from "../LocationSuggestions";

const facility: AddressLocation = {
  name: "千代田区役所のとても長い施設名と地域福祉交通の総合相談窓口ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lat: 35.694,
  lng: 139.753,
  copyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};
const categories: AddressCategory[] = [
  { category: "公共施設と地域福祉交通の長いカテゴリ名ABCDEFGHIJKLMNOPQRSTUVWXYZ", "category:en": "public", locations: [facility] },
  { category: "医療機関", "category:en": "medical", locations: [{ ...facility, name: "病院" }] },
];

jest.mock("@/components/ui/RubyWrapper", () => ({ __esModule: true, default: () => null }));

function renderSuggestions(onLocationSelected = jest.fn()) {
  return render(<LocationSuggestions categories={categories} onLocationSelected={onLocationSelected} />);
}

describe("LocationSuggestions", () => {
  it("注入されたカテゴリを初期閉鎖の独立したdetailsとsummaryで表示し、追加取得しない", () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    try {
      const { container } = renderSuggestions();
      const details = container.querySelectorAll("details");
      expect(details).toHaveLength(2);
      details.forEach((detail, index) => {
        expect(detail.open).toBe(false);
        expect(detail.firstElementChild?.tagName).toBe("SUMMARY");
        expect(detail.firstElementChild).toHaveTextContent(categories[index].category);
        expect(detail).toHaveAttribute("name", "facility-categories");
      });
      expect(container.querySelector('[role="tablist"], [role="tab"], [role="tabpanel"]')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("カテゴリのdetailsはdaisyUIのcollapse表現でクリック可能に見える", () => {
    const { container } = renderSuggestions();
    for (const detail of Array.from(container.querySelectorAll("details"))) {
      expect(detail).toHaveClass("collapse", "collapse-arrow");
      const summary = detail.firstElementChild!;
      expect(summary.tagName).toBe("SUMMARY");
      expect(summary).toHaveClass("collapse-title");
      expect(detail.querySelector(".collapse-content")).toContainElement(detail.querySelector("ul"));
    }
  });

  it("カテゴリは同名のnameグループで開閉し、施設をulとliのボタンとして提供する", async () => {
    const user = userEvent.setup();
    const { container } = renderSuggestions();
    const details = container.querySelectorAll("details");
    await user.click(screen.getByText(categories[0].category));
    expect(details[0].open).toBe(true);
    const list = within(details[0]).getByRole("list");
    expect(list.tagName).toBe("UL");
    const item = within(list).getByRole("listitem");
    expect(item.tagName).toBe("LI");
    expect(within(item).getByRole("button")).toHaveAttribute("type", "button");
    await user.click(screen.getByText(categories[0].category));
    expect(details[0].open).toBe(false);
  });

  it("カテゴリを開いた後、施設ボタンをEnterで選択できる", async () => {
    const user = userEvent.setup();
    const onLocationSelected = jest.fn();
    const { container } = renderSuggestions(onLocationSelected);
    const summary = container.querySelector("summary");
    expect(summary).not.toBeNull();
    await user.click(summary!);
    const button = screen.getByRole("button", { name: facility.name });
    button.focus();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onLocationSelected).toHaveBeenCalledWith({ lat: facility.lat, lng: facility.lng, address: facility.name });
  });

  it("長い施設名を全文表示し、ピン・省略・高さ制限・内部スクロールを持たない", () => {
    const { container } = renderSuggestions();
    fireEvent.click(screen.getByText(categories[0].category));
    const button = screen.getByRole("button", { name: facility.name });
    expect(button).toHaveTextContent(facility.name);
    expect(button).toHaveClass("min-h-[44px]", "w-full", "text-base", "whitespace-normal", "break-words", "text-start");
    expect(container.querySelector("svg")).toBeNull();
    container.querySelectorAll("*").forEach((element) => {
      expect(element.className).not.toMatch(/truncate|line-clamp|overflow-|max-h-|whitespace-nowrap|\bh-\d/);
      expect(element.getAttribute("style") || "").not.toMatch(/max-height|overflow|text-overflow/);
    });
  });

  it("施設データがない場合も一覧取得せず表示できる", () => {
    const { container } = render(<LocationSuggestions onLocationSelected={jest.fn()} />);
    expect(screen.getByText("よく利用される施設から選択")).toBeInTheDocument();
    expect(container.querySelector("details")).toBeNull();
  });
});
