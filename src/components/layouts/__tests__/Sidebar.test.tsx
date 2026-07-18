import { render, screen } from "@testing-library/react";
import Sidebar from "../Sidebar";

describe("Sidebar", () => {
  it("サイトマップへの導線を表示しないこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} />);

    expect(
      screen.queryByRole("menuitem", { name: "サイトマップ" }),
    ).not.toBeInTheDocument();
  });
});
