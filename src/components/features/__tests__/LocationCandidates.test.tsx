import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationCandidates from "../LocationCandidates";

const candidates = [
  { name: "神田駅", address: "千代田区鍛冶町二丁目6番", lat: 35.68, lng: 139.76, kind: "station" },
  { name: "千代田区役所", address: "千代田区九段南一丁目2番", lat: 35.694, lng: 139.753, kind: "public" },
];

describe("LocationCandidates", () => {
  it("見出しと件数を画面に表示せず、一覧は地点の候補として名前を持つ", () => {
    render(<LocationCandidates candidates={candidates} label="目的地" onSelect={jest.fn()} />);

    const list = screen.getByRole("list", { name: "目的地の候補" });
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByText("目的地の候補から選ぶ")).not.toBeInTheDocument();
    expect(screen.getByText("2件の候補があります")).toHaveClass("sr-only");
  });

  it("件数は非表示のまま読み上げる", () => {
    render(<LocationCandidates candidates={candidates} label="出発地" onSelect={jest.fn()} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("2件の候補があります");
    expect(status).toHaveClass("sr-only");
  });

  it("候補が空なら一覧も通知も描画しない", () => {
    const { container } = render(<LocationCandidates candidates={[]} label="目的地" onSelect={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("各候補をポインターで押せる場所として示す", () => {
    render(<LocationCandidates candidates={candidates} label="目的地" onSelect={jest.fn()} />);

    within(screen.getByRole("list", { name: "目的地の候補" })).getAllByRole("button").forEach((button) => {
      expect(button).toHaveClass("cursor-pointer", "hover:bg-base-100", "min-h-[44px]");
      expect(button).not.toHaveClass("hover:bg-base-200");
    });
  });

  it("選んだ候補だけを通知する", () => {
    const onSelect = jest.fn();
    render(<LocationCandidates candidates={candidates} label="目的地" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /千代田区役所/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(candidates[1]);
  });

  it("徒歩距離と警告を候補ごとに示す", () => {
    render(
      <LocationCandidates
        candidates={[
          { ...candidates[0], walkMeters: 450 },
          { ...candidates[1], walkMeters: 537 },
        ]}
        label="目的地"
        onSelect={jest.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: "目的地の候補" });
    expect(within(list).getByText("450m")).toBeInTheDocument();
    expect(within(list).getByText("537m")).toBeInTheDocument();
    expect(within(list).getByText("バス停から遠い")).toBeInTheDocument();
    expect(within(list).queryAllByText("バス停から遠い")).toHaveLength(1);
  });

  it("750mを超える候補は選べず、理由を文章として残す", () => {
    const onSelect = jest.fn();
    render(
      <LocationCandidates
        candidates={[
          { ...candidates[0], walkMeters: 537 },
          { ...candidates[1], walkMeters: 939 },
        ]}
        label="目的地"
        onSelect={onSelect}
      />,
    );

    const list = screen.getByRole("list", { name: "目的地の候補" });
    const buttons = within(list).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("神田駅");

    expect(within(list).getByText("バス停から遠すぎ")).toBeInTheDocument();
    expect(screen.getByText("939m")).toBeInTheDocument();
    expect(within(list).getByText("千代田区役所")).toBeInTheDocument();

    fireEvent.click(screen.getByText("千代田区役所"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("徒歩距離のない候補は警告を出さずに選べる", () => {
    const onSelect = jest.fn();
    render(<LocationCandidates candidates={candidates} label="目的地" onSelect={onSelect} />);

    expect(screen.queryByText(/バス停から/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /神田駅/ }));
    expect(onSelect).toHaveBeenCalledWith(candidates[0]);
  });
});
