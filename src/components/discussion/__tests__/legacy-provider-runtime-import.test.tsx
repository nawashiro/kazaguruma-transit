/**
 * T170 ソース契約テスト:
 * 旧 legacy provider (DiscussionDataProvider / DiscussionContentDataProvider /
 * DiscussionManagementDataProvider) が production runtime から import されないことを
 * TypeScript AST 走査で機械的に検証する。
 *
 * - 走査対象: src/app, src/components, src/lib 配下の production ファイル
 *   (__tests__ ディレクトリ内と *.test.ts(x) / *.spec.ts(x) は除外)
 * - 検出対象: import / require / 動的 import / re-export のモジュール指定子を解決し、
 *   3 つの legacy provider ファイルに到達するもの。ただし provider ファイル自身の
 *   self-import と provider 間の相互 import は除外（legacy 互換層の内部結合）。
 * - 現状: DiscussionTabLayout.tsx (naddr 互換ブランチ) が useDiscussionMeta を
 *   DiscussionDataProvider から import しているため、契約1は【意図的な RED】
 *   (intentional-production-behavior) に落ちる。DiscussionContentDataProvider /
 *   DiscussionManagementDataProvider は既に 0 件で GREEN。
 * - 契約3 (useDiscussionMeta の production consumer) はソフト検証（情報提供）で、
 *   RED 判定は契約1のみに基づく。
 *
 * 注意1: jest.setup.js が fs をグローバルにモックしているため、typescript パッ
 *   ケージの初期化（内部で require("fs")）が失敗する。そこで beforeAll で
 *   jest.unmock("fs") して実 fs / 実 typescript を読み直す。
 * 注意2: このテストはファイルシステム全体を走査するため `--runInBand` で実行する
 *   （`npm test -- --runInBand --runTestsByPath src/components/discussion/__tests__/legacy-provider-runtime-import.test.tsx`）。
 */

import path from "path";

type FsModule = typeof import("fs");
type TsModule = typeof import("typescript");

const REPO_ROOT = path.resolve(__dirname, "../../../../");
const PROVIDER_DIR = path.join(REPO_ROOT, "src/components/discussion");

const PROVIDER_BASENAMES = [
  "DiscussionDataProvider.tsx",
  "DiscussionContentDataProvider.tsx",
  "DiscussionManagementDataProvider.tsx",
] as const;

const PROVIDER_PATHS = new Set(PROVIDER_BASENAMES.map((b) => path.join(PROVIDER_DIR, b)));

const SCAN_DIRS = ["src/app", "src/components", "src/lib"].map((d) =>
  path.join(REPO_ROOT, d)
);

/** 走査対象ファイル数の下限。0件の走査で vacuous に合格しないためのガード。 */
const MIN_SCAN_FILE_COUNT = 100;

type ImportHit = {
  /** Repo ルートからのパス */
  file: string;
  line: number;
  specifier: string;
  resolved: string;
};

let realFs: FsModule;
let tsMod: TsModule;

beforeAll(() => {
  // jest.setup.js が fs をグローバルにモックしている（jest.setup.js:89-98: existsSync
  // と readFileSync のみ）。typescript は初期化時に require("fs") し、mock された fs に
  // realpathSync 等が無いためクラッシュする。モックを解除して実モジュールを読み直す。
  // jest.unmock / jest.resetModules はこのテストファイルのモジュールレジストリにのみ
  // 影響する（テストファイルごとにレジストリは独立）。
  jest.unmock("fs");
  jest.resetModules();
  realFs = jest.requireActual("fs") as FsModule;
  tsMod = jest.requireActual("typescript") as TsModule;
});

function collectProductionFiles(): string[] {
  const files: string[] = [];
  for (const root of SCAN_DIRS) {
    if (!realFs.existsSync(root)) {
      continue;
    }
    const queue: string[] = [root];
    while (queue.length > 0) {
      const dir = queue.pop() as string;
      for (const entry of realFs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (
            entry.name === "__tests__" ||
            entry.name === "node_modules" ||
            entry.name.startsWith(".")
          ) {
            continue;
          }
          queue.push(full);
        } else if (
          entry.isFile() &&
          /\.(ts|tsx|js|jsx)$/.test(entry.name) &&
          !/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)
        ) {
          files.push(full);
        }
      }
    }
  }
  return files.sort();
}

/** 相対/エイリアス指定子を実ファイルパスへ解決する。 */
function resolveToFile(specifier: string, fromFile: string): string | null {
  let candidate: string;
  if (specifier.startsWith("@/")) {
    candidate = path.join(REPO_ROOT, "src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    candidate = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }
  if (realFs.existsSync(candidate) && realFs.statSync(candidate).isFile()) {
    return candidate;
  }
  for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
    const withExt = candidate + ext;
    if (realFs.existsSync(withExt) && realFs.statSync(withExt).isFile()) {
      return withExt;
    }
  }
  if (realFs.existsSync(candidate) && realFs.statSync(candidate).isDirectory()) {
    for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
      const index = path.join(candidate, `index${ext}`);
      if (realFs.existsSync(index)) {
        return index;
      }
    }
  }
  return null;
}

/**
 * import 宣言が実際の値（runtime）依存を運ぶか。type-only のみの import は
 * 型消去されるため runtime import とは見なさない。
 */
function isRuntimeImportDeclaration(
  node: import("typescript").ImportDeclaration
): boolean {
  const clause = node.importClause;
  if (!clause) {
    return true; // 副作用 import: `import "module"`
  }
  if (clause.isTypeOnly) {
    return false;
  }
  if (clause.name) {
    return true; // default 束縛は値
  }
  const bindings = clause.namedBindings;
  if (bindings && tsMod.isNamedImports(bindings)) {
    return bindings.elements.some((el) => !el.isTypeOnly);
  }
  return true; // namespace import は値束縛
}

function createSourceFile(
  file: string,
  sourceText: string
): import("typescript").SourceFile {
  const scriptKind = file.endsWith(".tsx") ? tsMod.ScriptKind.TSX : tsMod.ScriptKind.TS;
  return tsMod.createSourceFile(
    file,
    sourceText,
    tsMod.ScriptTarget.Latest,
    true,
    scriptKind
  );
}

/** 契約1: 走査対象の import 指定子から legacy provider へ到達するものを列挙する。 */
function scanLegacyProviderImports(): ImportHit[] {
  const hits: ImportHit[] = [];
  for (const file of collectProductionFiles()) {
    const isProviderFile = PROVIDER_PATHS.has(file);
    const sf = createSourceFile(file, realFs.readFileSync(file, "utf8"));
    const visit = (node: import("typescript").Node): void => {
      let spec: string | null = null;
      let runtime = true;
      let lineNode: import("typescript").Node | null = null;

      if (tsMod.isImportDeclaration(node)) {
        spec =
          node.moduleSpecifier && tsMod.isStringLiteral(node.moduleSpecifier)
            ? node.moduleSpecifier.text
            : null;
        runtime = isRuntimeImportDeclaration(node);
        lineNode = node.moduleSpecifier ?? null;
      } else if (tsMod.isExportDeclaration(node)) {
        spec =
          node.moduleSpecifier && tsMod.isStringLiteral(node.moduleSpecifier)
            ? node.moduleSpecifier.text
            : null;
        runtime = !node.isTypeOnly;
        lineNode = node.moduleSpecifier ?? null;
      } else if (
        tsMod.isImportEqualsDeclaration(node) &&
        tsMod.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        tsMod.isStringLiteral(node.moduleReference.expression)
      ) {
        spec = node.moduleReference.expression.text;
        lineNode = node.moduleReference.expression;
      } else if (tsMod.isCallExpression(node)) {
        const callee = node.expression;
        if (
          tsMod.isIdentifier(callee) &&
          callee.text === "require" &&
          node.arguments.length === 1 &&
          tsMod.isStringLiteral(node.arguments[0])
        ) {
          spec = node.arguments[0].text;
          lineNode = node.arguments[0];
        } else if (
          callee.kind === tsMod.SyntaxKind.ImportKeyword &&
          node.arguments.length === 1 &&
          tsMod.isStringLiteral(node.arguments[0])
        ) {
          spec = node.arguments[0].text;
          lineNode = node.arguments[0];
        }
      }

      if (spec && lineNode) {
        const resolved = resolveToFile(spec, file);
        if (
          runtime &&
          resolved &&
          PROVIDER_PATHS.has(resolved) &&
          !isProviderFile
        ) {
          const line =
            sf.getLineAndCharacterOfPosition(lineNode.getStart(sf)).line + 1;
          hits.push({
            file: path.relative(REPO_ROOT, file),
            line,
            specifier: spec,
            resolved: path.relative(REPO_ROOT, resolved),
          });
        }
      }
      tsMod.forEachChild(node, visit);
    };
    tsMod.forEachChild(sf, visit);
  }
  return hits;
}

/** 契約3 (ソフト検証): useDiscussionMeta を import / re-export する production ファイル。 */
function scanUseDiscussionMetaConsumers(): ImportHit[] {
  const hits: ImportHit[] = [];
  const EXCLUDED = new Set([
    path.join(PROVIDER_DIR, "DiscussionTabLayout.tsx"),
    path.join(PROVIDER_DIR, "DiscussionDataProvider.tsx"),
  ]);
  for (const file of collectProductionFiles()) {
    if (EXCLUDED.has(file)) {
      continue;
    }
    const sf = createSourceFile(file, realFs.readFileSync(file, "utf8"));
    const visit = (node: import("typescript").Node): void => {
      let spec: string | null = null;
      let consumed = false;
      let lineNode: import("typescript").Node | null = null;

      if (tsMod.isImportDeclaration(node)) {
        spec =
          node.moduleSpecifier && tsMod.isStringLiteral(node.moduleSpecifier)
            ? node.moduleSpecifier.text
            : null;
        lineNode = node.moduleSpecifier ?? null;
        const clause = node.importClause;
        if (clause && clause.namedBindings && tsMod.isNamedImports(clause.namedBindings)) {
          consumed = clause.namedBindings.elements.some(
            (el) => (el.propertyName ?? el.name).text === "useDiscussionMeta"
          );
        }
      } else if (tsMod.isExportDeclaration(node)) {
        spec =
          node.moduleSpecifier && tsMod.isStringLiteral(node.moduleSpecifier)
            ? node.moduleSpecifier.text
            : null;
        lineNode = node.moduleSpecifier ?? null;
        if (node.exportClause && tsMod.isNamedExports(node.exportClause)) {
          consumed = node.exportClause.elements.some(
            (el) => (el.propertyName ?? el.name).text === "useDiscussionMeta"
          );
        }
      } else if (
        tsMod.isImportEqualsDeclaration(node) &&
        node.name.text === "useDiscussionMeta"
      ) {
        consumed = true;
        lineNode = node;
      }

      if (consumed && spec && lineNode) {
        const line =
          sf.getLineAndCharacterOfPosition(lineNode.getStart(sf)).line + 1;
        hits.push({
          file: path.relative(REPO_ROOT, file),
          line,
          specifier: spec,
          resolved: path.relative(REPO_ROOT, file),
        });
      }
      tsMod.forEachChild(node, visit);
    };
    tsMod.forEachChild(sf, visit);
  }
  return hits;
}

function formatHits(hits: ImportHit[]): string {
  return hits
    .map(
      (h) =>
        `  - ${h.file}:${h.line} \`${h.specifier}\` (resolved: ${h.resolved})`
    )
    .join("\n");
}

describe("T170: legacy provider の production runtime import 0件 (ソース契約)", () => {
  describe("契約1: DiscussionDataProvider / DiscussionContentDataProvider / DiscussionManagementDataProvider は production runtime から import されない", () => {
    it("production ファイル大量走査の上で legacy provider import が 0件", () => {
      const scanned = collectProductionFiles();
      expect(scanned.length).toBeGreaterThanOrEqual(MIN_SCAN_FILE_COUNT);

      const hits = scanLegacyProviderImports();
      if (hits.length > 0) {
        throw new Error(
          `legacy provider の production runtime import を ${hits.length} 件検出しました:\n${formatHits(
            hits
          )}\n` +
            `DiscussionTabLayout.tsx 由来の検出は naddr 互換ブランチの意図的な既知挙動です。`
        );
      }
      expect(hits).toEqual([]);
    });
  });

  describe("契約3 (ソフト検証・情報提供): DiscussionTabLayout の useDiscussionMeta 再 export の production consumer", () => {
    it("useDiscussionMeta を import する production ファイル数が 0件 (DiscussionTabLayout.tsx / DiscussionDataProvider.tsx 除外)", () => {
      const consumers = scanUseDiscussionMetaConsumers();
      if (consumers.length > 0) {
        console.warn(
          `[T170 ソフト検証] useDiscussionMeta の production consumer を ${consumers.length} 件検出 (RED 判定には影響しない):\n${formatHits(
            consumers
          )}`
        );
      } else {
        console.info(
          "[T170 ソフト検証] useDiscussionMeta の production consumer: 0件"
        );
      }
    });
  });
});
