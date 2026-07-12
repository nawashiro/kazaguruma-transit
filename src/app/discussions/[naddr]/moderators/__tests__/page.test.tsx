import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModeratorsPage from "../page";

const createDiscussion = () => ({
  id: "34550:creator:topic",
  dTag: "topic",
  title: "テスト会話",
  description: "説明",
  moderators: [],
  authorPubkey: "creator",
  createdAt: 10,
  event: {
    id: "discussion-1",
    kind: 34550,
    pubkey: "creator",
    created_at: 10,
    content: "",
    tags: [],
    sig: "signature",
  },
});

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { pubkey: "creator", isLoggedIn: true },
    signEvent: jest.fn(),
  }),
}));
jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  useDiscussionMeta: () => ({
    discussion: createDiscussion(),
    reload: jest.fn(),
  }),
}));
jest.mock("@/components/discussion/ModeratorManagementSection", () => ({
  ModeratorManagementSection: () => null,
}));
jest.mock("@/components/discussion/LoginModal", () => ({
  LoginModal: () => null,
}));
jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 1000 }),
}));
jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => ({
    streamEventsOnEvent: () => () => {},
    publishSignedEvent: jest.fn(),
  }),
}));
jest.mock("@/lib/nostr/discussion-ndk-gateway", () => ({
  createDiscussionNdkGateway: () => ({
    createModeratorUpdateDraft: jest.fn(),
  }),
}));
jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: (pubkey: string) => `npub-${pubkey}`,
  isValidNpub: () => true,
  npubToHex: (npub: string) => npub,
}));
jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () =>
    "とんかつ やたい うごかす",
}));

describe("ModeratorsPage direct moderator management", () => {
  it("adds multiple direct moderators and allows each one to be cancelled", () => {
    render(<ModeratorsPage />);

    const input = screen.getByLabelText("ユーザーID");
    const addButton = screen.getByRole("button", { name: "追加" });

    fireEvent.change(input, { target: { value: "npub1first" } });
    fireEvent.click(addButton);
    fireEvent.change(input, { target: { value: "npub1second" } });
    fireEvent.click(addButton);

    expect(screen.getByText("追加予定のユーザー")).toBeVisible();
    expect(screen.getByText("npub-npub1first")).toBeVisible();
    expect(screen.getByText("npub-npub1second")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "取り消す" })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "変更を確定" }),
    ).not.toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "取り消す" })[0]);

    expect(screen.queryByText("npub-npub1first")).not.toBeInTheDocument();
    expect(screen.getByText("npub-npub1second")).toBeVisible();
    expect(screen.getByRole("button", { name: "変更を確定" })).not.toBeDisabled();
  });

  it("associates duplicate-user errors with the direct moderator input", () => {
    render(<ModeratorsPage />);

    const input = screen.getByLabelText("ユーザーID");
    const addButton = screen.getByRole("button", { name: "追加" });
    fireEvent.change(input, { target: { value: "npub1duplicate" } });
    fireEvent.click(addButton);
    fireEvent.change(input, { target: { value: "npub1duplicate" } });
    fireEvent.click(addButton);

    const error = screen.getByText("そのユーザーはすでに追加予定です。");
    expect(error).toBeVisible();
    expect(input).toHaveAttribute("aria-describedby", "direct-moderator-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
