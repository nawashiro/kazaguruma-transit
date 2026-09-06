export const validMainFacilities = [
  {
    category: "よく利用される施設",
    locations: [
      {
        name: "神田図書館",
        lat: 35.695,
        lng: 139.765,
      },
    ],
  },
] as const;

export const malformedMainFacilities = [
  {
    category: "形式不正",
    locations: [{ name: "座標が欠けた候補" }],
  },
] as const;

export const validKeyLocations = [
  {
    category: "公共施設",
    "category:en": "public facilities",
    locations: [
      {
        id: "kanda-library",
        name: "神田図書館",
        lat: 35.692,
        lng: 139.762,
        description: "地域の図書館です",
        imageUri: "https://example.test/kanda-library.jpg",
        imageCopyright: "千代田区写真室",
        uri: "https://example.test/kanda-library",
        descriptionCopyright: "千代田区文化振興課",
        nodeCopyright: "千代田区",
        licence: "CC BY 4.0",
        licenceUri: "https://creativecommons.org/licenses/by/4.0/",
      },
    ],
  },
] as const;

export const validKeyLocationWithoutDisplayMetadata = {
  category: "表示情報なし",
  "category:en": "no-display-metadata",
  locations: [
    {
      id: "metadata-optional-facility",
      name: "表示情報なし施設",
      lat: 35.693,
      lng: 139.763,
      description: null,
      nodeCopyright: "千代田区",
      licence: "CC BY 4.0",
      licenceUri: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
} as const;

export const emptyKeyLocationCategory = {
  category: "空カテゴリ",
  "category:en": "empty category",
  locations: [],
} as const;

export const malformedKeyLocations = [
  {
    category: "形式不正",
    "category:en": "broken",
    locations: [{ id: "missing-required-fields" }],
  },
] as const;

export const townGeoJsonWithHole = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "東京都千代田区神田" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.76, 35.69],
            [139.77, 35.69],
            [139.77, 35.7],
            [139.76, 35.7],
            [139.76, 35.69],
          ],
          [
            [139.764, 35.694],
            [139.766, 35.694],
            [139.766, 35.696],
            [139.764, 35.696],
            [139.764, 35.694],
          ],
        ],
      },
    },
  ],
} as const;

export const malformedTownGeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "形式不正" },
      geometry: { type: "Polygon", coordinates: [] },
    },
  ],
} as const;
