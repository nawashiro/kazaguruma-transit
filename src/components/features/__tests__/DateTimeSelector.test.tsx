import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DateTimeSelector from "../DateTimeSelector";

function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

describe("DateTimeSelector", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-26T01:23:00Z"));
  });

  afterEach(() => jest.useRealTimers());

  it("端末の現在日時を一度設定して両callbackへ通知する", () => {
    const onSubmit = jest.fn();
    const onDateTimeSelected = jest.fn();
    const { rerender } = render(
      <React.StrictMode>
        <DateTimeSelector initialStopId="stop1" onSubmit={onSubmit} onDateTimeSelected={onDateTimeSelected} />
      </React.StrictMode>,
    );
    const expected = localDateTime(new Date());
    expect(screen.getByLabelText("日時")).toHaveValue(expected);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onDateTimeSelected).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ stopId: "stop1", dateTime: expected, isDeparture: true });
    act(() => jest.setSystemTime(new Date("2026-10-27T05:00:00Z")));
    rerender(
      <React.StrictMode>
        <DateTimeSelector initialStopId="stop2" onSubmit={onSubmit} onDateTimeSelected={onDateTimeSelected} />
      </React.StrictMode>,
    );
    expect(screen.getByLabelText("日時")).toHaveValue(expected);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("通常のラジオと固定ラベルで出発・到着を切り替え、GET用の値を持つ", () => {
    const onDateTimeSelected = jest.fn();
    const { container } = render(<form><DateTimeSelector onDateTimeSelected={onDateTimeSelected} /></form>);
    const input = screen.getByLabelText("日時");
    const departure = screen.getByRole("radio", { name: "出発" });
    const arrival = screen.getByRole("radio", { name: "到着" });
    expect(departure).toHaveAttribute("name", "isDeparture");
    expect(departure).toHaveAttribute("value", "true");
    expect(arrival).toHaveAttribute("name", "isDeparture");
    expect(arrival).toHaveAttribute("value", "false");
    expect(departure).toBeChecked();
    expect(input).toHaveAttribute("type", "datetime-local");
    expect(input).toHaveAttribute("name", "time");
    expect(input).toHaveAccessibleName("日時");
    expect(input).not.toHaveAttribute("aria-label");
    expect(container.querySelector("fieldset")).not.toHaveAttribute("role");
    const initialValue = (input as HTMLInputElement).value;
    fireEvent.click(arrival);
    expect(arrival).toBeChecked();
    expect(departure).not.toBeChecked();
    expect(screen.getByLabelText("日時")).toBe(input);
    expect(input).toHaveValue(initialValue);
    const form = container.querySelector("form")!;
    expect(new FormData(form).get("isDeparture")).toBe("false");
    expect(new FormData(form).get("time")).toBe(initialValue);
    expect(onDateTimeSelected).toHaveBeenLastCalledWith({ stopId: "", dateTime: initialValue, isDeparture: false });
    fireEvent.click(departure);
    expect(new FormData(form).get("isDeparture")).toBe("true");
  });

  it("日時の変更を通知し、空欄は現在日時で補充せず標準必須検証に任せる", () => {
    const onSubmit = jest.fn();
    const { rerender } = render(<DateTimeSelector onSubmit={onSubmit} />);
    const input = screen.getByLabelText("日時") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-11-01T09:00" } });
    expect(input).toHaveValue("2026-11-01T09:00");
    expect(onSubmit).toHaveBeenLastCalledWith({ stopId: "", dateTime: "2026-11-01T09:00", isDeparture: true });
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toBeRequired();
    expect(input.validity.valueMissing).toBe(true);
    expect(input.checkValidity()).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "到着" }));
    rerender(<DateTimeSelector onSubmit={onSubmit} />);
    expect(input).toHaveValue("");
    expect(onSubmit).toHaveBeenLastCalledWith({ stopId: "", dateTime: "", isDeparture: false });
  });

  it("日時ラベルにテーマ本文色を使う", () => {
    render(<DateTimeSelector />);
    const input = screen.getByLabelText("日時");
    const label = document.querySelector(`label[for="${input.id}"]`);
    expect(label).toHaveClass("text-base-content");
  });

  it("disabled時には日時と両ラジオを無効にする", () => {
    render(<DateTimeSelector disabled />);
    expect(screen.getByLabelText("日時")).toBeDisabled();
    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled());
  });
});
