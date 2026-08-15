import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { KeyLocation } from "@/utils/addressLoader";

const completeLocation: KeyLocation = {
  id: "kanda-library-日本",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "地域の図書館です",
  descriptionCopyright: "千代田区オープンデータ",
  imageUri: "https://example.test/kanda-library.jpg",
  imageCopyright: "市民写真家",
  uri: "https://example.test/kanda-library",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const minimalLocation: KeyLocation = {
  id: "ogawamachi-hall",
  name: "小川町ホール",
  lat: 35.695,
  lng: 139.765,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

type PublicModule = Record<string, unknown>;
type DetailContentProps = {
  location: KeyLocation;
  areaName: string | null;
  onGoToLocation: (location: KeyLocation) => void;
};
type DetailContent = (props: DetailContentProps) => React.ReactNode;

function getDetailContent(): DetailContent {
  let loaded: unknown;
  try {
    // Guarded runtime loading keeps the missing public component as a named RED.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("../LocationDetailContent");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`LocationDetailContent is not implemented: ${detail}`);
  }

  if (typeof loaded !== "object" || loaded === null) {
    throw new Error("LocationDetailContent is not implemented: public module exported nothing");
  }
  const component = (loaded as PublicModule).default;
  if (typeof component !== "function") {
    throw new Error(
      "LocationDetailContent is not implemented: public module does not export a default component"
    );
  }
  return component as DetailContent;
}

function renderDetailContent(props: DetailContentProps) {
  const element = getDetailContent()(props);
  if (!React.isValidElement(element)) {
    throw new Error("LocationDetailContent did not render a public React element");
  }
  return render(element);
}

describe("LocationDetailContent public contract", () => {
  it("renders primary details, optional display fields, links, and the destination callback", () => {
    const onGoToLocation = jest.fn();

    renderDetailContent({
      location: completeLocation,
      areaName: "神田",
      onGoToLocation,
    });

    expect(screen.getByText(completeLocation.name)).toBeInTheDocument();
    expect(screen.getByText("神田")).toBeInTheDocument();
    expect(screen.getByText(completeLocation.description ?? "")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: completeLocation.name })).toHaveAttribute(
      "src",
      completeLocation.imageUri
    );
    expect(screen.getByText(/座標データ提供/)).toHaveTextContent(
      completeLocation.nodeCopyright
    );
    expect(screen.getByText(/画像提供/)).toHaveTextContent(
      completeLocation.imageCopyright ?? ""
    );
    expect(screen.getByText(/説明文提供/)).toHaveTextContent(
      completeLocation.descriptionCopyright ?? ""
    );
    expect(screen.getByRole("link", { name: "ウェブサイトを見る" })).toHaveAttribute(
      "href",
      completeLocation.uri
    );
    expect(screen.getByRole("link", { name: completeLocation.licence })).toHaveAttribute(
      "href",
      completeLocation.licenceUri
    );

    fireEvent.click(screen.getByRole("button", { name: "ここへ行く" }));
    expect(onGoToLocation).toHaveBeenCalledTimes(1);
    expect(onGoToLocation).toHaveBeenCalledWith(completeLocation);
  });

  it("keeps the name, source, and licence when optional image, description, and area are absent", () => {
    const onGoToLocation = jest.fn();

    renderDetailContent({
      location: minimalLocation,
      areaName: null,
      onGoToLocation,
    });

    expect(screen.getByText(minimalLocation.name)).toBeInTheDocument();
    expect(screen.getByText(/座標データ提供/)).toHaveTextContent(
      minimalLocation.nodeCopyright
    );
    expect(screen.getByRole("link", { name: minimalLocation.licence })).toHaveAttribute(
      "href",
      minimalLocation.licenceUri
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ウェブサイトを見る" })).not.toBeInTheDocument();
    expect(screen.queryByText("神田")).not.toBeInTheDocument();
  });
});
