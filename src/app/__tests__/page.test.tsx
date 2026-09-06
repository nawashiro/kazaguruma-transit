/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";
import { buildRouteResultsUrl } from "@/lib/transit/route-search-query";

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

jest.mock("@/components/features/LocationSuggestions", () =>
  function MockLocationSuggestions() {
    return null;
  },
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

  it("トップページは単一のネイティブformで4セクションを最初から表示する", () => {
    render(<Home />);

    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    if (forms.length !== 1) return;

    const form = forms[0];
    expect(form.tagName).toBe("FORM");
    expect(form.querySelector("form")).toBeNull();

    const sectionNames = [
      "目的地を選ぶ",
      "出発地を選ぶ",
      "日時",
      "スピードを選ぶ",
    ];
    sectionNames.forEach((name) => {
      expect(screen.queryByRole("heading", { name: new RegExp(`^${name}$`) })).not.toBeNull();
    });
  });

  it("場所操作を先に検索へ送信せず、経路検索だけをsubmitにする", () => {
    render(<Home />);

    const form = document.querySelector("form");
    const searchButton = screen.queryByRole("button", { name: /^検索$/ });
    expect(form).not.toBeNull();
    expect(searchButton).not.toBeNull();
    if (!form || !searchButton) return;

    expect(searchButton).toHaveAttribute("type", "submit");
    Array.from(form.querySelectorAll("button"))
      .filter((button) => button !== searchButton)
      .forEach((button) => expect(button).toHaveAttribute("type", "button"));
  });

  it("有効なURL条件を表示し、読み込み時にURLを削除しない", () => {
    const search =
      "?origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false";
    window.history.replaceState({}, "", `/${search}`);

    render(<Home />);

    expect(window.location.search).toBe(search);
    expect(screen.queryByText(/35\.68/)).not.toBeNull();
    expect(screen.queryByText(/35\.7/)).not.toBeNull();
  });

  it("不正なURL項目は日本語の項目別エラーを表示し、有効な項目を保持する", () => {
    window.history.replaceState(
      {},
      "",
      "/?origin=91%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
    );

    render(<Home />);

    expect(screen.queryByText("出発地の座標が正しくありません。"))
      .not.toBeNull();
    expect(screen.queryByText(/35\.7/)).not.toBeNull();
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("有効な全条件の送信だけでbuildRouteResultsUrlへ一度遷移する", async () => {
    const query = {
      origin: { lat: 35.68, lng: 139.76 },
      destination: { lat: 35.7, lng: 139.78 },
      time: "2026-07-18T09:30",
      isDeparture: true,
      prioritizeSpeed: false,
    };
    window.history.replaceState(
      {},
      "",
      `/?${new URL(buildRouteResultsUrl(query), window.location.origin).searchParams.toString()}`,
    );

    render(<Home />);
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    if (!form) return;

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith(buildRouteResultsUrl(query));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
