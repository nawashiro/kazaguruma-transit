import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

type PublicModule = Record<string, unknown>;
type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

function loadNotFoundModule(): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded RED boundary
    const loaded: unknown = require("@/app/not-found");
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("global not-found module did not export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

const notFoundModule = loadNotFoundModule();

describe("global not-found page", () => {
  const moduleExports = notFoundModule.exports;

  if (notFoundModule.error || !moduleExports) {
    it("reports the missing global not-found page as an explicit RED", () => {
      expect(notFoundModule.error).toBeNull();
      expect(moduleExports).not.toBeNull();
    });
    return;
  }

  it("renders one generic Japanese heading and not-found message", () => {
    const page = moduleExports.default;
    expect(typeof page).toBe("function");
    if (typeof page !== "function") {
      return;
    }

    render(
      <main id="main-content">
        {React.createElement(page as React.ComponentType)}
      </main>,
    );

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "ページが見つかりません",
      }),
    ).toHaveLength(1);
    expect(
      screen.getByText("お探しのページは見つかりませんでした。", { exact: true }),
    ).toBeInTheDocument();
  });
});
