import { render, screen } from "@testing-library/react";
import RouteSearchResults from "../RouteSearchResults";

jest.mock("../RouteResultActions", () => function Actions() { return null; });

it("サーバー検索エラーを静的に通知して再取得せず入力画面へ戻せる", () => {
  global.fetch = jest.fn();
  const { container } = render(<RouteSearchResults result={{ status: "error", message: "経路検索に失敗しました" }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("経路検索に失敗しました");
  expect(screen.getByRole("link", { name: "入力画面に戻る" })).toHaveAttribute("href", "/");
  expect(container.querySelector(".card")).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});
