import React, { type Dispatch, type SetStateAction } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

type DiscussionDraft = {
  title: string;
  description: string;
};

type SessionDraftController<T> = {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  clearDraft: () => void;
};

type UseSessionDraft = <T>(
  key: string,
  initialDraft: T,
  isValidDraft: (value: unknown) => value is T,
) => SessionDraftController<T>;

const DRAFT_KEY = "kazaguruma:draft:discussion-create";
const EMPTY_DRAFT: DiscussionDraft = { title: "", description: "" };
const RESTORED_DRAFT: DiscussionDraft = {
  title: "復元されたタイトル",
  description: "復元された説明",
};
const SAVED_DRAFT: DiscussionDraft = {
  title: "保存するタイトル",
  description: "保存する説明",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDiscussionDraft(value: unknown): value is DiscussionDraft {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  );
}

function loadUseSessionDraft(): UseSessionDraft {
  let loaded: unknown;
  let loadError: unknown = null;

  try {
    // Keep the planned form boundary collectible before implementation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    loaded = require("../use-session-draft");
  } catch (error) {
    loadError = error;
  }

  expect(loadError).toBeNull();
  if (loadError !== null) {
    throw new Error(`useSessionDraft is not implemented: ${String(loadError)}`);
  }

  expect(isRecord(loaded)).toBe(true);
  if (!isRecord(loaded)) {
    throw new Error("use-session-draft module did not expose an object");
  }

  const useSessionDraft = loaded.useSessionDraft;
  expect(typeof useSessionDraft).toBe("function");
  if (typeof useSessionDraft !== "function") {
    throw new Error("use-session-draft module did not expose useSessionDraft");
  }

  return useSessionDraft as UseSessionDraft;
}

function DraftHarness({ useSessionDraft }: { useSessionDraft: UseSessionDraft }) {
  const { draft, setDraft, clearDraft } = useSessionDraft(
    DRAFT_KEY,
    EMPTY_DRAFT,
    isDiscussionDraft,
  );

  return (
    <section>
      <output data-testid="draft-value">{JSON.stringify(draft)}</output>
      <button type="button" onClick={() => setDraft(SAVED_DRAFT)}>
        下書きを変更
      </button>
      <button type="button" onClick={clearDraft}>
        下書きを削除
      </button>
    </section>
  );
}

function renderDraftHarness() {
  const useSessionDraft = loadUseSessionDraft();
  return render(<DraftHarness useSessionDraft={useSessionDraft} />);
}

function readStoredDraft(): unknown {
  const stored = window.sessionStorage.getItem(DRAFT_KEY);
  expect(stored).not.toBeNull();
  if (stored === null) {
    throw new Error("sessionStorage draft was not written");
  }
  return JSON.parse(stored) as unknown;
}

describe("useSessionDraft public boundary", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("restores only JSON that passes the supplied type guard", async () => {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(RESTORED_DRAFT));
    renderDraftHarness();

    await waitFor(() => {
      const rendered = screen.getByTestId("draft-value").textContent;
      expect(rendered).not.toBeNull();
      expect(JSON.parse(rendered ?? "null") as unknown).toEqual(RESTORED_DRAFT);
    });
  });

  it("ignores malformed or structurally invalid JSON without breaking the form", async () => {
    window.sessionStorage.setItem(DRAFT_KEY, "{not-json");
    const malformedView = renderDraftHarness();

    await waitFor(() => {
      const rendered = malformedView.getByTestId("draft-value").textContent;
      expect(rendered).not.toBeNull();
      expect(JSON.parse(rendered ?? "null") as unknown).toEqual(EMPTY_DRAFT);
    });
    malformedView.unmount();

    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title: 42 }));
    const invalidShapeView = renderDraftHarness();
    await waitFor(() => {
      const rendered = invalidShapeView.getByTestId("draft-value").textContent;
      expect(rendered).not.toBeNull();
      expect(JSON.parse(rendered ?? "null") as unknown).toEqual(EMPTY_DRAFT);
    });
  });

  it("saves a changed draft as JSON under the requested sessionStorage key", async () => {
    renderDraftHarness();

    fireEvent.click(screen.getByRole("button", { name: "下書きを変更" }));

    await waitFor(() => {
      expect(readStoredDraft()).toEqual(SAVED_DRAFT);
    });
  });

  it("keeps the hook usable when sessionStorage is unavailable", async () => {
    const originalSessionStorage = window.sessionStorage;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: undefined,
    });

    try {
      const view = renderDraftHarness();
      expect(view.getByTestId("draft-value")).toHaveTextContent(JSON.stringify(EMPTY_DRAFT));
      fireEvent.click(view.getByRole("button", { name: "下書きを変更" }));

      await waitFor(() => {
        expect(view.getByTestId("draft-value")).toHaveTextContent(JSON.stringify(SAVED_DRAFT));
      });
      view.unmount();
    } finally {
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        value: originalSessionStorage,
      });
    }
  });

  it("clears the draft key when the public clear action is invoked", async () => {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(RESTORED_DRAFT));
    renderDraftHarness();

    await waitFor(() => expect(screen.getByTestId("draft-value")).toHaveTextContent("復元されたタイトル"));
    fireEvent.click(screen.getByRole("button", { name: "下書きを削除" }));

    await waitFor(() => {
      expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    });
  });
});
