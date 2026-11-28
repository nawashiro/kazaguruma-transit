import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import type {
  RouteDestinationCategory,
  RouteDestinationLocation,
} from "@/types/route-destinations";
import LocationSuggestions from "../LocationSuggestions";

const facility: RouteDestinationLocation = {
  name: "千代田区役所のとても長い施設名と地域福祉交通の総合相談窓口ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lat: 35.694,
  lng: 139.753,
};
const categories: RouteDestinationCategory[] = [
  { category: "公共施設と地域福祉交通の長いカテゴリ名ABCDEFGHIJKLMNOPQRSTUVWXYZ", categoryId: "1302", locations: [facility] },
  { category: "医療機関", categoryId: "1606", locations: [{ ...facility, name: "病院" }] },
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

  it("500mを超える施設にだけ警告を付け、距離の数値は出さない", () => {
    const walkCategories: RouteDestinationCategory[] = [
      {
        category: "文化施設",
        categoryId: "0801",
        locations: [
          { name: "科学技術館", lat: 35.6915, lng: 139.7531, walkMeters: 535 },
          { name: "近い施設", lat: 35.694, lng: 139.753, walkMeters: 450 },
        ],
      },
    ];
    render(
      <LocationSuggestions categories={walkCategories} onLocationSelected={jest.fn()} />,
    );
    fireEvent.click(screen.getByText("文化施設"));

    expect(screen.getByRole("button", { name: /科学技術館/ })).toHaveTextContent(
      "バス停から遠い",
    );
    expect(screen.getByRole("button", { name: /近い施設/ })).not.toHaveTextContent(
      "バス停から",
    );
    expect(screen.queryByText(/\d+m$/)).not.toBeInTheDocument();
    expect(screen.queryAllByText("バス停から遠い")).toHaveLength(1);
  });

  it("徒歩距離があっても750m以内なら選べる", () => {
    const onLocationSelected = jest.fn();
    const walkCategories: RouteDestinationCategory[] = [
      {
        category: "文化施設",
        categoryId: "0801",
        locations: [
          { name: "科学技術館", lat: 35.6915, lng: 139.7531, walkMeters: 535 },
        ],
      },
    ];
    render(
      <LocationSuggestions
        categories={walkCategories}
        onLocationSelected={onLocationSelected}
      />,
    );
    fireEvent.click(screen.getByText("文化施設"));
    fireEvent.click(screen.getByRole("button", { name: /科学技術館/ }));

    expect(onLocationSelected).toHaveBeenCalledWith({
      lat: 35.6915,
      lng: 139.7531,
      address: "科学技術館",
    });
  });
});
