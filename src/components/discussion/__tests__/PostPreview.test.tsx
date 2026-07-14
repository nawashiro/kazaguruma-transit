import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PostPreview } from "../PostPreview";

describe("PostPreview", () => {
  it("exposes named actions and disables both while submitting", () => {
    render(<PostPreview content="投稿" busStopTag="停留所A" onConfirm={jest.fn()} onCancel={jest.fn()} isLoading />);
    expect(screen.getByRole("button", { name: "編集に戻る" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "投稿中..." })).toBeDisabled();
  });
});
