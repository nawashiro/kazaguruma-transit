"use client";

import { KeyboardEvent, useRef } from "react";

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string) => void;
  idPrefix?: string;
  activePanelId?: string;
  ariaLabel?: string;
}

const getCategoryId = (idPrefix: string, category: string) =>
  `${idPrefix}-${category.replace(/\s+/g, "-")}`;

export default function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
  idPrefix = "category",
  activePanelId,
  ariaLabel = "カテゴリ",
}: CategoryTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = activeCategory
    ? categories.indexOf(activeCategory)
    : -1;
  const focusIndex = activeIndex >= 0 ? activeIndex : 0;

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % categories.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + categories.length) % categories.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = categories.length - 1;
    }

    if (nextIndex === undefined || categories.length === 0) return;

    event.preventDefault();
    onCategoryChange(categories[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="tabs tabs-box" role="tablist" aria-label={ariaLabel}>
      {categories.map((category, index) => {
        const isActive = activeCategory === category;

        return (
          <button
            key={category}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={getCategoryId(idPrefix, category)}
            type="button"
            className={`tab px-4 ${isActive ? "tab-active" : ""}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={activePanelId}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => onCategoryChange(category)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className="ruby-text">{category}</span>
          </button>
        );
      })}
    </div>
  );
}
