#!/usr/bin/env node

/**
 * Verify the generated location snapshot and an already-built location-page server.
 *
 * This script deliberately does not run npm build/start or any GTFS/Prisma command.
 * Use --base-url for an isolated `next start`, or --start-server to let this script
 * own a direct `next start` child process. Browser checks are never silently skipped.
 */

import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_FIXTURE_PATH = join(
  SCRIPT_DIRECTORY,
  "fixtures",
  "location-pages",
  "location-pages.json",
);
const DEFAULT_SNAPSHOT_PATH = join(
  REPOSITORY_ROOT,
  "src",
  "generated",
  "location-data.json",
);
const DEFAULT_NEXT_DIRECTORY = join(REPOSITORY_ROOT, ".next");
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_SERVER_PORT = 3079;
const NOT_FOUND_HEADING = "ページが見つかりません";
const NOT_FOUND_MESSAGE = "お探しのページは見つかりませんでした。";
const CHROMIUM_PATH = "/usr/bin/chromium";
let activeOwnedChild = null;

const LOCATION_PAGE_SOURCE_FILES = [
  "src/app/page.tsx",
  "src/app/locations/page.tsx",
  "src/app/locations/[category-id]/page.tsx",
  "src/app/locations/location-detail/[id]/page.tsx",
  "src/components/features/RouteSearchForm.tsx",
  "src/components/features/LocationSuggestions.tsx",
  "src/components/features/LocationCategoryList.tsx",
  "src/components/features/LocationCard.tsx",
];

const GENERATED_JSON_IMPORT_FILES = [
  "src/app/page.tsx",
  "src/app/locations/page.tsx",
  "src/app/locations/[category-id]/page.tsx",
  "src/app/locations/location-detail/[id]/page.tsx",
];

const REQUIRED_APP_PATHS = [
  "/page",
  "/locations/page",
  "/locations/[category-id]/page",
  "/locations/location-detail/[id]/page",
];

const USAGE = `使い方:
  node scripts/verify-location-pages.mjs --mode static
  node scripts/verify-location-pages.mjs --mode runtime --base-url http://127.0.0.1:3079
  node scripts/verify-location-pages.mjs --mode all --start-server --port 3079

オプション:
  --mode static|runtime|all  staticはsnapshot/source/.next、runtimeはHTTP/Chromium、
                            allは両方。省略時はbase-url/start-serverの有無で決まる。
  --base-url URL             起動済みの隔離next startを検証する（サーバーは停止しない）。
  --start-server             npmではなく直接next startを起動し、終了時に停止する。
  --port N                   --start-serverの待受ポート（既定: ${DEFAULT_SERVER_PORT}）。
  --fixture PATH             検証fixture（既定: scripts/fixtures/location-pages/location-pages.json）。
  --snapshot PATH            生成JSON（既定: src/generated/location-data.json）。
  --next-dir PATH            Next成果物（既定: .next）。
  --timeout-ms N             HTTP/Chromium/起動のタイムアウト（既定: ${DEFAULT_TIMEOUT_MS}）。
  --help                     このヘルプを表示する。

runtime/allではChromiumとPuppeteerが必須で、未導入時は前提不足としてnon-zero終了する。
このスクリプトはnpm run build/npm startを実行せず、DB・GTFSを変更しない。
`;

class VerificationLedger {
  constructor() {
    this.passed = 0;
    this.failures = [];
    this.blocked = [];
  }

  pass(label, detail = "") {
    this.passed += 1;
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
  }

  fail(label, detail) {
    const message = `${label}: ${detail}`;
    this.failures.push(message);
    console.error(`FAIL ${message}`);
  }

  block(label, detail) {
    const message = `${label}: ${detail}`;
    this.blocked.push(message);
    console.error(`BLOCKED ${message}`);
  }
}

class VerificationBlockedError extends Error {}

function parsePositiveInteger(value, optionName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} は正の整数で指定してください: ${value}`);
  }
  return parsed;
}

function parsePort(value) {
  const parsed = parsePositiveInteger(value, "--port");
  if (parsed > 65_535) {
    throw new Error(`--port の範囲が不正です: ${value}`);
  }
  return parsed;
}

function resolveOptionPath(value) {
  return resolve(process.cwd(), value);
}

function parseArguments(argv) {
  const options = {
    mode: null,
    baseUrl: null,
    startServer: false,
    port: DEFAULT_SERVER_PORT,
    fixturePath: DEFAULT_FIXTURE_PATH,
    snapshotPath: DEFAULT_SNAPSHOT_PATH,
    nextDirectory: DEFAULT_NEXT_DIRECTORY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--mode":
        options.mode = argv[++index];
        break;
      case "--base-url":
        options.baseUrl = argv[++index];
        break;
      case "--start-server":
        options.startServer = true;
        break;
      case "--port":
        options.port = parsePort(argv[++index]);
        break;
      case "--fixture":
        options.fixturePath = resolveOptionPath(argv[++index]);
        break;
      case "--snapshot":
        options.snapshotPath = resolveOptionPath(argv[++index]);
        break;
      case "--next-dir":
        options.nextDirectory = resolveOptionPath(argv[++index]);
        break;
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInteger(argv[++index], "--timeout-ms");
        break;
      default:
        throw new Error(`不明なオプションです: ${argument}\n\n${USAGE}`);
    }
  }

  if (options.help) {
    return options;
  }

  if (!options.mode) {
    options.mode = options.baseUrl || options.startServer ? "all" : "static";
  }
  if (!["static", "runtime", "all"].includes(options.mode)) {
    throw new Error(`--mode は static、runtime、all のいずれかです: ${options.mode}`);
  }
  if (options.baseUrl && options.startServer) {
    throw new Error("--base-url と --start-server は同時に指定できません");
  }
  if (["runtime", "all"].includes(options.mode) && !options.baseUrl && !options.startServer) {
    throw new Error(
      "runtime/allには--base-url（起動済みサーバー）または--start-serverが必要です",
    );
  }
  if (options.mode === "static" && (options.baseUrl || options.startServer)) {
    throw new Error("--base-url/--start-serverはruntimeまたはallで指定してください");
  }
  if (options.baseUrl) {
    const parsedUrl = new URL(options.baseUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`--base-urlはhttpまたはhttpsで指定してください: ${options.baseUrl}`);
    }
    options.baseUrl = parsedUrl.toString().replace(/\/$/, "");
  }

  return options;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stableJson(value) {
  return JSON.stringify(value);
}

function encodePathSegment(value) {
  return encodeURIComponent(value);
}

function categoryPath(categoryId) {
  return `/locations/${encodePathSegment(categoryId)}`;
}

function detailPath(locationId) {
  return `/locations/location-detail/${encodePathSegment(locationId)}`;
}

function destinationPath(location) {
  return `/?destination=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
}

function compareStableStrings(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function sortedStrings(values) {
  return [...values].sort(compareStableStrings);
}

function createActualCategorySummary(categories) {
  const entries = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      locationIds: sortedStrings(category.locations.map((location) => location.id)),
    }))
    .sort((first, second) => compareStableStrings(first.id, second.id))
    .map(({ id, name, locationIds }) => [id, { name, locationIds }]);
  return Object.fromEntries(entries);
}

function createFixtureCategorySummary(categories) {
  const entries = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      locationIds: sortedStrings(category.locationIds),
    }))
    .sort((first, second) => compareStableStrings(first.id, second.id))
    .map(({ id, name, locationIds }) => [id, { name, locationIds }]);
  return Object.fromEntries(entries);
}

function createActualSuggestionSummary(suggestionCategories) {
  const entries = suggestionCategories
    .map((category) => ({
      categoryName: category.categoryName,
      locationNames: sortedStrings(category.locations.map((location) => location.name)),
    }))
    .sort((first, second) => compareStableStrings(first.categoryName, second.categoryName))
    .map(({ categoryName, locationNames }) => [categoryName, { locationNames }]);
  return Object.fromEntries(entries);
}

function createFixtureSuggestionSummary(suggestionCategories) {
  const entries = suggestionCategories
    .map((category) => ({
      categoryName: category.categoryName,
      locationNames: sortedStrings(category.locationNames),
    }))
    .sort((first, second) => compareStableStrings(first.categoryName, second.categoryName))
    .map(({ categoryName, locationNames }) => [categoryName, { locationNames }]);
  return Object.fromEntries(entries);
}

function validateFixtureShape(fixture) {
  assert(isRecord(fixture), "fixtureのトップレベルはobjectである必要があります");
  assert(isRecord(fixture.snapshot), "fixture.snapshotがありません");
  assert(
    typeof fixture.snapshot.locationsDataVersion === "string" &&
      fixture.snapshot.locationsDataVersion.length > 0,
    "fixture.snapshot.locationsDataVersionが不正です",
  );
  assert(isRecord(fixture.snapshot.counts), "fixture.snapshot.countsがありません");
  for (const countKey of [
    "categoryCount",
    "detailCount",
    "suggestionCategoryCount",
    "suggestionCount",
  ]) {
    assert(
      Number.isInteger(fixture.snapshot.counts[countKey]) && fixture.snapshot.counts[countKey] >= 0,
      `fixture.snapshot.counts.${countKey}が不正です`,
    );
  }
  assert(Array.isArray(fixture.snapshot.categories), "fixture.snapshot.categoriesがありません");
  assert(
    Array.isArray(fixture.snapshot.suggestionCategories),
    "fixture.snapshot.suggestionCategoriesがありません",
  );
  assert(isRecord(fixture.routes), "fixture.routesがありません");
  assert(
    Array.isArray(fixture.facilityCdnSubstrings) && fixture.facilityCdnSubstrings.length === 2,
    "fixture.facilityCdnSubstringsは施設データURLの2件が必要です",
  );
  for (const substring of fixture.facilityCdnSubstrings) {
    assert(typeof substring === "string" && substring.length > 0, "fixtureの施設CDN文字列が不正です");
  }
  assert(
    fixture.facilityCdnSubstrings.some((substring) => substring.includes("main_facilities")) &&
      fixture.facilityCdnSubstrings.some((substring) => substring.includes("town_geojson")),
    "fixture.facilityCdnSubstringsにmain_facilities/town_geojsonの具体的URL断片が必要です",
  );
  assert(
    new Set(fixture.snapshot.categories.map((category) => category.id)).size ===
      fixture.snapshot.categories.length,
    "fixtureのカテゴリIDが重複しています",
  );
  assert(
    new Set(fixture.snapshot.suggestionCategories.map((category) => category.categoryName)).size ===
      fixture.snapshot.suggestionCategories.length,
    "fixtureの候補カテゴリ名が重複しています",
  );
  for (const category of fixture.snapshot.categories) {
    assert(isRecord(category), "fixtureのカテゴリがobjectではありません");
    assert(typeof category.id === "string" && category.id.length > 0, "fixtureのカテゴリIDが不正です");
    assert(typeof category.name === "string" && category.name.length > 0, "fixtureのカテゴリ名が不正です");
    assert(Array.isArray(category.locationIds), `fixtureの施設ID配列がありません: ${category.id}`);
    for (const locationId of category.locationIds) {
      assert(typeof locationId === "string" && locationId.length > 0, `fixtureの施設IDが不正です: ${category.id}`);
    }
  }
  for (const category of fixture.snapshot.suggestionCategories) {
    assert(isRecord(category), "fixtureの候補カテゴリがobjectではありません");
    assert(
      typeof category.categoryName === "string" && category.categoryName.length > 0,
      "fixtureの候補カテゴリ名が不正です",
    );
    assert(
      Array.isArray(category.locationNames),
      `fixtureの候補施設名配列がありません: ${category.categoryName}`,
    );
  }
  for (const routeKey of [
    "representativeCategoryId",
    "spaceCategoryId",
    "representativeDetailId",
    "spaceCategoryLocationId",
    "representativeSuggestionName",
    "unknownCategoryId",
    "unknownDetailId",
  ]) {
    assert(
      typeof fixture.routes[routeKey] === "string" && fixture.routes[routeKey].length > 0,
      `fixture.routes.${routeKey}が不正です`,
    );
  }
}

const STRICT_ISO_8601_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

function daysInIsoMonth(year, month) {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isStrictIso8601Shape(value) {
  if (typeof value !== "string") return false;
  const match = STRICT_ISO_8601_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInIsoMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  if (match[8] !== "Z") {
    const timezoneMatch = /^[+-](\d{2}):(\d{2})$/.exec(match[8]);
    if (!timezoneMatch) return false;
    if (Number(timezoneMatch[1]) > 23 || Number(timezoneMatch[2]) > 59) return false;
  }
  return true;
}

function assertOptionalLocationFields(location) {
  for (const field of [
    "description",
    "descriptionCopyright",
    "imageUri",
    "imageCopyright",
    "imageCopylight",
    "uri",
  ]) {
    if (Object.prototype.hasOwnProperty.call(location, field)) {
      assert(
        location[field] === null || typeof location[field] === "string",
        `施設${field}の型が不正です: ${location.id}`,
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(location, "nodeSourceId")) {
    assert(
      location.nodeSourceId === null ||
        (typeof location.nodeSourceId === "number" && Number.isFinite(location.nodeSourceId)),
      `施設nodeSourceIdの型が不正です: ${location.id}`,
    );
  }
}

function assertCoordinate(value, minimum, maximum, label) {
  assert(typeof value === "number" && Number.isFinite(value), `${label}が有限数ではありません`);
  assert(value >= minimum && value <= maximum, `${label}が範囲外です: ${value}`);
}

function validateSnapshot(fixture, snapshot, ledger) {
  try {
    validateFixtureShape(fixture);
    assert(isRecord(snapshot), "生成JSONのトップレベルはobjectである必要があります");
    assert(
      snapshot.locationsDataVersion === fixture.snapshot.locationsDataVersion,
      `locationsDataVersionが不一致です（期待値 ${fixture.snapshot.locationsDataVersion}、実値 ${snapshot.locationsDataVersion}）`,
    );
    assert(typeof snapshot.generatedAt === "string", "generatedAtが文字列ではありません");
    assert(isStrictIso8601Shape(snapshot.generatedAt), "generatedAtが厳密なISO 8601日時ではありません");
    assert(Number.isFinite(Date.parse(snapshot.generatedAt)), "generatedAtが有効な日時ではありません");
    assert(Array.isArray(snapshot.categories), "categoriesが配列ではありません");
    assert(Array.isArray(snapshot.suggestionCategories), "suggestionCategoriesが配列ではありません");

    for (const category of snapshot.categories) {
      assert(isRecord(category), "生成JSONのカテゴリがobjectではありません");
      assert(typeof category.id === "string" && category.id.length > 0, "カテゴリIDが空です");
      assert(typeof category.name === "string" && category.name.length > 0, `カテゴリ名が空です: ${category.id}`);
      assert(Array.isArray(category.locations), `カテゴリlocationsが配列ではありません: ${category.id}`);
    }
    for (const category of snapshot.suggestionCategories) {
      assert(isRecord(category), "候補カテゴリがobjectではありません");
      assert(
        typeof category.categoryName === "string" && category.categoryName.length > 0,
        "候補カテゴリ名が空です",
      );
      assert(Array.isArray(category.locations), `候補locationsが配列ではありません: ${category.categoryName}`);
    }

    assert(
      new Set(snapshot.categories.map((category) => category.id)).size === snapshot.categories.length,
      "カテゴリIDが重複しています",
    );
    assert(
      new Set(snapshot.suggestionCategories.map((category) => category.categoryName)).size ===
        snapshot.suggestionCategories.length,
      "候補カテゴリ名が重複しています",
    );

    const expectedCounts = fixture.snapshot.counts;
    const actualCounts = {
      categoryCount: snapshot.categories.length,
      detailCount: snapshot.categories.reduce((count, category) => count + category.locations.length, 0),
      suggestionCategoryCount: snapshot.suggestionCategories.length,
      suggestionCount: snapshot.suggestionCategories.reduce(
        (count, category) => count + category.locations.length,
        0,
      ),
    };
    assert(
      stableJson(actualCounts) === stableJson(expectedCounts),
      `スナップショット件数が不一致です（期待値 ${stableJson(expectedCounts)}、実値 ${stableJson(actualCounts)}）`,
    );

    const actualCategorySummary = createActualCategorySummary(snapshot.categories);
    assert(
      stableJson(actualCategorySummary) === stableJson(createFixtureCategorySummary(fixture.snapshot.categories)),
      "カテゴリIDをキーにしたカテゴリ名・施設ID集合がfixtureと不一致です",
    );
    const actualSuggestionSummary = createActualSuggestionSummary(snapshot.suggestionCategories);
    assert(
      stableJson(actualSuggestionSummary) ===
        stableJson(createFixtureSuggestionSummary(fixture.snapshot.suggestionCategories)),
      "カテゴリ名をキーにした候補施設名集合がfixtureと不一致です",
    );

    const detailIds = [];
    for (const category of snapshot.categories) {
      for (const location of category.locations) {
        assert(isRecord(location), `施設がobjectではありません: ${category.id}`);
        assert(typeof location.id === "string" && location.id.length > 0, "施設IDが空です");
        assert(typeof location.name === "string" && location.name.length > 0, `施設名が空です: ${location.id}`);
        assertCoordinate(location.lat, -90, 90, `施設緯度: ${location.id}`);
        assertCoordinate(location.lng, -180, 180, `施設経度: ${location.id}`);
        assert(typeof location.areaName === "string" && location.areaName.length > 0, `地域名が空です: ${location.id}`);
        assert(
          typeof location.nodeCopyright === "string" && location.nodeCopyright.length > 0,
          `座標データ提供元が空です: ${location.id}`,
        );
        assert(typeof location.licence === "string" && location.licence.length > 0, `ライセンスが空です: ${location.id}`);
        assert(
          typeof location.licenceUri === "string" && location.licenceUri.length > 0,
          `ライセンスURIが空です: ${location.id}`,
        );
        assertOptionalLocationFields(location);
        detailIds.push(location.id);
      }
    }
    assert(new Set(detailIds).size === detailIds.length, "詳細施設IDが重複しています");

    for (const category of snapshot.suggestionCategories) {
      for (const location of category.locations) {
        assert(isRecord(location), `候補施設がobjectではありません: ${category.categoryName}`);
        assert(typeof location.name === "string" && location.name.length > 0, "候補施設名が空です");
        assertCoordinate(location.lat, -90, 90, `候補施設緯度: ${location.name}`);
        assertCoordinate(location.lng, -180, 180, `候補施設経度: ${location.name}`);
      }
    }

    const allCategoryIds = new Set(snapshot.categories.map((category) => category.id));
    const allDetailIds = new Set(detailIds);
    const routes = fixture.routes;
    assert(allCategoryIds.has(routes.representativeCategoryId), "代表カテゴリIDがsnapshotにありません");
    assert(allCategoryIds.has(routes.spaceCategoryId), "空白を含むカテゴリIDがsnapshotにありません");
    assert(allDetailIds.has(routes.representativeDetailId), "代表詳細IDがsnapshotにありません");
    assert(allDetailIds.has(routes.spaceCategoryLocationId), "空白カテゴリの代表施設IDがsnapshotにありません");
    const representativeCategory = snapshot.categories.find(
      (category) => category.id === routes.representativeCategoryId,
    );
    assert(
      representativeCategory?.locations.some((location) => location.id === routes.representativeDetailId),
      "代表詳細IDが代表カテゴリにありません",
    );
    const spaceCategory = snapshot.categories.find((category) => category.id === routes.spaceCategoryId);
    assert(
      spaceCategory?.locations.some((location) => location.id === routes.spaceCategoryLocationId),
      "空白カテゴリの代表施設IDが所属カテゴリにありません",
    );
    assert(
      fixture.snapshot.suggestionCategories.some((category) =>
        category.locationNames.includes(routes.representativeSuggestionName),
      ),
      "代表候補施設名がfixtureにありません",
    );
    assert(
      snapshot.suggestionCategories.some((category) =>
        category.locations.some((location) => location.name === routes.representativeSuggestionName),
      ),
      "代表候補施設名がsnapshotにありません",
    );
    assert(!allCategoryIds.has(routes.unknownCategoryId), "未知カテゴリfixtureが既知IDと衝突しています");
    assert(!allDetailIds.has(routes.unknownDetailId), "未知詳細fixtureが既知IDと衝突しています");
    assert(routes.spaceCategoryId.includes(" "), "spaceCategoryIdに空白がありません");

    ledger.pass(
      "生成JSONスナップショット",
      `${actualCounts.categoryCount}カテゴリ/${actualCounts.detailCount}詳細/${actualCounts.suggestionCategoryCount}候補カテゴリ/${actualCounts.suggestionCount}候補、空カテゴリ許容・集合比較・ISO/座標範囲・必須/optional項目を検証`,
    );
    return true;
  } catch (error) {
    ledger.fail("生成JSONスナップショット", error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function readJsonFile(filePath, label) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    throw new VerificationBlockedError(
      `${label}を読めません: ${filePath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `${label}のJSONが不正です: ${filePath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

async function checkRuntimeSources(fixture, ledger) {
  const directPageBoundaryFragments = [
    ...fixture.facilityCdnSubstrings,
    "main_facilities.json",
    "key_locations.json",
    "chiyoda_city.json",
  ].map((fragment) => fragment.toLowerCase());
  let allPassed = true;

  for (const relativePath of GENERATED_JSON_IMPORT_FILES) {
    try {
      const source = await readFile(join(REPOSITORY_ROOT, relativePath), "utf8");
      if (!source.includes("@/generated/location-data.json")) {
        ledger.fail("生成JSON参照", `${relativePath}が生成JSONをimportしていません`);
        allPassed = false;
      }
    } catch (error) {
      ledger.fail("生成JSON参照", `${relativePath}を読めません: ${error instanceof Error ? error.message : String(error)}`);
      allPassed = false;
    }
  }

  for (const relativePath of LOCATION_PAGE_SOURCE_FILES) {
    try {
      const source = (await readFile(join(REPOSITORY_ROOT, relativePath), "utf8")).toLowerCase();
      const matched = directPageBoundaryFragments.filter((fragment) => source.includes(fragment));
      if (matched.length > 0) {
        ledger.fail(
          "実行時CDN直接参照境界",
          `${relativePath}に禁止された施設データ参照があります: ${matched.join(", ")}`,
        );
        allPassed = false;
      }
    } catch (error) {
      ledger.fail(
        "実行時CDN直接参照境界",
        `${relativePath}を読めません: ${error instanceof Error ? error.message : String(error)}`,
      );
      allPassed = false;
    }
  }

  try {
    const homeSource = await readFile(join(REPOSITORY_ROOT, "src/app/page.tsx"), "utf8");
    const suggestionsSource = await readFile(
      join(REPOSITORY_ROOT, "src/components/features/LocationSuggestions.tsx"),
      "utf8",
    );
    if (!homeSource.includes("suggestionCategories={locationData.suggestionCategories}")) {
      ledger.fail("生成候補データ参照", "トップページが生成済み候補カテゴリをRouteSearchFormへ渡していません");
      allPassed = false;
    }
    if (!suggestionsSource.includes("if (suggestionCategories !== undefined)")) {
      ledger.fail("生成候補データ参照", "候補selectが生成済み候補カテゴリを優先する分岐を持ちません");
      allPassed = false;
    }
    const categorySource = await readFile(
      join(REPOSITORY_ROOT, "src/app/locations/[category-id]/page.tsx"),
      "utf8",
    );
    const detailSource = await readFile(
      join(REPOSITORY_ROOT, "src/app/locations/location-detail/[id]/page.tsx"),
      "utf8",
    );
    for (const [label, source] of [
      ["カテゴリ", categorySource],
      ["詳細", detailSource],
    ]) {
      if (!source.includes("export const dynamicParams = false;")) {
        ledger.fail(
          "既知SSG・統一404ルート宣言",
          `${label}ページにdynamicParams = falseがありません（未知paramsを統一404へ送る明示ポリシーが必要です）`,
        );
        allPassed = false;
      }
      if (!source.includes("generateStaticParams")) {
        ledger.fail(
          "既知SSG・統一404ルート宣言",
          `${label}ページにgenerateStaticParamsがありません（既知paramsをSSGする生成宣言が必要です）`,
        );
        allPassed = false;
      }
    }
  } catch (error) {
    ledger.fail("既知SSG・統一404ルート宣言", error instanceof Error ? error.message : String(error));
    allPassed = false;
  }

  if (allPassed) {
    ledger.pass(
      "実行時CDN直接参照境界",
      "ページソースの直接施設データ参照なし。既知paramsはgenerateStaticParamsでSSGし、dynamicParams=falseで未知paramsをglobal not-foundへ送る（推移的なランタイム取得はChromiumリクエスト検査で別途確認）",
    );
  }
  return allPassed;
}

async function checkNextBuildArtifacts(fixture, nextDirectory, ledger) {
  const buildIdPath = join(nextDirectory, "BUILD_ID");
  const appPathsManifestPath = join(nextDirectory, "server", "app-paths-manifest.json");

  try {
    await access(buildIdPath, constants.F_OK);
  } catch {
    ledger.block(
      "Next本番生成成果物",
      `${nextDirectory}にBUILD_IDがありません。隔離コピーで直接next buildを実行してから再試行してください`,
    );
    return false;
  }

  let buildId;
  try {
    buildId = (await readFile(buildIdPath, "utf8")).trim();
  } catch (error) {
    ledger.fail("Next本番生成成果物", `BUILD_IDを読めません: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
  if (!buildId) {
    ledger.fail("Next本番生成成果物", "BUILD_IDが空です");
    return false;
  }

  let appPathsManifest;
  try {
    appPathsManifest = JSON.parse(await readFile(appPathsManifestPath, "utf8"));
  } catch (error) {
    ledger.block(
      "Next本番生成成果物",
      `server/app-paths-manifest.jsonを読めません。next buildが未完了または成果物が古い可能性があります (${error instanceof Error ? error.message : String(error)})`,
    );
    return false;
  }

  const missingPaths = REQUIRED_APP_PATHS.filter(
    (route) => !Object.prototype.hasOwnProperty.call(appPathsManifest, route),
  );
  if (missingPaths.length > 0) {
    ledger.fail(
      "Next本番生成成果物",
      `BUILD_ID=${buildId}ですが新しい施設ルートがありません: ${missingPaths.join(", ")}`,
    );
    return false;
  }

  const expectedCategoryCount = fixture.snapshot.counts.categoryCount;
  const expectedDetailCount = fixture.snapshot.counts.detailCount;
  ledger.pass(
    "Next本番生成成果物",
    `BUILD_ID=${buildId}、施設ルートテンプレート4種を確認（${expectedCategoryCount}カテゴリ/${expectedDetailCount}詳細はHTTP巡回で確認）`,
  );
  return true;
}

function makeUrl(baseUrl, path) {
  return new URL(path, `${baseUrl}/`).toString();
}

function isHtmlResponse(response) {
  return (response.headers.get("content-type") || "").toLowerCase().includes("text/html");
}

const NAMED_HTML_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

function decodeHtmlEntities(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#(?:x[0-9a-f]+|\d+));/gi, (entity) => {
    const name = entity.slice(1, -1).toLowerCase();
    const namedValue = NAMED_HTML_ENTITIES.get(name);
    if (namedValue !== undefined) return namedValue;

    const codePoint = name.startsWith("#x")
      ? Number.parseInt(name.slice(2), 16)
      : Number.parseInt(name.slice(1), 10);
    if (
      !Number.isInteger(codePoint) ||
      codePoint < 0 ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return entity;
    }
    return String.fromCodePoint(codePoint);
  });
}

function extractVisibleText(html) {
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  return decodeHtmlEntities(
    bodyHtml
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(?:script|style|template)\b[^>]*>[\s\S]*?<\/(?:script|style|template)>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  );
}

function extractHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
}

function hasHref(hrefs, expectedPath) {
  return hrefs.some((href) => href === expectedPath || decodeURI(href) === expectedPath);
}

function containsOrdinaryLink(html) {
  return /<a\b[^>]*\bhref\s*=\s*["']\/?[^"']+["']/i.test(html);
}

function containsForbiddenCdnReference(html, fixture) {
  const lowerHtml = html.toLowerCase();
  return fixture.facilityCdnSubstrings
    .map((fragment) => fragment.toLowerCase())
    .find((fragment) => lowerHtml.includes(fragment));
}

function summarizeFailures(failures, sampleCount = 5) {
  const sample = failures.slice(0, sampleCount).join(" || ");
  const suffix = failures.length > sampleCount ? " || …" : "";
  return `${failures.length}件失敗${sample ? `（例: ${sample}${suffix}）` : ""}`;
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { accept: "text/html" },
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function validateHtmlResponse(pageResult, expectedStatuses, label) {
  const errors = [];
  const { response, text } = pageResult;
  if (!expectedStatuses.includes(response.status)) {
    errors.push(`HTTP ${response.status}（期待値 ${expectedStatuses.join("または")}）`);
  }
  if (!isHtmlResponse(response)) {
    errors.push(`Content-TypeがHTMLではありません: ${response.headers.get("content-type") || "(なし)"}`);
  }
  if (!/<html\b/i.test(text) || !/<body\b/i.test(text) || text.length < 200) {
    errors.push("本文がusable HTMLではありません");
  }
  if (response.headers.get("location")) {
    errors.push(`予期しないリダイレクト: ${response.headers.get("location")}`);
  }
  return errors;
}

async function checkHttpPages(fixture, snapshot, baseUrl, timeoutMs, ledger) {
  const routes = fixture.routes;
  const categoryById = new Map(snapshot.categories.map((category) => [category.id, category]));
  const locationById = new Map();
  for (const category of snapshot.categories) {
    for (const location of category.locations) {
      locationById.set(location.id, { category, location });
    }
  }

  let serverReachable = false;
  try {
    const probe = await fetchText(makeUrl(baseUrl, "/locations"), timeoutMs);
    serverReachable = probe.response.status > 0;
  } catch (error) {
    ledger.block(
      "HTTPサーバー接続",
      `${baseUrl}に接続できません: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
  if (!serverReachable) {
    ledger.block("HTTPサーバー接続", `${baseUrl}から応答がありません`);
    return false;
  }
  ledger.pass("HTTPサーバー接続", baseUrl);

  let locationsPage;
  try {
    locationsPage = await fetchText(makeUrl(baseUrl, "/locations"), timeoutMs);
  } catch (error) {
    ledger.fail("HTTP一覧ページ", error instanceof Error ? error.message : String(error));
    return false;
  }
  const locationsErrors = validateHtmlResponse(locationsPage, [200], "/locations");
  const locationsHtml = locationsPage.text;
  const locationsVisibleText = extractVisibleText(locationsHtml);
  const locationsHrefs = extractHrefs(locationsHtml);
  if (!locationsVisibleText.includes("場所をさがす")) locationsErrors.push("一覧の日本語見出しがありません");
  if (!containsOrdinaryLink(locationsHtml)) locationsErrors.push("一覧に通常のa hrefリンクがありません");
  for (const category of snapshot.categories) {
    if (!hasHref(locationsHrefs, categoryPath(category.id))) {
      locationsErrors.push(`カテゴリリンクがありません: ${categoryPath(category.id)}`);
    }
  }
  const locationsCdn = containsForbiddenCdnReference(locationsHtml, fixture);
  if (locationsCdn) locationsErrors.push(`HTMLに施設CDN参照があります: ${locationsCdn}`);
  if (locationsErrors.length > 0) {
    ledger.fail("HTTP一覧ページ", summarizeFailures(locationsErrors));
  } else {
    ledger.pass("HTTP一覧ページ", "カテゴリリンク・通常リンク・CDN非参照");
  }

  const categoryFailures = [];
  let categoryChecks = 0;
  for (const expectedCategory of fixture.snapshot.categories) {
    const category = categoryById.get(expectedCategory.id);
    if (!category) {
      categoryFailures.push(`${expectedCategory.id}: snapshotにありません`);
      continue;
    }
    categoryChecks += 1;
    const path = categoryPath(category.id);
    try {
      const pageResult = await fetchText(makeUrl(baseUrl, path), timeoutMs);
      const errors = validateHtmlResponse(pageResult, [200], path);
      const pageHtml = pageResult.text;
      const visibleText = extractVisibleText(pageHtml);
      const hrefs = extractHrefs(pageHtml);
      if (!visibleText.includes(category.name)) errors.push(`カテゴリ名がありません: ${category.name}`);
      if (!containsOrdinaryLink(pageHtml)) errors.push("通常のa hrefリンクがありません");
      const missingDetailLinks = [];
      for (const location of category.locations) {
        if (!hasHref(hrefs, detailPath(location.id))) {
          missingDetailLinks.push(detailPath(location.id));
        }
      }
      if (missingDetailLinks.length > 0) {
        errors.push(
          `詳細リンク不足${missingDetailLinks.length}件（例: ${missingDetailLinks.slice(0, 3).join(", ")}）`,
        );
      }
      const cdnReference = containsForbiddenCdnReference(pageHtml, fixture);
      if (cdnReference) errors.push(`HTMLに施設CDN参照があります: ${cdnReference}`);
      if (errors.length > 0) categoryFailures.push(`${path}: ${errors.join(" / ")}`);
    } catch (error) {
      categoryFailures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (categoryFailures.length > 0) {
    ledger.fail("HTTPカテゴリページ", summarizeFailures(categoryFailures));
  } else {
    ledger.pass("HTTPカテゴリページ", `${categoryChecks}件、全施設リンク・HTML・CDN非参照を確認`);
  }

  const detailFailures = [];
  let detailChecks = 0;
  for (const expectedCategory of fixture.snapshot.categories) {
    const category = categoryById.get(expectedCategory.id);
    if (!category) continue;
    for (const expectedLocationId of expectedCategory.locationIds) {
      const match = locationById.get(expectedLocationId);
      if (!match) {
        detailFailures.push(`${expectedLocationId}: snapshotにありません`);
        continue;
      }
      detailChecks += 1;
      const path = detailPath(match.location.id);
      try {
        const pageResult = await fetchText(makeUrl(baseUrl, path), timeoutMs);
        const errors = validateHtmlResponse(pageResult, [200], path);
        const pageHtml = pageResult.text;
        const visibleText = extractVisibleText(pageHtml);
        const hrefs = extractHrefs(pageHtml);
        if (!visibleText.includes(match.location.name)) errors.push(`施設名がありません: ${match.location.name}`);
        if (!hasHref(hrefs, categoryPath(match.category.id))) {
          errors.push(`所属カテゴリリンクがありません: ${categoryPath(match.category.id)}`);
        }
        if (!visibleText.includes("ここへ行く")) errors.push("施設CTAがありません: ここへ行く");
        if (!hasHref(hrefs, destinationPath(match.location))) {
          errors.push(`目的地CTAのhrefがありません: ${destinationPath(match.location)}`);
        }
        if (!containsOrdinaryLink(pageHtml)) errors.push("通常のa hrefリンクがありません");
        const cdnReference = containsForbiddenCdnReference(pageHtml, fixture);
        if (cdnReference) errors.push(`HTMLに施設CDN参照があります: ${cdnReference}`);
        if (errors.length > 0) detailFailures.push(`${path}: ${errors.join(" / ")}`);
      } catch (error) {
        detailFailures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (detailFailures.length > 0) {
    ledger.fail("HTTP詳細ページ", summarizeFailures(detailFailures));
  } else {
    ledger.pass("HTTP詳細ページ", `${detailChecks}件、所属カテゴリ・CTA・HTML・CDN非参照を確認`);
  }

  const spaceCategory = categoryById.get(routes.spaceCategoryId);
  const encodedSpacePath = categoryPath(routes.spaceCategoryId);
  if (!encodedSpacePath.includes("%20")) {
    ledger.fail("空白カテゴリURL", `URLエンコードがありません: ${encodedSpacePath}`);
  } else if (spaceCategory) {
    try {
      const pageResult = await fetchText(makeUrl(baseUrl, encodedSpacePath), timeoutMs);
      const errors = validateHtmlResponse(pageResult, [200], encodedSpacePath);
      if (!extractVisibleText(pageResult.text).includes(spaceCategory.name)) {
        errors.push(`カテゴリ名がありません: ${spaceCategory.name}`);
      }
      if (errors.length > 0) ledger.fail("空白カテゴリURL", errors.join(" / "));
      else ledger.pass("空白カテゴリURL", encodedSpacePath);
    } catch (error) {
      ledger.fail("空白カテゴリURL", error instanceof Error ? error.message : String(error));
    }
  } else {
    ledger.fail("空白カテゴリURL", `カテゴリがsnapshotにありません: ${routes.spaceCategoryId}`);
  }

  const unknownCases = [
    {
      label: "未知カテゴリURL",
      path: categoryPath(routes.unknownCategoryId),
    },
    {
      label: "未知詳細URL",
      path: detailPath(routes.unknownDetailId),
    },
  ];
  for (const unknownCase of unknownCases) {
    try {
      const pageResult = await fetchText(makeUrl(baseUrl, unknownCase.path), timeoutMs);
      const errors = validateHtmlResponse(pageResult, [404], unknownCase.path);
      const pageHtml = pageResult.text;
      const visibleText = extractVisibleText(pageHtml);
      if (!visibleText.includes(NOT_FOUND_HEADING)) errors.push(`見出しがありません: ${NOT_FOUND_HEADING}`);
      if (!visibleText.includes(NOT_FOUND_MESSAGE)) errors.push(`日本語not-found本文がありません: ${NOT_FOUND_MESSAGE}`);
      const cdnReference = containsForbiddenCdnReference(pageHtml, fixture);
      if (cdnReference) errors.push(`HTMLに施設CDN参照があります: ${cdnReference}`);
      if (errors.length > 0) ledger.fail(unknownCase.label, errors.join(" / "));
      else ledger.pass(unknownCase.label, "HTTP 404、共通見出し・本文・CDN非参照を確認");
    } catch (error) {
      ledger.fail(unknownCase.label, error instanceof Error ? error.message : String(error));
    }
  }

  return true;
}

function isFacilityCdnRequest(url, fixture) {
  const lowerUrl = url.toLowerCase();
  return fixture.facilityCdnSubstrings
    .map((fragment) => fragment.toLowerCase())
    .some((fragment) => lowerUrl.includes(fragment));
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForSelector(page, selector, timeoutMs) {
  await page.waitForSelector(selector, { visible: true, timeout: timeoutMs });
}

async function navigate(page, baseUrl, path, timeoutMs) {
  const response = await page.goto(makeUrl(baseUrl, path), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  if (!response) {
    throw new Error(`ナビゲーション応答がありません: ${path}`);
  }
  return response;
}

async function clickAndWaitForNavigation(page, selector, timeoutMs) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: timeoutMs }),
    page.click(selector),
  ]);
}

function cssAttributeSelector(attribute, value) {
  return `[${attribute}="${value.replaceAll('"', '\\"')}"]`;
}

async function getBodyText(page) {
  return page.evaluate(() => document.body?.innerText || "");
}

async function checkJavaScriptDisabledFlow(page, fixture, snapshot, baseUrl, timeoutMs, errors) {
  const routes = fixture.routes;
  const category = snapshot.categories.find((candidate) => candidate.id === routes.spaceCategoryId);
  if (!category) {
    errors.push(`JS無効フローのカテゴリがありません: ${routes.spaceCategoryId}`);
    return;
  }
  const location = category.locations.find(
    (candidate) => candidate.id === routes.spaceCategoryLocationId,
  );
  if (!location) {
    errors.push(
      `JS無効フローの詳細施設がありません: ${category.id}/${routes.spaceCategoryLocationId}`,
    );
    return;
  }

  await page.setJavaScriptEnabled(false);
  await navigate(page, baseUrl, "/locations", timeoutMs);
  const locationsText = await getBodyText(page);
  if (!locationsText.includes("場所をさがす")) errors.push("JS無効一覧に本文がありません");
  const categorySelector = `nav[aria-label="施設カテゴリ"] ${cssAttributeSelector("href", categoryPath(category.id))}`;
  try {
    await clickAndWaitForNavigation(page, categorySelector, timeoutMs);
  } catch (error) {
    errors.push(`JS無効一覧→カテゴリの通常リンク遷移に失敗: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!page.url().endsWith(categoryPath(category.id))) errors.push(`JS無効カテゴリURLが不一致です: ${page.url()}`);
  const categoryText = await getBodyText(page);
  if (!categoryText.includes(category.name)) errors.push("JS無効カテゴリに本文がありません");

  const detailSelector = cssAttributeSelector("href", detailPath(location.id));
  try {
    await clickAndWaitForNavigation(page, detailSelector, timeoutMs);
  } catch (error) {
    errors.push(`JS無効カテゴリ→詳細の通常リンク遷移に失敗: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!page.url().endsWith(detailPath(location.id))) errors.push(`JS無効詳細URLが不一致です: ${page.url()}`);
  const detailText = await getBodyText(page);
  if (!detailText.includes(location.name)) errors.push("JS無効詳細に本文がありません");
  if (!detailText.includes(`${category.name}カテゴリに戻る`)) errors.push("JS無効詳細に所属カテゴリリンクがありません");

  const categoryBackSelector = cssAttributeSelector("href", categoryPath(category.id));
  try {
    await clickAndWaitForNavigation(page, categoryBackSelector, timeoutMs);
  } catch (error) {
    errors.push(`JS無効詳細→カテゴリの通常リンク遷移に失敗: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!page.url().endsWith(categoryPath(category.id))) errors.push(`JS無効カテゴリ復帰URLが不一致です: ${page.url()}`);
  const unknownCategoryResponse = await navigate(
    page,
    baseUrl,
    categoryPath(routes.unknownCategoryId),
    timeoutMs,
  );
  if (unknownCategoryResponse.status() !== 404) {
    errors.push(`JS無効未知カテゴリのHTTPステータスが404ではありません: ${unknownCategoryResponse.status()}`);
  }
  const unknownCategoryText = await getBodyText(page);
  if (!unknownCategoryText.includes(NOT_FOUND_HEADING)) errors.push(`JS無効未知カテゴリの見出しがありません: ${NOT_FOUND_HEADING}`);
  if (!unknownCategoryText.includes(NOT_FOUND_MESSAGE)) errors.push(`JS無効未知カテゴリの本文がありません: ${NOT_FOUND_MESSAGE}`);
  const unknownDetailResponse = await navigate(
    page,
    baseUrl,
    detailPath(routes.unknownDetailId),
    timeoutMs,
  );
  if (unknownDetailResponse.status() !== 404) {
    errors.push(`JS無効未知詳細のHTTPステータスが404ではありません: ${unknownDetailResponse.status()}`);
  }
  const unknownDetailText = await getBodyText(page);
  if (!unknownDetailText.includes(NOT_FOUND_HEADING)) errors.push(`JS無効未知詳細の見出しがありません: ${NOT_FOUND_HEADING}`);
  if (!unknownDetailText.includes(NOT_FOUND_MESSAGE)) errors.push(`JS無効未知詳細の本文がありません: ${NOT_FOUND_MESSAGE}`);
}

async function describeFocusedElement(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) {
      return {
        insideForm: false,
        tag: "none",
        type: "",
        testId: "",
        name: "",
        value: "",
        checked: null,
        ariaLabel: "",
        isSubmit: false,
        visible: false,
      };
    }
    const form = document.querySelector('form[aria-label="経路検索"]');
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const input = element instanceof HTMLInputElement ? element : null;
    const control =
      element instanceof HTMLInputElement || element instanceof HTMLSelectElement
        ? element
        : null;
    const type =
      element instanceof HTMLInputElement || element instanceof HTMLButtonElement
        ? element.type
        : "";
    return {
      insideForm: Boolean(form && form.contains(element)),
      tag: element.tagName.toLowerCase(),
      type,
      testId: element.getAttribute("data-testid") || "",
      name: element.getAttribute("name") || "",
      value: control?.value || "",
      checked: input?.checked ?? null,
      ariaLabel: element.getAttribute("aria-label") || "",
      isSubmit: element instanceof HTMLButtonElement && element.type === "submit",
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none",
    };
  });
}

async function resetKeyboardTraversal(page) {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

async function reachControlByKeyboard(page, predicate, maxTabs = 100) {
  await resetKeyboardTraversal(page);
  const trace = [];
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    const descriptor = await describeFocusedElement(page);
    trace.push(descriptor);
    if (predicate(descriptor)) return { descriptor, trace };
  }
  return { descriptor: null, trace };
}

async function collectFormKeyboardTrace(page, maxTabs = 100) {
  await resetKeyboardTraversal(page);
  const trace = [];
  let enteredForm = false;
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    const descriptor = await describeFocusedElement(page);
    trace.push(descriptor);
    if (descriptor.insideForm) {
      enteredForm = true;
    } else if (enteredForm) {
      break;
    }
  }
  return trace;
}

function findSuggestionByName(snapshot, name) {
  for (const category of snapshot.suggestionCategories) {
    const location = category.locations.find((candidate) => candidate.name === name);
    if (location) return location;
  }
  return null;
}

function findLocationById(snapshot, id) {
  for (const category of snapshot.categories) {
    const location = category.locations.find((candidate) => candidate.id === id);
    if (location) return location;
  }
  return null;
}

function formatCoordinateSummary(location) {
  return `緯度: ${location.lat.toFixed(6)}, 経度: ${location.lng.toFixed(6)}`;
}

function fullConditionPath(location) {
  const coordinate = `${location.lat},${location.lng}`;
  const searchParams = new URLSearchParams({
    origin: coordinate,
    destination: coordinate,
    time: "2026-09-06T12:00",
    isDeparture: "true",
    prioritizeSpeed: "false",
  });
  return `/?${searchParams.toString()}`;
}

async function selectSuggestionByKeyboard(page, suggestion, timeoutMs, errors) {
  const selector = 'select[data-testid="location-suggestions-select"]';
  const expectedValue = `${suggestion.lat},${suggestion.lng}`;
  const options = await page.$eval(selector, (select) =>
    [...select.options].map((option) => ({
      value: option.value,
      name: option.textContent?.trim() || "",
    })),
  );
  const expectedOptionIndex = options.findIndex(
    (option) => option.value === expectedValue && option.name === suggestion.name,
  );
  const expectedOption = expectedOptionIndex >= 0 ? options[expectedOptionIndex] : null;
  if (!expectedOption) {
    errors.push(`代表候補がselectにありません: ${suggestion.name}`);
    return;
  }
  if (expectedOptionIndex === 0) {
    errors.push(`代表候補がselectの先頭です。非先頭候補をfixtureで指定してください: ${suggestion.name}`);
    return;
  }
  if (!options.some((option) => option.value !== "")) {
    errors.push("候補selectに空でない実在optionがありません");
    return;
  }

  await page.evaluate((selectionSelector, expectedIndex) => {
    const select = document.querySelector(selectionSelector);
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("候補selectが見つかりません");
    }
    globalThis.__verifyLocationSelection = null;
    // Keep intermediate keyboard changes from unmounting the select before the target is reached.
    select.addEventListener(
      "change",
      (event) => {
        const selected = select.selectedOptions[0];
        globalThis.__verifyLocationSelection = {
          value: select.value,
          name: selected?.textContent?.trim() || "",
        };
        if (select.selectedIndex !== expectedIndex) event.stopImmediatePropagation();
      },
      { capture: true },
    );
  }, selector, expectedOptionIndex);
  await page.keyboard.press("Home");
  for (let index = 0; index < expectedOptionIndex; index += 1) {
    await page.keyboard.press("ArrowDown");
  }
  const selectionAfterKeyboard = await page.evaluate(
    () => globalThis.__verifyLocationSelection,
  );
  if (
    selectionAfterKeyboard?.value !== expectedValue ||
    selectionAfterKeyboard?.name !== suggestion.name
  ) {
    await page.keyboard.press("Enter");
  }

  let selectedOption;
  try {
    await page.waitForFunction(
      ({ value, name }) => {
        const selection = globalThis.__verifyLocationSelection;
        return selection?.value === value && selection?.name === name;
      },
      { timeout: timeoutMs },
      { value: expectedOption.value, name: expectedOption.name },
    );
    selectedOption = await page.evaluate(() => globalThis.__verifyLocationSelection);
  } catch {
    errors.push("候補selectのHome/ArrowDown操作で代表候補のchangeイベントを確認できません");
    return;
  }
  if (selectedOption.value !== expectedValue || selectedOption.name !== suggestion.name) {
    errors.push(`候補selectのキーボード選択値が不一致です: ${JSON.stringify(selectedOption)}`);
    return;
  }

  try {
    await page.waitForFunction(
      ({ value, name }) => {
        const summary = document.querySelector('[data-testid="selected-destination"]');
        return summary?.textContent?.trim() === name && value !== "";
      },
      { timeout: timeoutMs },
      { value: selectedOption.value, name: selectedOption.name },
    );
  } catch {
    errors.push("候補selectをキーボード選択してもselected-destinationが候補名になりません");
  }
}

async function checkKeyboardForm(page, fixture, snapshot, baseUrl, timeoutMs, errors) {
  await page.setJavaScriptEnabled(true);
  await navigate(page, baseUrl, "/", timeoutMs);
  await waitForSelector(page, 'form[aria-label="経路検索"]', timeoutMs);
  await waitForSelector(page, 'select[data-testid="location-suggestions-select"]', timeoutMs);

  const formShape = await page.evaluate(() => {
    const forms = [...document.querySelectorAll('form[aria-label="経路検索"]')];
    const form = forms[0];
    return {
      formCount: forms.length,
      nestedFormCount: form ? form.querySelectorAll("form").length : -1,
      sectionHeadings: form
        ? Object.fromEntries(
            [...form.querySelectorAll("h2")].map((heading) => {
              const headingClone = heading.cloneNode(true);
              headingClone.querySelectorAll("rt").forEach((annotation) => annotation.remove());
              return [heading.id, headingClone.textContent?.trim() || ""];
            }),
          )
        : {},
      submitCount: form ? form.querySelectorAll('button[type="submit"]').length : 0,
    };
  });
  if (formShape.formCount !== 1) errors.push(`経路検索formが1つではありません: ${formShape.formCount}`);
  if (formShape.nestedFormCount !== 0) errors.push(`formが入れ子です: ${formShape.nestedFormCount}`);
  const expectedSectionHeadings = {
    "destination-heading": "目的地を選ぶ",
    "origin-heading": "出発地を選ぶ",
    "datetime-heading": "日時",
    "priority-heading": "スピードを選ぶ",
  };
  for (const [id, expected] of Object.entries(expectedSectionHeadings)) {
    const actual = formShape.sectionHeadings[id];
    if (actual !== expected) {
      errors.push(`フォーム見出しがありません: ${id} (expected: ${expected}, actual: ${actual ?? "missing"})`);
    }
  }
  if (formShape.submitCount !== 1) errors.push(`最終submitが1つではありません: ${formShape.submitCount}`);

  const focusTrace = await collectFormKeyboardTrace(page);
  const insideFormTrace = focusTrace.filter((descriptor) => descriptor.insideForm);
  if (!insideFormTrace.some((descriptor) => descriptor.testId === "location-suggestions-select")) {
    errors.push("Tab操作で候補selectに到達できません");
  }
  if (insideFormTrace.filter((descriptor) => descriptor.tag === "input" && descriptor.type === "text").length < 2) {
    errors.push("Tab操作で出発地・目的地のテキスト入力2件に到達できません");
  }
  if (!insideFormTrace.some((descriptor) => descriptor.type === "datetime-local")) {
    errors.push("Tab操作で日時入力に到達できません");
  }
  if (
    insideFormTrace.filter(
      (descriptor) => descriptor.tag === "input" && descriptor.type === "radio",
    ).length < 2
  ) {
    errors.push("Tab操作で日時・優先条件のradioグループへ到達できません");
  }
  if (insideFormTrace.filter((descriptor) => descriptor.tag === "button" && descriptor.type === "button").length < 3) {
    errors.push("Tab操作で検索/GPS等のbuttonに到達できません");
  }
  const reachableSubmitButtons = insideFormTrace.filter((descriptor) => descriptor.isSubmit && descriptor.visible);
  if (reachableSubmitButtons.length !== 1) {
    errors.push(`Tab操作で到達可能な最終submitが1つではありません: ${reachableSubmitButtons.length}`);
  }
  if (insideFormTrace.some((descriptor) => !descriptor.visible)) {
    errors.push("Tab操作中に不可視のフォーカス要素があります");
  }

  const representativeSuggestion = findSuggestionByName(
    snapshot,
    fixture.routes.representativeSuggestionName,
  );
  if (!representativeSuggestion) {
    errors.push(`キーボード候補選択用の施設がありません: ${fixture.routes.representativeSuggestionName}`);
    return;
  }

  const candidateControl = await reachControlByKeyboard(
    page,
    (descriptor) => descriptor.testId === "location-suggestions-select" && descriptor.visible,
  );
  if (!candidateControl.descriptor) {
    errors.push("Tab操作で候補selectへ実際にフォーカスできません");
    return;
  }
  await selectSuggestionByKeyboard(page, representativeSuggestion, timeoutMs, errors);
  if (new URL(page.url()).pathname !== "/") errors.push(`候補選択で予期せず遷移しました: ${page.url()}`);

  const fullConditionLocation = findLocationById(snapshot, fixture.routes.representativeDetailId);
  if (!fullConditionLocation) {
    errors.push(`完全条件URL用の施設がありません: ${fixture.routes.representativeDetailId}`);
    return;
  }
  const fullCondition = fullConditionPath(fullConditionLocation);

  await navigate(page, baseUrl, fullCondition, timeoutMs);
  await waitForSelector(page, '[data-testid="selected-destination"]', timeoutMs);
  await waitForSelector(page, '[data-testid="selected-origin"]', timeoutMs);
  const repairControl = await reachControlByKeyboard(
    page,
    (descriptor) => descriptor.ariaLabel === "目的地をなおす" && descriptor.visible,
  );
  if (!repairControl.descriptor) {
    errors.push("Tab操作で目的地の「なおす」へ実際にフォーカスできません");
  } else {
    await page.keyboard.press("Enter");
    try {
      await page.waitForFunction(
        () => {
          const input = document.querySelector('input[data-testid="address-input"]');
          return (
            input instanceof HTMLInputElement &&
            input.offsetParent !== null &&
            !input.disabled &&
            document.activeElement === input
          );
        },
        { timeout: timeoutMs },
      );
    } catch {
      errors.push("目的地の「なおす」をTab/Enter操作しても入力へフォーカスできません");
    }
  }

  await navigate(page, baseUrl, fullCondition, timeoutMs);
  await waitForSelector(page, 'input[data-testid="departure-radio"]', timeoutMs);
  const departureControl = await reachControlByKeyboard(
    page,
    (descriptor) => descriptor.testId === "departure-radio" && descriptor.visible,
  );
  if (!departureControl.descriptor) {
    errors.push("Tab操作で出発時刻radioへ実際にフォーカスできません");
  } else {
    await page.keyboard.press("ArrowDown");
    try {
      await page.waitForFunction(
        () => {
          const arrival = document.querySelector('[data-testid="arrival-radio"]');
          return arrival instanceof HTMLInputElement && arrival.checked && document.activeElement === arrival;
        },
        { timeout: timeoutMs },
      );
    } catch {
      errors.push("日時radioのArrowDownで到着時刻がcheckedかつfocusedになりません");
    }
    const arrivalControl = await describeFocusedElement(page);
    if (arrivalControl.testId !== "arrival-radio" || arrivalControl.checked !== true) {
      errors.push(`到着時刻radioのフォーカス/checked状態が不正です: ${JSON.stringify(arrivalControl)}`);
    }
  }

  const slowPriorityControl = await reachControlByKeyboard(
    page,
    (descriptor) =>
      descriptor.tag === "input" &&
      descriptor.type === "radio" &&
      descriptor.name === "prioritizeSpeed" &&
      descriptor.value === "false" &&
      descriptor.visible,
  );
  if (!slowPriorityControl.descriptor) {
    errors.push("Tab操作で歩きを最小限の優先radioへ実際にフォーカスできません");
  } else {
    await page.keyboard.press("ArrowDown");
    try {
      await page.waitForFunction(
        () => {
          const fast = [...document.querySelectorAll('input[type="radio"]')].find(
            (input) => input.name === "prioritizeSpeed" && input.value === "true",
          );
          return fast instanceof HTMLInputElement && fast.checked && document.activeElement === fast;
        },
        { timeout: timeoutMs },
      );
    } catch {
      errors.push("優先radioのArrowDownで高速優先がcheckedかつfocusedになりません");
    }
    const fastPriorityControl = await describeFocusedElement(page);
    if (
      fastPriorityControl.name !== "prioritizeSpeed" ||
      fastPriorityControl.value !== "true" ||
      fastPriorityControl.checked !== true
    ) {
      errors.push(`高速優先radioのフォーカス/checked状態が不正です: ${JSON.stringify(fastPriorityControl)}`);
    }
  }

  const finalTrace = await collectFormKeyboardTrace(page);
  const finalSubmitButtons = finalTrace.filter((descriptor) => descriptor.isSubmit && descriptor.visible);
  if (finalSubmitButtons.length !== 1) {
    errors.push(`最終submitのTab到達数が1ではありません: ${finalSubmitButtons.length}`);
  }
  if (new URL(page.url()).pathname !== "/") errors.push(`フォーム検証中にトップ以外へ遷移しました: ${page.url()}`);
}

async function createBrowserPage(browser, fixture, timeoutMs, browserDocumentPaths, facilityCdnRequests) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(timeoutMs);
  page.setDefaultTimeout(timeoutMs);
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const requestUrl = request.url();
    if (request.resourceType() === "document") {
      const pathname = new URL(requestUrl).pathname;
      browserDocumentPaths.add(pathname);
      try {
        browserDocumentPaths.add(decodeURI(pathname));
      } catch {
        // Keep the raw pathname when a request contains malformed escaping.
      }
    }
    if (isFacilityCdnRequest(requestUrl, fixture)) {
      facilityCdnRequests.push(requestUrl);
      void request.abort().catch(() => {});
    } else {
      void request.continue().catch(() => {});
    }
  });
  return page;
}

async function checkBrowser(fixture, snapshot, baseUrl, timeoutMs, ledger) {
  try {
    await access(CHROMIUM_PATH, constants.X_OK);
  } catch {
    ledger.block("Chromiumブラウザ検証", `${CHROMIUM_PATH}が実行可能ではありません。JS無効/CDN/キーボード検証を実行できません`);
    return false;
  }

  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch (error) {
    ledger.block(
      "Puppeteerブラウザ検証",
      `Puppeteerを読み込めません。JS無効/CDN/キーボード検証を実行できません: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }

  let browser;
  let browserReady = false;
  const facilityCdnRequests = [];
  const browserDocumentPaths = new Set();
  const errors = [];
  try {
    try {
      browser = await puppeteer.launch({
        headless: "new",
        executablePath: CHROMIUM_PATH,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      const javaScriptDisabledPage = await createBrowserPage(
        browser,
        fixture,
        timeoutMs,
        browserDocumentPaths,
        facilityCdnRequests,
      );
      browserReady = true;

      try {
        await checkJavaScriptDisabledFlow(
          javaScriptDisabledPage,
          fixture,
          snapshot,
          baseUrl,
          timeoutMs,
          errors,
        );
      } finally {
        await javaScriptDisabledPage.close();
      }

      const page = await createBrowserPage(
        browser,
        fixture,
        timeoutMs,
        browserDocumentPaths,
        facilityCdnRequests,
      );

      const browserBoundaryPaths = [
        "/locations",
        categoryPath(fixture.routes.spaceCategoryId),
        detailPath(fixture.routes.spaceCategoryLocationId),
        "/",
      ];
      await page.setJavaScriptEnabled(true);
      for (const path of browserBoundaryPaths) {
        await navigate(page, baseUrl, path, timeoutMs);
        await sleep(100);
      }
      const missingBrowserRequests = browserBoundaryPaths.filter(
        (path) => !browserDocumentPaths.has(path) && !browserDocumentPaths.has(decodeURI(path)),
      );
      if (missingBrowserRequests.length > 0) {
        errors.push(`Chromiumの実リクエスト未確認: ${missingBrowserRequests.join(", ")}`);
      }

      const destination = findLocationById(snapshot, fixture.routes.representativeDetailId);
      if (!destination) {
        errors.push(`URL初期値検証用の施設がありません: ${fixture.routes.representativeDetailId}`);
      } else {
        const queryPath = destinationPath(destination);
        await navigate(page, baseUrl, queryPath, timeoutMs);
        try {
          await waitForSelector(page, '[data-testid="selected-destination"]', timeoutMs);
          const url = new URL(page.url());
          const expectedCoordinate = `${destination.lat},${destination.lng}`;
          const selectedSummary = await page.$eval(
            '[data-testid="selected-destination"]',
            (element) => element.textContent?.trim() || "",
          );
          if (url.pathname !== "/" || url.searchParams.get("destination") !== expectedCoordinate) {
            errors.push(`有効な目的地URLが保持されません: ${page.url()}`);
          }
          if (selectedSummary !== formatCoordinateSummary(destination)) {
            errors.push(
              `目的地初期値の座標要約が不一致です（期待値 ${formatCoordinateSummary(destination)}、実値 ${selectedSummary}）`,
            );
          }
        } catch {
          errors.push("目的地のみの直接URLで目的地座標/名前の要約が復元されません");
        }
      }

      await checkKeyboardForm(page, fixture, snapshot, baseUrl, timeoutMs, errors);
      await sleep(100);

      if (facilityCdnRequests.length > 0) {
        errors.push(
          `施設データCDNリクエストが発生しました (${facilityCdnRequests.length}件): ${facilityCdnRequests
            .slice(0, 5)
            .join(", ")}`,
        );
      }
    } catch (error) {
      if (!browserReady) {
        ledger.block(
          "Chromiumブラウザ検証",
          `Chromium/Puppeteerの起動準備に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
      }
      errors.push(error instanceof Error ? error.message : String(error));
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        errors.push(`ブラウザ終了に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (errors.length > 0) {
    ledger.fail("Chromium JS無効/CDN/キーボード検証", errors.join(" / "));
    return false;
  }
  ledger.pass("Chromium JS無効/CDN/キーボード検証", "通常リンク往復・目的地URL復元・候補/なおす/ラジオのキーボード操作、施設CDNリクエスト0件");
  return true;
}

function stopChildProcess(child, timeoutMs) {
  return new Promise((resolvePromise) => {
    if (!child || child.exitCode !== null) {
      if (activeOwnedChild === child) activeOwnedChild = null;
      resolvePromise();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      child.removeListener("exit", finish);
      child.removeListener("error", finish);
      if (activeOwnedChild === child) activeOwnedChild = null;
      resolvePromise();
    };
    child.once("exit", finish);
    child.once("error", finish);
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }
    setTimeout(() => {
      if (settled) return;
      try {
        child.kill("SIGKILL");
      } catch {
        // The child may have exited between the timeout and the forced kill.
      }
      setTimeout(finish, 250);
    }, Math.min(timeoutMs, 2_000));
  });
}

function installSignalCleanup(timeoutMs) {
  let signalHandled = false;
  const handleSignal = (signal) => {
    if (signalHandled) return;
    signalHandled = true;
    process.exitCode = signal === "SIGINT" ? 130 : 143;
    void stopChildProcess(activeOwnedChild, timeoutMs).finally(() => {
      process.exit(process.exitCode);
    });
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  return () => {
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
  };
}

async function startOwnedServer(options, ledger) {
  const nextBinary = join(REPOSITORY_ROOT, "node_modules", "next", "dist", "bin", "next");
  try {
    await access(nextBinary, constants.F_OK);
    await access(join(options.nextDirectory, "BUILD_ID"), constants.F_OK);
  } catch {
    throw new VerificationBlockedError(
      `--start-serverにはnext本体と${options.nextDirectory}/BUILD_IDが必要です。npm startではなく、隔離コピーで直接next buildを実行してください`,
    );
  }

  let child;
  try {
    child = spawn(
      process.execPath,
      [nextBinary, "start", options.nextDirectory, "-H", "127.0.0.1", "-p", String(options.port)],
      {
        cwd: REPOSITORY_ROOT,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    throw new VerificationBlockedError(
      `next startプロセスを作成できません: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  activeOwnedChild = child;
  const output = [];
  let childError = null;
  const collect = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.trim()) output.push(line.trim());
      if (output.length > 20) output.shift();
    }
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  child.once("error", (error) => {
    childError = error;
  });

  try {
    const baseUrl = `http://127.0.0.1:${options.port}`;
    const deadline = Date.now() + options.timeoutMs;
    while (Date.now() < deadline) {
      if (childError) {
        throw new VerificationBlockedError(
          `next startで子プロセスerrorが発生しました: ${childError.message} (${output.join(" | ") || "出力なし"})`,
        );
      }
      if (child.exitCode !== null) {
        throw new VerificationBlockedError(`next startが終了しました: ${output.join(" | ") || "出力なし"}`);
      }
      try {
        await fetchText(makeUrl(baseUrl, "/locations"), Math.min(1_000, options.timeoutMs));
        ledger.pass("所有サーバー起動", `${baseUrl}（next-dir=${options.nextDirectory}）`);
        return { child, baseUrl };
      } catch {
        await sleep(100);
      }
    }
    throw new VerificationBlockedError(
      `next startの起動がタイムアウトしました: ${output.join(" | ") || "出力なし"}`,
    );
  } catch (error) {
    await stopChildProcess(child, options.timeoutMs);
    throw error;
  }
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const ledger = new VerificationLedger();
  let ownedServer = null;
  let fixture;
  let snapshot;
  try {
    fixture = await readJsonFile(options.fixturePath, "location-pages fixture");
    snapshot = await readJsonFile(options.snapshotPath, "生成location snapshot");
  } catch (error) {
    if (error instanceof VerificationBlockedError) ledger.block("入力成果物", error.message);
    else ledger.fail("入力成果物", error instanceof Error ? error.message : String(error));
    printSummary(ledger);
    process.exitCode = ledger.failures.length > 0 ? 1 : 2;
    return;
  }

  const snapshotValid = validateSnapshot(fixture, snapshot, ledger);
  if (!snapshotValid) {
    printSummary(ledger);
    process.exitCode = 1;
    return;
  }

  if (["static", "all"].includes(options.mode)) {
    await checkRuntimeSources(fixture, ledger);
    await checkNextBuildArtifacts(fixture, options.nextDirectory, ledger);
  }

  if (["runtime", "all"].includes(options.mode)) {
    let baseUrl = options.baseUrl;
    const removeSignalCleanup = options.startServer
      ? installSignalCleanup(options.timeoutMs)
      : () => {};
    try {
      if (options.startServer) {
        ownedServer = await startOwnedServer(options, ledger);
        baseUrl = ownedServer.baseUrl;
      }
      const serverAvailable = await checkHttpPages(
        fixture,
        snapshot,
        baseUrl,
        options.timeoutMs,
        ledger,
      );
      if (serverAvailable) {
        await checkBrowser(fixture, snapshot, baseUrl, options.timeoutMs, ledger);
      }
    } catch (error) {
      if (error instanceof VerificationBlockedError) ledger.block("runtime検証", error.message);
      else ledger.fail("runtime検証", error instanceof Error ? error.message : String(error));
    } finally {
      if (ownedServer) await stopChildProcess(ownedServer.child, options.timeoutMs);
      removeSignalCleanup();
    }
  }

  printSummary(ledger);
  if (ledger.failures.length > 0) process.exitCode = 1;
  else if (ledger.blocked.length > 0) process.exitCode = 2;
}

function printSummary(ledger) {
  console.log(`結果: PASS ${ledger.passed} / FAIL ${ledger.failures.length} / BLOCKED ${ledger.blocked.length}`);
  if (ledger.failures.length > 0) {
    console.log("失敗した検証:");
    for (const failure of ledger.failures) console.log(`- ${failure}`);
  }
  if (ledger.blocked.length > 0) {
    console.log("前提不足で未実行の検証:");
    for (const blocked of ledger.blocked) console.log(`- ${blocked}`);
  }
}

await main();
