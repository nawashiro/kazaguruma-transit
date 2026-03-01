import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionCreatePage from "../page";

const pushMock = jest.fn();
const processDiscussionCreationFlowMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      pubkey: "f".repeat(64),
      isLoggedIn: true,
    },
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

jest.mock("@/components/discussion/LoginModal", () => ({
  LoginModal: () => <div>Login Modal</div>,
}));

describe("DiscussionCreatePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("creates discussion and shows success action with URL navigation", async () => {
    render(<DiscussionCreatePage />);

    fireEvent.change(screen.getByLabelText("タイトル *"), {
      target: { value: "US2 Test Title" },
    });
    fireEvent.change(screen.getByLabelText("説明 *"), {
      target: { value: "US2 Test Description" },
    });

    fireEvent.click(screen.getByRole("button", { name: "会話を作成する" }));

    await waitFor(() =>
      expect(processDiscussionCreationFlowMock).toHaveBeenCalled()
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
});
