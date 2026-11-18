import { resolveLocationImage } from "../location-image";

describe("resolveLocationImage", () => {
  it("returns the image only when the URI, creator and license are usable", () => {
    expect(
      resolveLocationImage({
        imageUri: "https://example.test/place.jpg",
        imageCreator: " さくら ",
        imageLicense: "https://creativecommons.org/licenses/by-sa/4.0/",
      }),
    ).toEqual({
      uri: "https://example.test/place.jpg",
      creator: "さくら",
      license: "https://creativecommons.org/licenses/by-sa/4.0/",
    });
  });

  it("hides an image that lacks attribution", () => {
    expect(
      resolveLocationImage({
        imageUri: "https://example.test/place.jpg",
      }),
    ).toBeNull();
    expect(
      resolveLocationImage({
        imageUri: "https://example.test/place.jpg",
        imageCreator: "さくら",
      }),
    ).toBeNull();
  });

  it("hides an image with a non-http URI", () => {
    expect(
      resolveLocationImage({
        imageUri: "not-a-url",
        imageCreator: "さくら",
        imageLicense: "https://creativecommons.org/licenses/by-sa/4.0/",
      }),
    ).toBeNull();
  });
});
