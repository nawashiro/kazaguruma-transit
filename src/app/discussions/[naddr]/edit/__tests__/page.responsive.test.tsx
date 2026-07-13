import fs from "node:fs";
import path from "node:path";

const editPageSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/discussions/[naddr]/edit/page.tsx"),
  "utf8"
);
const globalStyles = fs.readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8"
);

describe("DiscussionEditPage responsive layout contract", () => {
  it("uses a responsive action layout instead of a fixed horizontal row", () => {
    expect(editPageSource).toContain("flex flex-col gap-3 sm:flex-row sm:flex-wrap");
    expect(editPageSource).toContain("join w-full");
  });

  it("reserves space for the fixed ruby control at the end of the page", () => {
    expect(globalStyles).toContain("#main-content");
    expect(globalStyles).toContain("padding-bottom: max(5rem");
    expect(globalStyles).toContain("z-index: 30");
  });
});
