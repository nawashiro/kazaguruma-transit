import React, { type ComponentType } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { LocationSuggestionCategory } from "@/types/location-pages";
import type { Location } from "@/types/core";
import { buildRouteResultsUrl } from "@/lib/transit/route-search-query";

type PublicModule = Record<string, unknown>;
type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};
type RouteSearchFormProps = {
  suggestionCategories?: LocationSuggestionCategory[];
};
type RouteSearchFormComponent = ComponentType<RouteSearchFormProps>;

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

function loadModule(modulePath: string): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded RED public-boundary loader
    const loaded: unknown = require(modulePath);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error(`Expected ${modulePath} to export an object`),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getRouteSearchForm(state: ModuleState): RouteSearchFormComponent {
  const publicName = "RouteSearchForm";
  const modulePath = "../RouteSearchForm";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const candidate = state.exports.default ?? state.exports.RouteSearchForm;
  if (typeof candidate !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} must export a component`,
    );
  }
  return candidate as RouteSearchFormComponent;
}

const routeSearchFormModuleState = loadModule("../RouteSearchForm");
const routeSearchFormAvailable =
  routeSearchFormModuleState.error === null &&
  routeSearchFormModuleState.exports !== null &&
  (typeof routeSearchFormModuleState.exports.default === "function" ||
    typeof routeSearchFormModuleState.exports.RouteSearchForm === "function");

const suggestionCategories: LocationSuggestionCategory[] = [
  {
    categoryName: "主要な病院",
    locations: [
      { name: "九段坂病院", lat: 35.6938447, lng: 139.7522986 },
      { name: "三楽病院", lat: 35.6996718, lng: 139.7613644 },
    ],
  },
  {
    categoryName: "区役所・出張所",
    locations: [{ name: "千代田区役所", lat: 35.6941626, lng: 139.7535624 }],
  },
];

const validQuery = {
  origin: { lat: 35.68, lng: 139.76 },
  destination: { lat: 35.7, lng: 139.78 },
  time: "2026-07-18T09:30",
  isDeparture: true,
  prioritizeSpeed: false,
};

function setSearch(search: string): void {
  window.history.replaceState({}, "", `/${search}`);
}

if (!routeSearchFormAvailable) {
  describe("RouteSearchForm public boundary", () => {
    it("未実装のRouteSearchFormを明示的なREDとして報告する", () => {
      const RouteSearchForm = getRouteSearchForm(routeSearchFormModuleState);
      expect(RouteSearchForm).toEqual(expect.any(Function));
    });
  });
} else {
  const RouteSearchForm = getRouteSearchForm(routeSearchFormModuleState);

  function renderForm(search = ""): ReturnType<typeof render> {
    setSearch(search);
    return render(
      React.createElement(RouteSearchForm, {
        suggestionCategories,
      }),
    );
  }

  function getSingleForm(): HTMLFormElement | null {
    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    return forms.length === 1 ? (forms[0] as HTMLFormElement) : null;
  }

  function getPriorityRadios(): [HTMLInputElement | null, HTMLInputElement | null] {
    return [
      screen.queryByRole("radio", { name: "歩きを最小限、ゆっくり行く" }) as HTMLInputElement | null,
      screen.queryByRole("radio", { name: "歩きを許可、はやく行く" }) as HTMLInputElement | null,
    ];
  }

  describe("RouteSearchForm", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      localStorage.clear();
      setSearch("");
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("外側に一つだけのネイティブformと常時表示の4セクションを持つ", () => {
      renderForm();

      const form = getSingleForm();
      if (!form) return;
      expect(form.tagName).toBe("FORM");
      expect(form.querySelector("form")).toBeNull();
      expect(form).not.toHaveAttribute("aria-live");

      const fieldsets = Array.from(form.querySelectorAll("fieldset"));
      expect(fieldsets.length).toBeGreaterThanOrEqual(2);
      fieldsets.forEach((fieldset) => {
        expect(fieldset.querySelector("legend")?.textContent?.trim()).toBeTruthy();
      });

      ["目的地を選ぶ", "出発地を選ぶ", "日時", "スピードを選ぶ"].forEach((name) => {
        expect(screen.queryByRole("heading", { name: new RegExp(`^${name}$`) })).not.toBeNull();
      });
    });

    it("日時と優先条件を意味のあるネイティブラジオとして公開する", () => {
      renderForm();

      const departure = screen.queryByRole("radio", { name: "出発時刻" }) as HTMLInputElement | null;
      const arrival = screen.queryByRole("radio", { name: "到着時刻" }) as HTMLInputElement | null;
      const [slow, fast] = getPriorityRadios();
      expect(departure).not.toBeNull();
      expect(arrival).not.toBeNull();
      expect(slow).not.toBeNull();
      expect(fast).not.toBeNull();
      if (!departure || !arrival || !slow || !fast) return;

      expect(departure.tagName).toBe("INPUT");
      expect(arrival.tagName).toBe("INPUT");
      expect(departure).toHaveAttribute("type", "radio");
      expect(arrival).toHaveAttribute("type", "radio");
      expect(departure.name).not.toBe("");
      expect(departure.name).toBe(arrival.name);
      expect(slow.name).not.toBe("");
      expect(slow.name).toBe(fast.name);
      expect(departure).toBeChecked();
      expect(arrival).not.toBeChecked();
      expect(slow).toBeChecked();
      expect(fast).not.toBeChecked();
    });

    it("最終経路検索だけをsubmitにし、場所操作をbuttonにする", () => {
      renderForm();
      const form = getSingleForm();
      if (!form) return;

      const submitButtons = Array.from(form.querySelectorAll("button")).filter(
        (button) => button.getAttribute("type") === "submit",
      );
      expect(submitButtons).toHaveLength(1);
      expect(submitButtons[0]).toHaveAccessibleName("検索");

      Array.from(form.querySelectorAll("button"))
        .filter((button) => button !== submitButtons[0])
        .forEach((button) => expect(button).toHaveAttribute("type", "button"));
    });

    it("URLの値をlocalStorageより優先し、指定された到着時刻と優先条件を復元する", () => {
      localStorage.setItem("prioritizeSpeed", "true");
      renderForm(
        "?destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=false&prioritizeSpeed=false",
      );

      expect(screen.queryByText(/35\.7/)).not.toBeNull();
      const arrival = screen.queryByRole("radio", { name: "到着時刻" }) as HTMLInputElement | null;
      const [slow, fast] = getPriorityRadios();
      expect(arrival).not.toBeNull();
      expect(slow).not.toBeNull();
      expect(fast).not.toBeNull();
      if (!arrival || !slow || !fast) return;
      expect(arrival).toBeChecked();
      expect(slow).toBeChecked();
      expect(fast).not.toBeChecked();
    });

    it("日時がURLにない場合は閲覧時刻を初期値にする", () => {
      jest.useFakeTimers({ now: new Date("2026-07-18T09:30:00") });
      renderForm("?destination=35.7%2C139.78");

      const dateTimeInput = document.querySelector(
        'input[type="datetime-local"]',
      ) as HTMLInputElement | null;
      expect(dateTimeInput).not.toBeNull();
      if (!dateTimeInput) return;
      expect(dateTimeInput.value).toBe("2026-07-18T09:30");
    });

    it.each([
      ["保存値を使う", true, true],
      ["保存値がない場合はfalse", false, false],
    ])("URLに優先条件がないときは%s", (_label, hasStoredValue, expected) => {
      if (hasStoredValue) localStorage.setItem("prioritizeSpeed", "true");
      renderForm("?destination=35.7%2C139.78");

      const [slow, fast] = getPriorityRadios();
      expect(slow).not.toBeNull();
      expect(fast).not.toBeNull();
      if (!slow || !fast) return;
      if (expected) {
        expect(fast).toBeChecked();
        expect(slow).not.toBeChecked();
      } else {
        expect(fast).not.toBeChecked();
        expect(slow).toBeChecked();
      }
    });

    it("不正なURL項目は項目の近くに日本語エラーを表示し、有効な値を保持する", () => {
      renderForm(
        "?origin=91%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=1&prioritizeSpeed=true",
      );

      expect(screen.queryByText("出発地の座標が正しくありません。"))
        .not.toBeNull();
      expect(screen.queryByText("出発・到着の指定が正しくありません。"))
        .not.toBeNull();
      expect(screen.queryByText(/35\.7/)).not.toBeNull();
      const originInput = screen.queryByRole("textbox", { name: "出発地" });
      expect(originInput).not.toBeNull();
      if (originInput) {
        expect(originInput).toHaveAttribute("aria-invalid", "true");
        expect(originInput).toHaveAttribute("aria-describedby");
      }
      const dateTimeInput = document.querySelector(
        'input[type="datetime-local"]',
      ) as HTMLInputElement | null;
      expect(dateTimeInput).not.toBeNull();
      if (dateTimeInput) {
        expect(dateTimeInput).toHaveValue("2026-07-18T09:30");
      }
      const [, fast] = getPriorityRadios();
      expect(fast).not.toBeNull();
      if (!fast) return;
      expect(fast).toBeChecked();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it("候補selectはインラインで選べ、ページ遷移せず他の値を保持する", () => {
      renderForm("?origin=35.68%2C139.76&time=2026-07-18T09%3A30&prioritizeSpeed=true");

      const select = screen.queryByRole("combobox", { name: /目的地|施設/ }) as HTMLSelectElement | null;
      const dateTimeInput = document.querySelector(
        'input[type="datetime-local"]',
      ) as HTMLInputElement | null;
      const [, fast] = getPriorityRadios();
      expect(select).not.toBeNull();
      expect(dateTimeInput).not.toBeNull();
      expect(fast).not.toBeNull();
      if (!select || !dateTimeInput || !fast) return;

      const candidateOption = Array.from(select.options).find(
        (option) => option.value !== "",
      );
      expect(candidateOption).not.toBeUndefined();
      if (!candidateOption) return;

      fireEvent.change(select, { target: { value: candidateOption.value } });

      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(select.value).toBe(candidateOption.value);
      expect(dateTimeInput).toHaveValue("2026-07-18T09:30");
      expect(fast).toBeChecked();
    });

    it("確定済みの両地点を独立して編集し、各入力へフォーカスを戻す", () => {
      renderForm(
        "?origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
      );

      const destinationGroup = screen.queryByRole("group", { name: /目的地/ });
      const originGroup = screen.queryByRole("group", { name: /出発地/ });
      expect(destinationGroup).not.toBeNull();
      expect(originGroup).not.toBeNull();
      if (!destinationGroup || !originGroup) return;

      const destinationEdit = within(destinationGroup).queryByRole("button", {
        name: /なおす/,
      });
      expect(destinationEdit).not.toBeNull();
      if (!destinationEdit) return;

      fireEvent.click(destinationEdit);
      const destinationInput = screen.queryByRole("textbox", { name: "目的地" });
      expect(destinationInput).not.toBeNull();
      const updatedOriginGroup = screen.queryByRole("group", { name: /出発地/ });
      expect(updatedOriginGroup).not.toBeNull();
      if (!destinationInput || !updatedOriginGroup) return;
      expect(updatedOriginGroup.textContent).toContain("35.68");
      expect(document.activeElement).toBe(destinationInput);

      const updatedOriginEdit = within(updatedOriginGroup).queryByRole("button", {
        name: /なおす/,
      });
      expect(updatedOriginEdit).not.toBeNull();
      if (!updatedOriginEdit) return;

      fireEvent.click(updatedOriginEdit);
      const originInput = screen.queryByRole("textbox", { name: "出発地" });
      expect(originInput).not.toBeNull();
      if (!originInput) return;
      expect(document.activeElement).toBe(originInput);
      expect(screen.queryByDisplayValue("2026-07-18T09:30")).not.toBeNull();
      expect(getPriorityRadios()[0]).toBeChecked();
    });

    it("必須地点または日時が不足した送信を止め、日本語エラーを項目付近に表示する", () => {
      renderForm("?prioritizeSpeed=false");
      const form = getSingleForm();
      const dateTimeInput = document.querySelector(
        'input[type="datetime-local"]',
      ) as HTMLInputElement | null;
      expect(form).not.toBeNull();
      expect(dateTimeInput).not.toBeNull();
      if (!form || !dateTimeInput) return;

      fireEvent.change(dateTimeInput, { target: { value: "" } });
      fireEvent.submit(form);

      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(screen.queryByText(/目的地.*(入力|選択|必要)/)).not.toBeNull();
      expect(screen.queryByText(/出発地.*(入力|選択|必要)/)).not.toBeNull();
      expect(screen.queryByText(/日時.*(入力|選択|必要)/)).not.toBeNull();
    });

    it("有効な全条件は最終submitでだけ結果URLへ一度遷移する", () => {
      const query: { origin: Location; destination: Location; time: string; isDeparture: boolean; prioritizeSpeed: boolean } = validQuery;
      renderForm(
        "?origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
      );
      const form = getSingleForm();
      expect(form).not.toBeNull();
      if (!form) return;

      expect(mockRouterPush).not.toHaveBeenCalled();
      fireEvent.submit(form);

      expect(mockRouterPush).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith(buildRouteResultsUrl(query));
    });
  });
}
