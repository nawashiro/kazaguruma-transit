import { act, fireEvent, render, screen } from "@testing-library/react";
import { NpubDisplay } from "../NpubDisplay";

jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: () => "npub1example",
}));

describe("NpubDisplay", () => {
  it("コピー操作にアクセシブルネームと44pxのタッチ領域を持つ", async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
    render(<NpubDisplay pubkey="00" />);

    const button = screen.getByRole("button", { name: "ユーザーIDをコピー" });
    expect(button).toHaveClass("min-h-[44px]", "min-w-[44px]");
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("npub1example");
  });

  it("すでにnpub形式のIDを再エンコードしない", () => {
    render(<NpubDisplay pubkey="npub1already-encoded" />);

    expect(screen.getByText("npub1already-encoded")).toBeInTheDocument();
  });
});
