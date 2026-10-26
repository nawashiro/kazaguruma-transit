import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationFieldset from "../LocationFieldset";

describe("LocationFieldset", () => {
  it("非同期の確定前に別グループへ移ったフォーカスを奪わない", () => {
    const view = (selectedLocation?: { lat: number; lng: number }) => <>
      <LocationFieldset label="目的地" testId="selected" selectedLocation={selectedLocation}>
        <input aria-label="目的地" />
      </LocationFieldset>
      <fieldset><legend>出発地</legend><input aria-label="出発地" /></fieldset>
    </>;
    const { rerender } = render(view());
    screen.getByRole("textbox", { name: "目的地" }).focus();
    const origin = screen.getByRole("textbox", { name: "出発地" });
    origin.focus();
    rerender(view({ lat: 35, lng: 139 }));
    expect(origin).toHaveFocus();
  });

  it("確定時に同じグループ内へ移ったフォーカスは確定住所へ引き継ぐ", () => {
    const children = <><input aria-label="目的地" /><button>施設を選ぶ</button></>;
    const { rerender } = render(<LocationFieldset label="目的地" testId="selected">{children}</LocationFieldset>);
    screen.getByRole("button", { name: "施設を選ぶ" }).focus();
    rerender(<LocationFieldset label="目的地" testId="selected" selectedLocation={{ lat: 35, lng: 139 }}>{children}</LocationFieldset>);
    expect(screen.getByTestId("selected")).toHaveFocus();
  });
  it("長い確定住所を省略せず折り返し、確定と再編集でフォーカスを維持する", () => {
    const address = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(8);
    const onEdit = jest.fn();
    const children = <input aria-label="目的地" />;
    const { rerender } = render(<LocationFieldset label="目的地" testId="selected" onEdit={onEdit}>{children}</LocationFieldset>);
    screen.getByRole("textbox", { name: "目的地" }).focus();
    rerender(<LocationFieldset label="目的地" testId="selected" onEdit={onEdit} selectedLocation={{ lat: 35, lng: 139, address }}>{children}</LocationFieldset>);
    const selected = screen.getByTestId("selected");
    expect(selected).toHaveTextContent(address);
    expect(selected).toHaveClass("min-w-0", "break-words");
    expect(selected).not.toHaveClass("truncate");
    expect(selected).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "なおす" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    rerender(<LocationFieldset label="目的地" testId="selected" onEdit={onEdit} selectedLocation={null}>{children}</LocationFieldset>);
    expect(screen.getByRole("textbox", { name: "目的地" })).toHaveFocus();
  });
});
