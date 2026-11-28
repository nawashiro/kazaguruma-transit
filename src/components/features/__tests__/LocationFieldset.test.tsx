import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationFieldset from "../LocationFieldset";

describe("LocationFieldset", () => {
  it("グループの見出しを本文より大きい20pxで表示する", () => {
    render(<LocationFieldset label="目的地" testId="selected"><input aria-label="目的地" /></LocationFieldset>);

    const legend = screen.getByRole("group", { name: "目的地" }).querySelector("legend");
    expect(legend).toHaveClass("fieldset-legend", "text-xl");
    expect(legend).not.toHaveClass("text-base");
  });

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

  it("なおすはfieldsetの直接の格子項目にせず全幅へ引き伸ばさない", () => {
    render(<LocationFieldset label="目的地" testId="selected" onEdit={() => {}} selectedLocation={{ lat: 35, lng: 139 }}>
      <input aria-label="目的地" />
    </LocationFieldset>);
    const group = screen.getByRole("group", { name: "目的地" });
    const button = screen.getByRole("button", { name: "なおす" });
    expect(button).not.toHaveClass("w-full");
    expect(button.parentElement).not.toBe(group);
  });

  it("確定した地点が遠ければ警告を示し、距離の数値は出さない", () => {
    render(
      <LocationFieldset
        label="目的地"
        testId="selected"
        selectedLocation={{
          lat: 35.6865,
          lng: 139.7589,
          address: "皇居三の丸尚蔵館",
          walkMeters: 963,
        }}
      >
        <input aria-label="目的地" />
      </LocationFieldset>,
    );

    const confirmed = screen.getByTestId("selected");
    expect(confirmed).toHaveTextContent("皇居三の丸尚蔵館");
    expect(confirmed).toHaveTextContent("バス停から遠すぎ");
    expect(confirmed).not.toHaveTextContent("963m");
  });

  it("徒歩距離がなければ警告も示さない", () => {
    render(
      <LocationFieldset
        label="目的地"
        testId="selected"
        selectedLocation={{ lat: 35.694, lng: 139.753, address: "千代田区役所" }}
      >
        <input aria-label="目的地" />
      </LocationFieldset>,
    );

    const confirmed = screen.getByTestId("selected");
    expect(confirmed).toHaveTextContent("千代田区役所");
    expect(confirmed).not.toHaveTextContent(/\d+m/);
    expect(confirmed).not.toHaveTextContent("バス停から");
  });
});
