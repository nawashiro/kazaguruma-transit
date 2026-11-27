import {
  findOsmElementKey,
  validateDestinationCatalog,
} from "../destination-catalog";

const SOURCE = {
  datasetJsonLdUri: "https://example.test/dataset.jsonld",
  osmMirrorUri: "https://example.test/mirrors/osm.json",
};

const ID = "urn:uuid:00000000-0000-4000-8000-000000000001";

function catalogWith(entry: Record<string, unknown>): unknown {
  return { source: SOURCE, places: [{ id: ID, name: "施設", ...entry }] };
}

describe("validateDestinationCatalogのwalkToStopMeters", () => {
  it("0以上の整数を受け入れる", () => {
    const catalog = validateDestinationCatalog(
      catalogWith({ includeInRouteForm: true, walkToStopMeters: 0 }),
    );

    expect(catalog.places[0].walkToStopMeters).toBe(0);
  });

  it("750mの値をそのまま返す", () => {
    const catalog = validateDestinationCatalog(
      catalogWith({ includeInRouteForm: true, walkToStopMeters: 750 }),
    );

    expect(catalog.places[0].walkToStopMeters).toBe(750);
  });

  it("欄が欠けていれば拒否する", () => {
    expect(() =>
      validateDestinationCatalog(catalogWith({ includeInRouteForm: true })),
    ).toThrow(/walkToStopMeters/u);
  });

  it("負の値を拒否する", () => {
    expect(() =>
      validateDestinationCatalog(
        catalogWith({ includeInRouteForm: true, walkToStopMeters: -1 }),
      ),
    ).toThrow(/walkToStopMeters/u);
  });

  it("小数を拒否する", () => {
    expect(() =>
      validateDestinationCatalog(
        catalogWith({ includeInRouteForm: true, walkToStopMeters: 12.5 }),
      ),
    ).toThrow(/walkToStopMeters/u);
  });

  it("文字列を拒否する", () => {
    expect(() =>
      validateDestinationCatalog(
        catalogWith({ includeInRouteForm: true, walkToStopMeters: "537" }),
      ),
    ).toThrow(/walkToStopMeters/u);
  });
});

describe("findOsmElementKey", () => {
  it("OSM要素のURLからnode/way/relationの組を返す", () => {
    expect(
      findOsmElementKey(["https://www.openstreetmap.org/way/12345"]),
    ).toBe("way/12345");
  });

  it("OSM要素がなければnullを返す", () => {
    expect(
      findOsmElementKey(["https://www.wikidata.org/entity/Q1"]),
    ).toBeNull();
  });
});
