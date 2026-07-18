import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AwardRecognition from "../AwardRecognition";

describe("AwardRecognition", () => {
  it("受賞名、オープンバッジ、詳細ページへの導線を表示する", () => {
    const { container } = render(<AwardRecognition />);

    expect(
      screen.getByText("都知事杯オープンデータ・ハッカソン2025"),
    ).toBeInTheDocument();
    expect(screen.getByText("行政課題解決賞を受賞しました")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "行政課題解決賞のオープンバッジ" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "受賞について詳しく見る" })).toHaveAttribute(
      "href",
      "/award",
    );
    expect(container.querySelector(".text-primary")).not.toBeInTheDocument();
    expect(container.querySelector(".link-primary")).not.toBeInTheDocument();
  });

  it("通常テキストをtext-baseで表示する", () => {
    const { container } = render(<AwardRecognition />);

    expect(container.querySelector(".card-body")).toHaveClass("text-base");
    expect(container.querySelector(".text-sm")).not.toBeInTheDocument();
  });
});
