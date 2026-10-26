import { render, screen } from "@testing-library/react";
import StopTimeDisplay from "../StopTimeDisplay";

it("時刻をテーマ本文色と背景色の組み合わせで表示する", () => {
  render(<StopTimeDisplay stopName="千代田区役所" time="09時57分" dateTime="09:57:00" />);
  const time = screen.getByText("09時57分");
  expect(time.tagName).toBe("TIME");
  expect(time).toHaveAttribute("datetime", "09:57:00");
  expect(time).toHaveClass("bg-base-200", "text-base-content");
  expect(time).not.toHaveClass("badge-secondary");
});
