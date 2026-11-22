import {
  resolveLocationImage,
  toLocationImageSrcSet,
  type LocationImageData,
} from "../location-image";

const derivedImage: LocationImageData = {
  width: 1280,
  height: 853,
  variants: [
    {
      width: 480,
      path: "/generated/location-images/0123456789abcdef-480.webp",
    },
    {
      width: 960,
      path: "/generated/location-images/fedcba9876543210-960.webp",
    },
    {
      width: 1280,
      path: "/generated/location-images/89abcdef01234567-1280.webp",
    },
  ],
};

const usableAttribution = {
  imageCreator: " さくら ",
  imageLicense: "https://creativecommons.org/licenses/by-sa/4.0/",
};

describe("resolveLocationImage", () => {
  it("returns the derived image with its width, height and variants", () => {
    expect(resolveLocationImage({ image: derivedImage, ...usableAttribution })).toEqual({
      creator: "さくら",
      license: "https://creativecommons.org/licenses/by-sa/4.0/",
      width: 1280,
      height: 853,
      variants: derivedImage.variants,
    });
  });

  it("hides a location without a derived image even when attribution exists", () => {
    expect(
      resolveLocationImage({
        imageUri: "https://upload.wikimedia.org/wikipedia/commons/3/3d/City.jpg",
        ...usableAttribution,
      }),
    ).toBeNull();
  });

  it("keeps an image with a license when the creator is absent", () => {
    expect(
      resolveLocationImage({
        image: derivedImage,
        imageLicense: "https://creativecommons.org/licenses/by-sa/4.0/",
      }),
    ).toEqual({
      license: "https://creativecommons.org/licenses/by-sa/4.0/",
      width: 1280,
      height: 853,
      variants: derivedImage.variants,
    });
    expect(
      resolveLocationImage({
        image: derivedImage,
        imageCreator: "   ",
        imageLicense: "https://creativecommons.org/licenses/by-sa/4.0/",
      }),
    ).toEqual({
      license: "https://creativecommons.org/licenses/by-sa/4.0/",
      width: 1280,
      height: 853,
      variants: derivedImage.variants,
    });
  });

  it("hides an image without a license", () => {
    expect(resolveLocationImage({ image: derivedImage })).toBeNull();
    expect(
      resolveLocationImage({ image: derivedImage, imageCreator: "さくら" }),
    ).toBeNull();
  });

  it("keeps a non-URI license as recorded", () => {
    expect(
      resolveLocationImage({
        image: derivedImage,
        imageCreator: "さくら",
        imageLicense: "Public domain",
      }),
    ).toEqual({
      creator: "さくら",
      license: "Public domain",
      width: 1280,
      height: 853,
      variants: derivedImage.variants,
    });
  });

  it("hides an image whose license is blank", () => {
    expect(
      resolveLocationImage({
        image: derivedImage,
        imageCreator: "さくら",
        imageLicense: "   ",
      }),
    ).toBeNull();
    expect(
      resolveLocationImage({
        image: derivedImage,
        imageCreator: "さくら",
        imageLicense: "",
      }),
    ).toBeNull();
  });

  it.each([
    ["empty variants", { ...derivedImage, variants: [] }],
    [
      "a non-positive width",
      { ...derivedImage, width: 0 },
    ],
    [
      "a fractional variant width",
      {
        ...derivedImage,
        variants: [{ width: 480.5, path: derivedImage.variants[0].path }],
      },
    ],
    [
      "an external path",
      {
        ...derivedImage,
        variants: [
          {
            width: 480,
            path: "https://example.test/generated/location-images/0123456789abcdef-480.webp",
          },
        ],
      },
    ],
    [
      "a traversal path",
      {
        ...derivedImage,
        variants: [
          {
            width: 480,
            path: "/generated/location-images/../0123456789abcdef-480.webp",
          },
        ],
      },
    ],
  ])("hides a malformed derived image: %s", (_label, image) => {
    expect(
      resolveLocationImage({ image, ...usableAttribution }),
    ).toBeNull();
  });
});

describe("toLocationImageSrcSet", () => {
  it("lists every generated variant from the smallest width", () => {
    expect(toLocationImageSrcSet(derivedImage)).toBe(
      "/generated/location-images/0123456789abcdef-480.webp 480w, /generated/location-images/fedcba9876543210-960.webp 960w, /generated/location-images/89abcdef01234567-1280.webp 1280w",
    );
  });
});
