/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";

const mockRouterPush = jest.fn();
const ANNOUNCEMENT_INFORMATION =
  "運行情報の更新";
const ANNOUNCEMENT_URL = "/service-update";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/lib/config/app-config", () => ({
  appConfig: {
    announcement: {
      information: "運行情報の更新",
      url: "/service-update",
    },
  },
}));

jest.mock("@/components/features/DateTimeSelector", () =>
  ({ onDateTimeSelected }: any) => (
    <button
      data-testid="mock-date-time-selector"
      onClick={() =>
        onDateTimeSelected({ dateTime: "2026-07-18T09:30", isDeparture: true })
      }
    />
  ),
);

jest.mock("@/components/features/OriginSelector", () =>
  ({ onOriginSelected }: any) => (
    <button
      data-testid="mock-origin-selector"
      onClick={() => onOriginSelected({ lat: 35.68, lng: 139.76, address: "テスト住所" })}
    />
  ),
);

jest.mock("@/components/features/DestinationSelector", () =>
  ({ onDestinationSelected }: any) => (
    <button
      data-testid="mock-destination-selector"
      onClick={() =>
        onDestinationSelected({ lat: 35.7, lng: 139.78, address: "テスト目的地" })
      }
    />
  ),
);

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    global.fetch = jest.fn();
  });

  it("PageHeaderに風ぐるまの自動案内サイトの説明を表示する", () => {
    render(<Home />);

    expect(screen.getByRole("banner")).toHaveTextContent(
      "千代田区地域福祉交通「風ぐるま」の自動案内サイト",
    );
  });

  it("運営からのお知らせをh2見出しとして表示する", () => {
    render(<Home />);

    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "運営からのお知らせ",
      }),
    ).toBeInTheDocument();
  });

  it("お知らせ見出しを含むsectionが見出しIDを参照する", () => {
    render(<Home />);

    const heading = screen.queryByRole("heading", {
      level: 2,
      name: "運営からのお知らせ",
    });
    const section = heading?.closest("section") ?? null;

    expect(section).not.toBeNull();
    expect(heading?.id).toBeTruthy();
    expect(section?.getAttribute("aria-labelledby")).toBe(heading?.id);
  });

  it("お知らせ見出し内のInfoアイコンを装飾用として扱う", () => {
    render(<Home />);

    const heading = screen.queryByRole("heading", {
      level: 2,
      name: "運営からのお知らせ",
    });
    const icon = heading?.querySelector("svg.lucide-info") ?? null;

    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("お知らせカードをPageHeader直後の既存カード構造として表示する", () => {
    render(<Home />);

    const banner = screen.getByRole("banner");
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "運営からのお知らせ",
    });
    const section = heading.closest("section");

    expect(section).not.toBeNull();
    if (!section) {
      throw new Error("お知らせ見出しを含むsectionがありません");
    }

    expect(section).toHaveClass(
      "card",
      "card-border",
      "w-full",
      "bg-base-100",
      "shadow-sm",
    );

    // Homeの既存mb-6ラッパーを維持し、ラッパー直下に告知sectionを置く。
    const announcementSlot = section.parentElement;
    expect(announcementSlot).not.toBeNull();
    expect(banner.nextElementSibling).toBe(announcementSlot);
    expect(announcementSlot?.firstElementChild).toBe(section);
  });

  it("設定されたお知らせ文言をリンクの表示テキストとhrefにする", () => {
    render(<Home />);

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "運営からのお知らせ",
    });
    const section = heading.closest("section");

    expect(section).not.toBeNull();
    if (!section) {
      throw new Error("お知らせ見出しを含むsectionがありません");
    }

    const link = within(section).getByRole("link", {
      name: ANNOUNCEMENT_INFORMATION,
    });

    expect(link.textContent?.trim()).toBe(ANNOUNCEMENT_INFORMATION);
    expect(link.getAttribute("href")).toBe(ANNOUNCEMENT_URL);
  });

  it("Homeに旧受賞名と賞名を表示しない", () => {
    render(<Home />);

    expect(
      screen.queryByText("都知事杯オープンデータ・ハッカソン2025"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("行政課題解決賞を受賞しました"),
    ).not.toBeInTheDocument();
  });

  it("Homeに旧受賞バッジ画像を表示しない", () => {
    render(<Home />);

    expect(
      screen.queryByRole("img", { name: "行政課題解決賞のオープンバッジ" }),
    ).not.toBeInTheDocument();
  });

  it("Homeに旧受賞詳細リンクを表示しない", () => {
    render(<Home />);

    expect(
      screen.queryByRole("link", { name: "受賞について詳しく見る" }),
    ).not.toBeInTheDocument();
  });

  it("目的地、出発地、日時を順に入力する", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    expect(screen.getByTestId("mock-origin-selector")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    expect(screen.getByTestId("mock-date-time-selector")).toBeInTheDocument();
    expect(screen.getByText("テスト目的地")).toBeInTheDocument();
    expect(screen.getByText("テスト住所")).toBeInTheDocument();
  });

  it("検索条件をGET結果ページURLへ渡し、入力ページではfetchしない", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    fireEvent.click(screen.getByTestId("mock-date-time-selector"));
    fireEvent.click(screen.getByTestId("search-route"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/routes?origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("はやさ優先をURLへ明示して端末設定に依存させない", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    fireEvent.click(screen.getByTestId("mock-date-time-selector"));
    fireEvent.click(screen.getByRole("checkbox", { name: "はやさ優先" }));
    fireEvent.click(screen.getByTestId("search-route"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("prioritizeSpeed=true"),
    );
  });

  it("リセットで目的地入力へ戻る", () => {
    render(<Home />);
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByRole("button", { name: "検索条件をリセット" }));

    expect(screen.getByTestId("mock-destination-selector")).toBeInTheDocument();
  });
});
