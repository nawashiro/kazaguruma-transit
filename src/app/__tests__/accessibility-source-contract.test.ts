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
  "src/app/locations/location-detail/[id]/page.tsx",
  "src/app/rate-limit/page.tsx",
];

const dedicatedConsumerFiles = [
  ...dedicatedPageFiles,
  "src/components/auth/AuthRoutePage.tsx",
  "src/components/auth/AuthenticationForm.tsx",
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

  it("バリアフリー表示は状態テキストと外部リンクの安全属性を持つ", () => {
    const barrierSource = readSource(
      "src/components/features/BarrierAccessibility.tsx",
    );
    const wheelchairSourceForStates = readSource(
      "src/lib/location/wheelchair-status.ts",
    );
    for (const state of ["全面", "一部", "非対応", "情報なし"]) {
      expect(wheelchairSourceForStates).toContain(state);
    }
    expect(barrierSource).toContain("バリアフリー情報");
    expect(barrierSource).toContain("情報源: OpenStreetMap");
    expect(barrierSource).toContain('target="_blank"');
    expect(barrierSource).toContain('rel="noopener noreferrer"');
    expect(barrierSource).toContain("sr-only");
    expect(barrierSource).toContain("（新しいタブで開きます）");
    expect(barrierSource).not.toMatch(/aria-label\s*=/);
    expect(barrierSource).toContain("text-base");
    expect(barrierSource).toContain("text-xl");
    expect(barrierSource).toContain("badge");

    const wheelchairSource = readSource("src/lib/location/wheelchair-status.ts");
    expect(wheelchairSource).toContain("入口には段がなく");
    expect(wheelchairSource).toContain("7センチ");
    expect(wheelchairSource).toContain("車いす不可");
    expect(wheelchairSource).toContain("wheelmap.org/nodes/");
    expect(wheelchairSource).toContain("/relation/");

    const detailSource = readSource(
      "src/app/locations/location-detail/[id]/page.tsx",
    );
    expect(detailSource).toContain("BarrierDetailBlock");
    expect(detailSource).toContain("figcaption");
    expect(detailSource).toContain("resolveLocationImage");
    expect(detailSource).toContain("imageLicenseLabel");
    expect(detailSource).toContain("基本情報");
    expect(detailSource).toContain("編集する（OpenStreetMapを開きます）");
    expect(detailSource).toContain("ウェブサイトを開く");
    expect(detailSource).toContain("Wikipediaを開く");
    expect(detailSource).toContain("min-h-[44px]");
    expect(detailSource).toContain("text-base");
    expect(detailSource).toContain('rel="noopener noreferrer"');
    expect(detailSource).toContain("focus-visible:");
    expect(detailSource).toContain("OpeningHoursSection");
    expect(detailSource).toContain("営業時間");
    expect(detailSource).toContain("営業中");
    expect(detailSource).toContain("営業時間外");
    expect(detailSource).toContain("24時間営業");
    expect(detailSource).toContain("目安なので、正確な時間は施設に問い合わせてください。");
    expect(detailSource).toContain("祝日は通常と異なる場合があります。");
    expect(detailSource).toContain("<time");
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
      "src/components/features/OriginSelector.tsx": [/<form\b/, /<InputField\b/, /<LocationFieldset\b/],
      "src/components/features/DestinationSelector.tsx": [/<form\b/, /<InputField\b/, /<LocationFieldset\b/],
      "src/components/features/LocationFieldset.tsx": [/<fieldset\b/, /<legend\b/],
      "src/components/features/RouteSearchResults.tsx": [
        /role="alert"/,
      ],
      "src/components/layouts/Breadcrumbs.tsx": [
        /<Link\b/,
        /aria-label/,
        /aria-current/,
      ],
      "src/app/locations/location-detail/[id]/page.tsx": [
        /PageHeader/,
        /breadcrumbs/,
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
