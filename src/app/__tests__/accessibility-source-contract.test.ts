import fs from "node:fs";
import path from "node:path";

const sourceFiles = [
  "src/app/discussions/create/page.tsx",
  "src/app/locations/page.tsx",
  "src/app/settings/page.tsx",
  "src/components/discussion/EvaluationComponent.tsx",
  "src/components/features/LocationSuggestions.tsx",
  "src/components/layouts/SidebarLayout.tsx",
  "src/components/ui/NpubDisplay.tsx",
  "src/components/ui/ThemeToggle.tsx",
];

const dedicatedPageFiles = [
  "src/app/login/page.tsx",
  "src/app/signup/page.tsx",
  "src/app/location-detail/[id]/page.tsx",
  "src/app/rate-limit/page.tsx",
];

const dedicatedConsumerFiles = [
  ...dedicatedPageFiles,
  "src/components/auth/AuthRoutePage.tsx",
  "src/components/auth/AuthenticationForm.tsx",
  "src/components/features/LocationCard.tsx",
  "src/components/features/LocationDetailContent.tsx",
  "src/components/features/OriginSelector.tsx",
  "src/components/features/DestinationSelector.tsx",
  "src/components/features/RouteSearchResults.tsx",
];

const readSource = (file: string) =>
  fs
    .readFileSync(path.resolve(process.cwd(), file), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("アクセシビリティ実装契約", () => {
  it("対象ソースに手書きSVGを残さない", () => {
    const inlineSvgFiles = sourceFiles.filter((file) =>
      readSource(file).includes("<svg")
    );

    expect(inlineSvgFiles).toEqual([]);
  });

  it("タブの選択状態に無効なarea-selected属性を使わない", () => {
    const invalidFiles = sourceFiles.filter((file) =>
      readSource(file).includes("area-selected")
    );

    expect(invalidFiles).toEqual([]);
  });

  it("設定の自作会話一覧に編集・削除機能を持たせない", () => {
    const settingsSource = readSource("src/app/settings/page.tsx");

    expect(settingsSource).not.toContain("/edit");
    expect(settingsSource).not.toContain("handleDeleteDiscussion");
    expect(settingsSource).not.toContain("showDeleteConfirm");
  });

  it("専用route pageは共通mainと共有見出し境界へ委譲する", () => {
    dedicatedPageFiles.forEach((file) => {
      const source = readSource(file);
      expect(source).not.toMatch(/<main\b/);
      expect(source).not.toMatch(/<h1\b/);
    });

    const authRouteSource = readSource("src/components/auth/AuthRoutePage.tsx");
    expect(authRouteSource).toContain("PageHeader");
    expect(authRouteSource).not.toMatch(/<main\b/);
    expect(authRouteSource).not.toMatch(/<h1\b/);
  });

  it("専用route consumerにmodal-only roleを持ち込まない", () => {
    const modalOnlyRole = /role\s*=\s*[\"'](?:dialog|tablist|menuitem)[\"']/;
    const modalStateAttribute = /aria-modal\s*=\s*[\"']true[\"']/;

    dedicatedConsumerFiles.forEach((file) => {
      const source = readSource(file);
      expect(source).not.toMatch(modalOnlyRole);
      expect(source).not.toMatch(modalStateAttribute);
    });
  });

  it("auth/detail/rateの公開consumerはnative navigation and form markersを持つ", () => {
    const markers: Record<string, RegExp[]> = {
      "src/components/auth/AuthRoutePage.tsx": [/<Link\b/, /AuthenticationForm/],
      "src/components/auth/AuthenticationForm.tsx": [
        /<form\b/,
        /<button\b/,
        /<label\b/,
        /<fieldset\b/,
        /<legend\b/,
      ],
      "src/components/features/LocationCard.tsx": [
        /<Link\b/,
        /encodeURIComponent\(location\.id\)/,
      ],
      "src/components/features/LocationDetailContent.tsx": [/<a\b/, /<button\b/],
      "src/components/features/OriginSelector.tsx": [
        /<form\b/,
        /<InputField\b/,
        /<fieldset\b/,
        /<legend\b/,
      ],
      "src/components/features/DestinationSelector.tsx": [/<form\b/, /<InputField\b/],
      "src/components/features/RouteSearchResults.tsx": [
        /<Link\b/,
        /role=\"alert\"/,
        /source=routes/,
      ],
      "src/app/location-detail/[id]/page.tsx": [
        /PageHeader/,
        /<Link\b/,
        /params: Promise/,
      ],
      "src/app/rate-limit/page.tsx": [
        /PageHeader/,
        /<Link\b/,
        /searchParams: Promise/,
      ],
    };

    Object.entries(markers).forEach(([file, fileMarkers]) => {
      const source = readSource(file);
      fileMarkers.forEach((marker) => expect(source).toMatch(marker));
    });
  });
});
