import { imageLicenseLabel } from "../image-license";

describe("imageLicenseLabel", () => {
  it("names Creative Commons licenses instead of showing the URL", () => {
    expect(
      imageLicenseLabel("https://creativecommons.org/licenses/by-sa/4.0/"),
    ).toBe("CC BY-SA 4.0");
    expect(
      imageLicenseLabel("https://creativecommons.org/licenses/by/2.5"),
    ).toBe("CC BY 2.5");
    expect(
      imageLicenseLabel(
        "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      ),
    ).toBe("CC0 1.0");
  });

  it("keeps an unknown license URI as the label", () => {
    expect(imageLicenseLabel("https://example.test/license")).toBe(
      "https://example.test/license",
    );
  });
});
