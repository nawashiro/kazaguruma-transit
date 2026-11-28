import { act, fireEvent, render, screen } from "@testing-library/react";
import { NpubDisplay, formatNpubForDisplay } from "../NpubDisplay";

jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: () => "npub1example",
}));

describe("NpubDisplay", () => {
  it("コピー操作にアクセシブルネームと44pxのタッチ領域を持つ", async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
    render(<NpubDisplay pubkey="00" />);

    const button = screen.getByRole("button", { name: "ユーザーIDをコピー" });
    expect(button).toHaveClass(
      "inline-flex",
      "items-center",
      "justify-center",
      "min-h-[44px]",
      "min-w-[44px]"
    );
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("npub1example");
  });

  it("短縮したnpubをcode要素でtitleなしに表示し、truncateとfont-monoを維持する", () => {
    render(<NpubDisplay pubkey={"npub1" + "a".repeat(58)} />);

    const value = screen.getByText("npub1aaaa…");
    expect(value.tagName).toBe("CODE");
    expect(value).not.toHaveAttribute("title");
    expect(value).toHaveClass("truncate", "font-mono");
  });

  it("短縮した表示からコピーするとnpub全体を渡す", async () => {
    const writeText = jest.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const npub = "npub1" + "b".repeat(58);
    render(<NpubDisplay pubkey={npub} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "ユーザーIDをコピー" }));
      await Promise.resolve();
    });

    expect(screen.getByText("npub1bbbb…")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(npub);
  });

  it("9文字以下のnpubは省略記号を付けない", () => {
    render(<NpubDisplay pubkey="npub1abcd" />);

    expect(screen.getByText("npub1abcd")).toBeInTheDocument();
    expect(screen.queryByText("npub1abcd…")).not.toBeInTheDocument();
  });
});

describe("formatNpubForDisplay", () => {
  it("10文字以上のnpubは先頭9文字に省略記号を付けて10文字にする", () => {
    const npub = "npub1ef93" + "c".repeat(54);

    expect(formatNpubForDisplay(npub)).toBe("npub1ef93…");
    expect(formatNpubForDisplay(npub)).toHaveLength(10);
  });

  it("9文字ちょうどのnpubは短縮しない", () => {
    expect(formatNpubForDisplay("npub1ef93")).toBe("npub1ef93");
  });

  it("空文字はそのまま返す", () => {
    expect(formatNpubForDisplay("")).toBe("");
  });
});
