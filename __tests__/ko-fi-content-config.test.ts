import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

describe("Ko-fi支援文言設定", () => {
  it("ローカル設定をGit管理対象から除外する", () => {
    const gitignoreEntries = fs
      .readFileSync(path.join(projectRoot, ".gitignore"), "utf8")
      .split(/\r?\n/)
      .map((entry) => entry.trim());

    expect(gitignoreEntries).toContain("ko-fi-content.json");
  });

  it("コピーして編集できる有効なexample設定を提供する", () => {
    const exampleContent: unknown = JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, "ko-fi-content.json.example"),
        "utf8",
      ),
    );

    expect(exampleContent).toEqual({
      heading: expect.any(String),
      message: expect.any(String),
    });
    expect(
      (exampleContent as { heading: string }).heading.trim().length,
    ).toBeGreaterThan(0);
    expect(
      (exampleContent as { message: string }).message.trim().length,
    ).toBeGreaterThan(0);
  });
});
