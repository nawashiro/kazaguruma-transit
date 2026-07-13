import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CategoryTabs from "../CategoryTabs";

describe("CategoryTabs", () => {
  const categories = ["病院", "公共施設", "駅"];

  it("カテゴリをDaisyUIのtabs-boxとして表示する", () => {
    render(
      <CategoryTabs
        categories={categories}
        activeCategory="公共施設"
        onCategoryChange={jest.fn()}
      />
    );

    expect(screen.getByRole("tablist")).toHaveClass("tabs", "tabs-box");
    expect(screen.getAllByRole("tab")).toHaveLength(categories.length);
    expect(screen.getByRole("tab", { name: "公共施設" })).toHaveClass(
      "tab",
      "tab-active"
    );
  });

  it("選択中のタブだけをTabキーの移動先にする", () => {
    render(
      <CategoryTabs
        categories={categories}
        activeCategory="公共施設"
        onCategoryChange={jest.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: "病院" })).toHaveAttribute(
      "tabindex",
      "-1"
    );
    expect(screen.getByRole("tab", { name: "公共施設" })).toHaveAttribute(
      "tabindex",
      "0"
    );
  });

  it("矢印キーでタブを選択してフォーカスを移動する", () => {
    const onCategoryChange = jest.fn();
    render(
      <CategoryTabs
        categories={categories}
        activeCategory="病院"
        onCategoryChange={onCategoryChange}
      />
    );

    const firstTab = screen.getByRole("tab", { name: "病院" });
    const secondTab = screen.getByRole("tab", { name: "公共施設" });
    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: "ArrowRight" });

    expect(onCategoryChange).toHaveBeenCalledWith("公共施設");
    expect(secondTab).toHaveFocus();
  });
});
