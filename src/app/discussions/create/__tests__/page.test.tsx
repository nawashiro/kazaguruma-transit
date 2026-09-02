import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionCreatePage from "../page";

const pushMock = jest.fn();
const processDiscussionCreationFlowMock = jest.fn();
const CREATE_DRAFT_KEY = "kazaguruma:draft:discussion-create";
const mockCreateAuthUser = {
  pubkey: "f".repeat(64),
  isLoggedIn: true,
};

function readCreateDraft(): Record<string, unknown> {
  const stored = window.sessionStorage.getItem(CREATE_DRAFT_KEY);
  expect(stored).not.toBeNull();
  if (stored === null) {
    throw new Error("discussion-create draft was not saved");
  }
  return JSON.parse(stored) as Record<string, unknown>;
}

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: mockCreateAuthUser,
    signEvent: jest.fn(async () => ({
      id: "signed-event-id",
      kind: 1111,
      pubkey: "f".repeat(64),
      created_at: 1,
      tags: [],
      content: "",
      sig: "s".repeat(128),
    })),
  }),
}));

jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({}),
}));

jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => ({
    publishSignedEvent: jest.fn(async () => true),
  }),
}));

jest.mock("@/lib/discussion/user-creation-flow", () => ({
  processDiscussionCreationFlow: (...args: unknown[]) =>
    processDiscussionCreationFlowMock(...args),
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  getAdminPubkeyHex: () => "a".repeat(64),
}));

describe("DiscussionCreatePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/discussions/create");
    mockCreateAuthUser.pubkey = "f".repeat(64);
    mockCreateAuthUser.isLoggedIn = true;
    Object.defineProperty(global, "crypto", {
      value: {
        randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
      },
      configurable: true,
    });
    processDiscussionCreationFlowMock.mockResolvedValue({
      success: true,
      discussionNaddr: "naddr1created",
      errors: [],
      successMessage:
        "会話が作成されました。すぐに開始できます。URLを共有すれば、仲間を呼び込めます。",
    });
  });

  it("does not expose UUID/dTag input to user", () => {
    render(<DiscussionCreatePage />);

    expect(screen.queryByLabelText("会話ID *")).not.toBeInTheDocument();
  });

  it("keeps the conversation title at 100 characters and the description at 1000 characters", () => {
    render(<DiscussionCreatePage />);

    expect(screen.getByLabelText("タイトル *")).toHaveAttribute("maxLength", "100");
    expect(screen.getByLabelText("説明 *")).toHaveAttribute("maxLength", "1000");
  });

  it("shows the description counter against the 1000-character limit", () => {
    render(<DiscussionCreatePage />);

    fireEvent.change(screen.getByLabelText("説明 *"), {
      target: { value: "a".repeat(1000) },
    });

    expect(screen.getByText("1000/1000文字")).toBeInTheDocument();
  });

  it("restores the title, description, moderator list, and in-progress moderator input", async () => {
    window.sessionStorage.setItem(
      CREATE_DRAFT_KEY,
      JSON.stringify({
        title: "復元タイトル",
        description: "復元説明",
        moderators: ["npub1restored"],
        moderatorInput: "npub1pending",
      }),
    );

    render(<DiscussionCreatePage />);

    await waitFor(() => {
      expect(screen.getByLabelText("タイトル *")).toHaveValue("復元タイトル");
      expect(screen.getByLabelText("説明 *")).toHaveValue("復元説明");
      expect(screen.getByLabelText("モデレーター（任意）")).toHaveValue("npub1pending");
    });
    expect(
      screen.getByRole("button", { name: "モデレーター npub1restored を削除" }),
    ).toBeInTheDocument();
  });

  it("saves changed title, description, moderator list, and moderator input to sessionStorage", async () => {
    render(<DiscussionCreatePage />);

    fireEvent.change(screen.getByLabelText("タイトル *"), {
      target: { value: "保存タイトル" },
    });
    fireEvent.change(screen.getByLabelText("説明 *"), {
      target: { value: "保存説明" },
    });
    fireEvent.change(screen.getByLabelText("モデレーター（任意）"), {
      target: { value: "npub1added" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    fireEvent.change(screen.getByLabelText("モデレーター（任意）"), {
      target: { value: "npub1pending" },
    });

    await waitFor(() => {
      expect(readCreateDraft()).toEqual(
        expect.objectContaining({
          title: "保存タイトル",
          description: "保存説明",
          moderators: ["npub1added"],
          moderatorInput: "npub1pending",
        }),
      );
    });
  });

  it("creates discussion and shows success action with URL navigation", async () => {
    render(<DiscussionCreatePage />);

    fireEvent.change(screen.getByLabelText("タイトル *"), {
      target: { value: "US2 Test Title" },
    });
    fireEvent.change(screen.getByLabelText("説明 *"), {
      target: { value: "US2 Test Description" },
    });

    await waitFor(() => {
      expect(readCreateDraft()).toEqual(
        expect.objectContaining({
          title: "US2 Test Title",
          description: "US2 Test Description",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "会話を作成する" }));

    await waitFor(() =>
      expect(processDiscussionCreationFlowMock).toHaveBeenCalled()
    );
    await waitFor(() =>
      expect(window.sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull(),
    );
    expect(processDiscussionCreationFlowMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        publishListingRequest: false,
      })
    );
    expect(processDiscussionCreationFlowMock.mock.calls[0][0].formData.dTag).toMatch(
      /^discussion-/
    );

    expect(await screen.findByText("会話作成完了")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "会話を開始する" }));
    expect(pushMock).toHaveBeenCalledWith("/discussions/naddr1created");
  });

  it("shows creation errors as an assertive soft alert while preserving form input", async () => {
    const creationErrors = [
      "タイトルの内容を確認してください",
      "説明の内容を確認してください",
    ];
    processDiscussionCreationFlowMock.mockResolvedValueOnce({
      success: false,
      errors: creationErrors,
    });

    render(<DiscussionCreatePage />);

    fireEvent.change(screen.getByLabelText("タイトル *"), {
      target: { value: "入力したタイトル" },
    });
    fireEvent.change(screen.getByLabelText("説明 *"), {
      target: { value: "入力した説明" },
    });
    await waitFor(() => {
      expect(readCreateDraft()).toEqual(
        expect.objectContaining({
          title: "入力したタイトル",
          description: "入力した説明",
        }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "会話を作成する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    for (const error of creationErrors) {
      expect(alert).toHaveTextContent(error);
    }
    expect(screen.getByDisplayValue("入力したタイトル")).toBeInTheDocument();
    expect(screen.getByDisplayValue("入力した説明")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(CREATE_DRAFT_KEY)).not.toBeNull();
    expect(readCreateDraft()).toEqual(
      expect.objectContaining({
        title: "入力したタイトル",
        description: "入力した説明",
      }),
    );
  });

  it("navigates unauthenticated creation to login without opening LoginModal or replaying creation", async () => {
    mockCreateAuthUser.pubkey = "";
    mockCreateAuthUser.isLoggedIn = false;
    window.history.replaceState({}, "", "/discussions/create?tab=recent");
    const view = render(<DiscussionCreatePage />);

    fireEvent.change(screen.getByLabelText("タイトル *"), {
      target: { value: "保留したタイトル" },
    });
    fireEvent.change(screen.getByLabelText("説明 *"), {
      target: { value: "保留した説明" },
    });
    fireEvent.click(screen.getByRole("button", { name: "会話を作成する" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const target = pushMock.mock.calls[0][0] as string;
    const targetUrl = new URL(target, "https://kazaguruma.invalid");
    expect(targetUrl.pathname).toBe("/login");
    expect(targetUrl.searchParams.get("returnTo")).toBe("/discussions/create?tab=recent");
    expect(targetUrl.searchParams.get("reason")).toBeNull();
    expect([...targetUrl.searchParams.keys()]).toEqual(["returnTo"]);
    expect(targetUrl.searchParams.has("action")).toBe(false);
    expect(targetUrl.searchParams.has("payload")).toBe(false);
    expect(targetUrl.searchParams.has("draft")).toBe(false);
    await waitFor(() => {
      expect(readCreateDraft()).toEqual(
        expect.objectContaining({
          title: "保留したタイトル",
          description: "保留した説明",
        }),
      );
    });
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(processDiscussionCreationFlowMock).not.toHaveBeenCalled();

    mockCreateAuthUser.pubkey = "f".repeat(64);
    mockCreateAuthUser.isLoggedIn = true;
    view.rerender(<DiscussionCreatePage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "会話を作成する" })).toBeInTheDocument(),
    );
    expect(processDiscussionCreationFlowMock).not.toHaveBeenCalled();
  });
});
