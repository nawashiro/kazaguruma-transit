import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type * as TypeScript from "typescript";

// jest.setup.js mocks fs for API tests; this contract reads the real production tree.
jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const MINIMUM_FONT_SIZE_PX = 16;
const SOURCE_ROOTS = ["src/app", "src/components"];
const KO_FI_SUPPORT_SOURCE = "src/components/features/KoFiSupport.tsx";
const CLASS_COMPOSITION_CALLS = new Set([
  "cn",
  "clsx",
  "classnames",
  "classNames",
  "cx",
  "twMerge",
  "twJoin",
]);
const NAMED_MINIMUM_SIZE_CLASSES = new Set([
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-6xl",
  "text-7xl",
  "text-8xl",
  "text-9xl",
]);
const NAMED_FONT_SIZE_CLASSES = new Set(["text-xs", "text-sm", ...NAMED_MINIMUM_SIZE_CLASSES]);
const TRUSTED_COMPOSITION_IMPORT_SOURCES: Readonly<Record<string, ReadonlySet<string>>> = {
  cn: new Set(["@/lib/utils"]),
  clsx: new Set(["clsx"]),
  classnames: new Set(["classnames"]),
  classNames: new Set(["classnames"]),
  cx: new Set(["class-variance-authority"]),
  twMerge: new Set(["tailwind-merge"]),
  twJoin: new Set(["tailwind-merge"]),
};

type SourceFile = {
  path: string;
  content: string;
};

type StaticEvaluation = {
  alternatives: string[];
  cannotInspect: boolean;
};

type DeclarationIndex = Map<
  TypeScript.Node,
  Map<string, TypeScript.Expression | null>
>;

type CompositionImportIndex = Map<string, string>;

type ControlFinding = {
  path: string;
  line: number;
  tag: string;
  reason: string;
};

function isExcludedUiSourcePath(relativePath: string): boolean {
  const normalizedPath = relativePath.split(path.sep).join("/");
  return (
    normalizedPath.includes("/__tests__/") ||
    normalizedPath.endsWith(".test.tsx") ||
    normalizedPath.endsWith(".spec.tsx") ||
    normalizedPath.includes("/api/pdf/") ||
    normalizedPath.includes("/pdf/") ||
    normalizedPath === KO_FI_SUPPORT_SOURCE
  );
}

function listProductionUiSourcePaths(): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      const relativePath = path
        .relative(process.cwd(), absolutePath)
        .split(path.sep)
        .join("/");
      if (!entry.name.endsWith(".tsx") || isExcludedUiSourcePath(relativePath)) {
        continue;
      }
      files.push(relativePath);
    }
  }

  for (const sourceRoot of SOURCE_ROOTS) {
    visit(path.resolve(process.cwd(), sourceRoot));
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function loadProductionUiSourceFiles(): SourceFile[] {
  return listProductionUiSourcePaths().map((filePath) => ({
    path: filePath,
    content: readFileSync(path.resolve(process.cwd(), filePath), "utf8"),
  }));
}

function knownString(value: string): StaticEvaluation {
  return { alternatives: [value], cannotInspect: false };
}

function unknownExpression(): StaticEvaluation {
  return { alternatives: [""], cannotInspect: true };
}

function capAlternatives(alternatives: string[]): string[] {
  return alternatives.length <= 128 ? alternatives : [""];
}

function concatenateEvaluations(evaluations: StaticEvaluation[]): StaticEvaluation {
  let alternatives = [""];
  let cannotInspect = false;

  for (const evaluation of evaluations) {
    alternatives = capAlternatives(
      alternatives.flatMap((left) =>
        evaluation.alternatives.map((right) => `${left}${right}`),
      ),
    );
    cannotInspect ||= evaluation.cannotInspect;
  }

  return { alternatives, cannotInspect };
}

function unionEvaluations(evaluations: StaticEvaluation[]): StaticEvaluation {
  return {
    alternatives: capAlternatives(evaluations.flatMap((evaluation) => evaluation.alternatives)),
    cannotInspect: evaluations.some((evaluation) => evaluation.cannotInspect),
  };
}

function unwrapExpression(expression: TypeScript.Expression): TypeScript.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isScopeNode(node: TypeScript.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isFunctionLike(node)
  );
}

function nearestScope(node: TypeScript.Node, sourceFile: TypeScript.SourceFile): TypeScript.Node {
  let current: TypeScript.Node | undefined = node.parent;
  while (current) {
    if (isScopeNode(current)) return current;
    current = current.parent;
  }
  return sourceFile;
}

function bindingNames(name: TypeScript.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  if (!ts.isObjectBindingPattern(name) && !ts.isArrayBindingPattern(name)) return [];
  return name.elements.flatMap((element) => {
    if (ts.isOmittedExpression(element)) return [];
    return bindingNames(element.name);
  });
}

function declarationMap(sourceFile: TypeScript.SourceFile): DeclarationIndex {
  const declarations: DeclarationIndex = new Map();

  function visit(node: TypeScript.Node): void {
    if (ts.isFunctionLike(node)) {
      const scopeDeclarations = declarations.get(node) ?? new Map();
      for (const parameter of node.parameters) {
        for (const name of bindingNames(parameter.name)) {
          scopeDeclarations.set(name, null);
        }
      }
      declarations.set(node, scopeDeclarations);
    }

    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    ) {
      const scope = nearestScope(node, sourceFile);
      const scopeDeclarations = declarations.get(scope) ?? new Map();
      scopeDeclarations.set(node.name.text, null);
      declarations.set(scope, scopeDeclarations);
    }

    if (ts.isVariableDeclaration(node)) {
      const scope = nearestScope(node, sourceFile);
      const scopeDeclarations = declarations.get(scope) ?? new Map();
      if (ts.isIdentifier(node.name)) {
        const isConst =
          ts.isVariableDeclarationList(node.parent) &&
          (node.parent.flags & ts.NodeFlags.Const) !== 0;
        scopeDeclarations.set(node.name.text, isConst ? node.initializer ?? null : null);
      } else {
        for (const name of bindingNames(node.name)) {
          scopeDeclarations.set(name, null);
        }
      }
      declarations.set(scope, scopeDeclarations);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

function trustedCompositionHelperForImport(
  importedName: string,
  localName: string,
  moduleName: string,
): string | null {
  for (const helperName of CLASS_COMPOSITION_CALLS) {
    if (!TRUSTED_COMPOSITION_IMPORT_SOURCES[helperName]?.has(moduleName)) continue;
    if (
      importedName === helperName ||
      (importedName === "default" && localName === helperName)
    ) {
      return helperName;
    }
  }
  return null;
}

function collectTrustedCompositionImports(sourceFile: TypeScript.SourceFile): CompositionImportIndex {
  const imports: CompositionImportIndex = new Map();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const moduleName = statement.moduleSpecifier.text;

    if (clause.name) {
      const helperName = trustedCompositionHelperForImport("default", clause.name.text, moduleName);
      if (helperName) imports.set(clause.name.text, helperName);
    }

    if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements) {
      if (element.isTypeOnly) continue;
      const importedName = element.propertyName?.text ?? element.name.text;
      const helperName = trustedCompositionHelperForImport(
        importedName,
        element.name.text,
        moduleName,
      );
      if (helperName) imports.set(element.name.text, helperName);
    }
  }

  return imports;
}

function declarationScopeFor(
  identifier: TypeScript.Identifier,
  declarations: DeclarationIndex,
): TypeScript.Node | undefined {
  let current: TypeScript.Node | undefined = identifier.parent;
  while (current) {
    if (declarations.get(current)?.has(identifier.text)) return current;
    current = current.parent;
  }
  return undefined;
}

function declarationFor(
  identifier: TypeScript.Identifier,
  declarations: DeclarationIndex,
): TypeScript.Expression | null | undefined {
  let current: TypeScript.Node | undefined = identifier.parent;
  while (current) {
    const scopeDeclarations = declarations.get(current);
    if (scopeDeclarations?.has(identifier.text)) {
      return scopeDeclarations.get(identifier.text);
    }
    current = current.parent;
  }
  return undefined;
}

function isTrustedCompositionCall(
  expression: TypeScript.Expression,
  declarations: DeclarationIndex,
  compositionImports: CompositionImportIndex,
): boolean {
  const callee = unwrapExpression(expression);
  if (!ts.isIdentifier(callee)) return false;

  const helperName = compositionImports.get(callee.text);
  if (!helperName || !CLASS_COMPOSITION_CALLS.has(helperName)) return false;

  const shadowingScope = declarationScopeFor(callee, declarations);
  return shadowingScope === undefined || ts.isSourceFile(shadowingScope);
}

function evaluateExpression(
  expression: TypeScript.Expression,
  declarations: DeclarationIndex,
  resolving: Set<string> = new Set(),
  compositionImports: CompositionImportIndex = new Map(),
): StaticEvaluation {
  const node = unwrapExpression(expression);

  if (ts.isStringLiteralLike(node)) return knownString(node.text);
  if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.TrueKeyword) {
    return knownString("");
  }
  if (ts.isIdentifier(node)) {
    if (node.text === "undefined" || node.text === "null") return knownString("");
    const initializer = declarationFor(node, declarations);
    if (!initializer || resolving.has(node.text)) return unknownExpression();
    const nextResolving = new Set(resolving);
    nextResolving.add(node.text);
    return evaluateExpression(initializer, declarations, nextResolving, compositionImports);
  }

  if (ts.isTemplateExpression(node)) {
    const evaluations: StaticEvaluation[] = [knownString(node.head.text)];
    for (const span of node.templateSpans) {
      evaluations.push(
        evaluateExpression(span.expression, declarations, resolving, compositionImports),
      );
      evaluations.push(knownString(span.literal.text));
    }
    return concatenateEvaluations(evaluations);
  }

  if (ts.isConditionalExpression(node)) {
    return unionEvaluations([
      evaluateExpression(node.whenTrue, declarations, resolving, compositionImports),
      evaluateExpression(node.whenFalse, declarations, resolving, compositionImports),
    ]);
  }

  if (ts.isBinaryExpression(node)) {
    const left = evaluateExpression(node.left, declarations, resolving, compositionImports);
    const right = evaluateExpression(node.right, declarations, resolving, compositionImports);
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return concatenateEvaluations([left, right]);
    }
    if (
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return unionEvaluations([left, right, knownString("")]);
    }
  }

  if (ts.isArrayLiteralExpression(node)) {
    return concatenateEvaluations(
      node.elements.map((element) =>
        ts.isSpreadElement(element)
          ? unknownExpression()
          : evaluateExpression(element, declarations, resolving, compositionImports),
      ),
    );
  }

  if (ts.isCallExpression(node)) {
    const argumentsEvaluation = node.arguments.map((argument) =>
      ts.isSpreadElement(argument)
        ? unknownExpression()
        : evaluateExpression(argument, declarations, resolving, compositionImports),
    );
    const evaluation = concatenateEvaluations(argumentsEvaluation);
    return {
      ...evaluation,
      cannotInspect:
        evaluation.cannotInspect ||
        !isTrustedCompositionCall(node.expression, declarations, compositionImports),
    };
  }

  return unknownExpression();
}

function getAttribute(
  element: TypeScript.JsxElement | TypeScript.JsxSelfClosingElement,
  name: string,
): TypeScript.JsxAttribute | undefined {
  const openingElement = ts.isJsxElement(element) ? element.openingElement : element;
  const attribute = openingElement.attributes.properties.find(
    (property): property is TypeScript.JsxAttribute =>
      ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name,
  );
  return attribute;
}

function evaluateAttribute(
  attribute: TypeScript.JsxAttribute | undefined,
  declarations: DeclarationIndex,
  compositionImports: CompositionImportIndex = new Map(),
): StaticEvaluation | null {
  if (!attribute?.initializer) return attribute ? knownString("") : null;
  if (ts.isStringLiteralLike(attribute.initializer)) return knownString(attribute.initializer.text);
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return evaluateExpression(attribute.initializer.expression, declarations, new Set(), compositionImports);
  }
  return unknownExpression();
}

function attributeString(
  attribute: TypeScript.JsxAttribute | undefined,
  declarations: DeclarationIndex,
): string | null {
  const evaluation = evaluateAttribute(attribute, declarations);
  if (!evaluation || evaluation.cannotInspect || evaluation.alternatives.length !== 1) return null;
  return evaluation.alternatives[0] ?? null;
}

function jsxTagName(element: TypeScript.JsxElement | TypeScript.JsxSelfClosingElement): string {
  const tagName = (ts.isJsxElement(element) ? element.openingElement : element).tagName;
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text;
  return tagName.getText();
}

function splitClassTokens(value: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let squareDepth = 0;
  let parenthesisDepth = 0;

  for (const character of value) {
    if (character === "[") squareDepth += 1;
    if (character === "]") squareDepth = Math.max(0, squareDepth - 1);
    if (character === "(") parenthesisDepth += 1;
    if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);

    if (/\s/.test(character) && squareDepth === 0 && parenthesisDepth === 0) {
      if (token) tokens.push(token);
      token = "";
    } else {
      token += character;
    }
  }
  if (token) tokens.push(token);
  return tokens;
}

function splitTopLevelVariants(token: string): string[] {
  const segments: string[] = [];
  let segment = "";
  let squareDepth = 0;
  let parenthesisDepth = 0;

  for (const character of token) {
    if (character === "[") squareDepth += 1;
    if (character === "]") squareDepth = Math.max(0, squareDepth - 1);
    if (character === "(") parenthesisDepth += 1;
    if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);

    if (character === ":" && squareDepth === 0 && parenthesisDepth === 0) {
      segments.push(segment);
      segment = "";
    } else {
      segment += character;
    }
  }
  segments.push(segment);
  return segments;
}

function normalizedClassCore(token: string): string {
  const segments = splitTopLevelVariants(token);
  let core = segments[segments.length - 1] ?? "";
  if (core.startsWith("!")) core = core.slice(1);
  if (core.endsWith("!")) core = core.slice(0, -1);

  const slashIndex = core.indexOf("/");
  return slashIndex >= 0 ? core.slice(0, slashIndex) : core;
}

function parseEquivalentFontSize(token: string): number | null {
  const core = normalizedClassCore(token);
  return NAMED_MINIMUM_SIZE_CLASSES.has(core) ? MINIMUM_FONT_SIZE_PX : null;
}

function isArbitraryFontSizeToken(token: string): boolean {
  const core = normalizedClassCore(token);
  const arbitraryValue = core.startsWith("text-[") && core.endsWith("]")
    ? core.slice(6, -1)
    : core.startsWith("text-(") && core.endsWith(")")
      ? core.slice(6, -1)
      : null;
  if (arbitraryValue === null) return false;

  const typeSeparator = arbitraryValue.indexOf(":");
  return (
    typeSeparator <= 0 ||
    arbitraryValue.slice(0, typeSeparator).trim().toLowerCase() === "length"
  );
}

function hasExplicitMinimumSize(alternatives: string[]): boolean {
  return alternatives.every((alternative) => {
    const tokens = splitClassTokens(alternative);
    if (
      tokens.some((token) => {
        const size = parseEquivalentFontSize(token);
        return size !== null && size >= MINIMUM_FONT_SIZE_PX;
      })
    ) {
      return true;
    }

    const hasBelowMinimumNamedSize = tokens.some((token) => {
      const core = normalizedClassCore(token);
      return NAMED_FONT_SIZE_CLASSES.has(core) && !NAMED_MINIMUM_SIZE_CLASSES.has(core);
    });
    return !hasBelowMinimumNamedSize && tokens.some(isArbitraryFontSizeToken);
  });
}

function hasDaisyUiButtonClass(alternatives: string[]): boolean {
  return alternatives.some((alternative) =>
    splitClassTokens(alternative).some((token) => {
      const core = splitTopLevelVariants(token).at(-1)?.replace(/^!|!$/g, "");
      return core === "btn" || core?.startsWith("btn-") === true;
    }),
  );
}

function isButtonLikeElement(
  element: TypeScript.JsxElement | TypeScript.JsxSelfClosingElement,
  declarations: DeclarationIndex,
  compositionImports: CompositionImportIndex,
): { isButtonLike: boolean; classEvaluation: StaticEvaluation | null } {
  const tagName = jsxTagName(element);
  const classEvaluation = evaluateAttribute(
    getAttribute(element, "className"),
    declarations,
    compositionImports,
  );
  const role = attributeString(getAttribute(element, "role"), declarations);
  const type = attributeString(getAttribute(element, "type"), declarations)?.toLowerCase();
  const nativeButton = tagName === "button";
  const inputButton =
    tagName === "input" &&
    (type === "button" || type === "submit" || type === "reset");
  const ariaButton = role === "button";
  const daisyButton = classEvaluation
    ? hasDaisyUiButtonClass(classEvaluation.alternatives)
    : false;
  // An unresolved className may resolve to `.btn`; anchor-like elements fail closed
  // unless their className is a statically verified navigation-only literal.
  const unresolvedAnchorClassName =
    (tagName === "a" || tagName === "Link") && classEvaluation?.cannotInspect === true;

  return {
    isButtonLike:
      nativeButton || inputButton || ariaButton || daisyButton || unresolvedAnchorClassName,
    classEvaluation,
  };
}

function inspectProductionControls(sourceFile: SourceFile): ControlFinding[] {
  const parsed = ts.createSourceFile(
    sourceFile.path,
    sourceFile.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = declarationMap(parsed);
  const compositionImports = collectTrustedCompositionImports(parsed);
  const findings: ControlFinding[] = [];

  function visit(node: TypeScript.Node): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const { isButtonLike, classEvaluation } = isButtonLikeElement(
        node,
        declarations,
        compositionImports,
      );
      if (isButtonLike) {
        const tag = jsxTagName(node);
        const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
        const classAttribute = getAttribute(node, "className");

        if (!classAttribute) {
          findings.push({
            path: sourceFile.path,
            line,
            tag,
            reason:
              "missing explicit text-base or an equivalent 16px class; native/default control size is not a contract",
          });
        } else if (!classEvaluation || classEvaluation.cannotInspect) {
          findings.push({
            path: sourceFile.path,
            line,
            tag,
            reason:
              "className cannot be statically verified; unresolved button/control classes fail closed",
          });
        } else if (!hasExplicitMinimumSize(classEvaluation.alternatives)) {
          findings.push({
            path: sourceFile.path,
            line,
            tag,
            reason:
              "button/control has no explicit text-base or equivalent 16px class; DaisyUI .btn defaults are not accepted",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(parsed);
  return findings;
}

function inspectSourceText(sourceFile: SourceFile): ControlFinding[] {
  return inspectProductionControls(sourceFile);
}

describe("button/control font-size compliance", () => {
  it("keeps literal navigation anchors separate from unresolved button-like className", () => {
    const fixture: SourceFile = {
      path: "unresolved-anchor-class-fixture.tsx",
      content: [
        "declare const dynamicButtonClassName: string;",
        "const Fixture = () => (",
        "  <>",
        '    <a href="/locations" className="link">場所一覧に戻る</a>',
        '    <a href="/action" className={dynamicButtonClassName}>操作する</a>',
        '    <a href="/safe" className="text-base">通常のリンク</a>',
        "  </>",
        ");",
      ].join("\n"),
    };

    const findings = inspectSourceText(fixture);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tag: "a",
      reason: "className cannot be statically verified; unresolved button/control classes fail closed",
    });
  });

  it("keeps literal navigation Next Links separate and fails closed for unresolved className", () => {
    const fixture: SourceFile = {
      path: "unresolved-next-link-class-fixture.tsx",
      content: [
        'import Link from "next/link";',
        "declare const dynamicButtonClassName: string;",
        "const Fixture = () => (",
        "  <>",
        '    <Link href="/locations" className="link">場所一覧に戻る</Link>',
        '    <Link href="/action" className={dynamicButtonClassName}>操作する</Link>',
        "  </>",
        ");",
      ].join("\n"),
    };

    const findings = inspectSourceText(fixture);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tag: "Link",
      reason: "className cannot be statically verified; unresolved button/control classes fail closed",
    });
  });

  it("reports a bare DaisyUI btn on a native button without an explicit size", () => {
    const fixture: SourceFile = {
      path: "bare-btn-native-fixture.tsx",
      content: 'const Fixture = () => <button className="btn">保存</button>;',
    };

    expect(inspectSourceText(fixture)).toEqual([
      {
        path: fixture.path,
        line: 1,
        tag: "button",
        reason:
          "button/control has no explicit text-base or equivalent 16px class; DaisyUI .btn defaults are not accepted",
      },
    ]);
  });

  it("reports a bare DaisyUI btn on a button-like anchor", () => {
    const fixture: SourceFile = {
      path: "bare-btn-anchor-fixture.tsx",
      content: 'const Fixture = () => <a href="/action" className="btn">操作する</a>;',
    };

    expect(inspectSourceText(fixture)).toEqual([
      {
        path: fixture.path,
        line: 1,
        tag: "a",
        reason:
          "button/control has no explicit text-base or equivalent 16px class; DaisyUI .btn defaults are not accepted",
      },
    ]);
  });

  it("reports a bare DaisyUI btn on a Next Link", () => {
    const fixture: SourceFile = {
      path: "bare-btn-next-link-fixture.tsx",
      content: [
        'import Link from "next/link";',
        'const Fixture = () => <Link href="/action" className="btn">操作する</Link>;',
      ].join("\n"),
    };

    expect(inspectSourceText(fixture)).toEqual([
      {
        path: fixture.path,
        line: 2,
        tag: "Link",
        reason:
          "button/control has no explicit text-base or equivalent 16px class; DaisyUI .btn defaults are not accepted",
      },
    ]);
  });

  it("reports standalone named text-sm on a native button", () => {
    const fixture: SourceFile = {
      path: "standalone-text-sm-native-fixture.tsx",
      content: 'const Fixture = () => <button className="text-sm">保存</button>;',
    };

    expect(inspectSourceText(fixture)).toEqual([
      {
        path: fixture.path,
        line: 1,
        tag: "button",
        reason:
          "button/control has no explicit text-base or equivalent 16px class; DaisyUI .btn defaults are not accepted",
      },
    ]);
  });

  it("requires trusted import provenance for composition helpers and preserves lexical shadowing", () => {
    const fixture: SourceFile = {
      path: "composition-helper-provenance-fixture.tsx",
      content: [
        'import { clsx as mergeClasses } from "clsx";',
        'import { cn as externalCn } from "unproven-composer";',
        'const Imported = () => <button className={mergeClasses("text-base")} />;',
        'const External = () => <button className={externalCn("text-base")} />;',
        'const Unknown = () => <button className={cn("text-base")} />;',
        'const UnknownClassNames = () => <button className={classNames("text-base")} />;',
        'const UnknownCx = () => <button className={cx("text-base")} />;',
        'const UnknownTwMerge = () => <button className={twMerge("text-base")} />;',
        'const UnknownTwJoin = () => <button className={twJoin("text-base")} />;',
        "function Shadowed() {",
        '  const mergeClasses = (value: string) => value;',
        '  return <button className={mergeClasses("text-base")} />;',
        "}",
      ].join("\n"),
    };

    expect(inspectSourceText(fixture)).toEqual([
      {
        path: fixture.path,
        line: 4,
        tag: "button",
        reason: "className cannot be statically verified; unresolved button/control classes fail closed",
      },
      {
        path: fixture.path,
        line: 5,
        tag: "button",
        reason: "className cannot be statically verified; unresolved button/control classes fail closed",
      },
      {
        path: fixture.path,
        line: 6,
        tag: "button",
        reason: "className cannot be statically verified; unresolved button/control classes fail closed",
      },
      {
        path: fixture.path,
        line: 7,
        tag: "button",
        reason: "className cannot be statically verified; unresolved button/control classes fail closed",
      },
      {
        path: fixture.path,
        line: 8,
        tag: "button",
        reason: "className cannot be statically verified; unresolved button/control classes fail closed",
      },
      {
        path: fixture.path,
        line: 9,
        tag: "button",
        reason: "className cannot be statically verified; unresolved button/control classes fail closed",
      },
      {
        path: fixture.path,
        line: 12,
        tag: "button",
        reason: "className cannot be statically verified; unresolved button/control classes fail closed",
      },
    ]);
  });

  it("classifies all native input button types while excluding text inputs", () => {
    const fixture: SourceFile = {
      path: "input-button-types-fixture.tsx",
      content: [
        "const Fixture = () => (",
        "  <>",
        '    <input type="button" aria-label="アクション" />',
        '    <input type="submit" aria-label="送信" />',
        '    <input type="reset" aria-label="リセット" />',
        '    <input type="text" className="text-base" aria-label="検索" />',
        "  </>",
        ");",
      ].join("\n"),
    };

    const findings = inspectSourceText(fixture);

    expect(findings).toHaveLength(3);
    expect(findings.map(({ line }) => line)).toEqual([3, 4, 5]);
    expect(findings.map(({ tag }) => tag)).toEqual(["input", "input", "input"]);
    expect(findings.every(({ reason }) => reason.includes("missing explicit"))).toBe(true);
  });

  it("distinguishes role=button controls from non-button roles", () => {
    const fixture: SourceFile = {
      path: "role-button-boundary-fixture.tsx",
      content: [
        "const Fixture = () => (",
        "  <>",
        '    <div role="link" className="text-base">ナビゲーション</div>',
        '    <div role="button">操作する</div>',
        "  </>",
        ");",
      ].join("\n"),
    };

    const findings = inspectSourceText(fixture);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      line: 4,
      tag: "div",
      reason: "missing explicit text-base or an equivalent 16px class; native/default control size is not a contract",
    });
  });

  it("ignores arbitrary font-size notation without weakening unknown className fail-closed", () => {
    const fixture: SourceFile = {
      path: "arbitrary-font-size-boundary-fixture.tsx",
      content: [
        "declare const dynamicButtonClassName: string;",
        "const Fixture = () => (",
        "  <>",
        '    <button className="btn text-[15px]">任意px</button>',
        '    <button className="btn text-[0.5rem]">任意rem</button>',
        '    <button className="btn text-(length:--font-size-small)">任意変数</button>',
        '    <button className="btn text-[length:16px]">任意length</button>',
        '    <button className="btn text-[theme(fontSize.small)]">任意theme</button>',
        '    <button className="btn text-sm text-[15px]">named違反</button>',
        '    <button className={dynamicButtonClassName}>動的操作</button>',
        "  </>",
        ");",
      ].join("\n"),
    };

    const findings = inspectSourceText(fixture);

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      line: 9,
      tag: "button",
      reason: "button/control has no explicit text-base or equivalent 16px class; DaisyUI .btn defaults are not accepted",
    });
    expect(findings[1]).toMatchObject({
      line: 10,
      tag: "button",
      reason: "className cannot be statically verified; unresolved button/control classes fail closed",
    });
  });

  it("excludes this test source and PDF-only source from the production control inventory", () => {
    const paths = listProductionUiSourcePaths();

    expect(paths.length).toBeGreaterThan(0);
    expect(paths).not.toContain("src/app/__tests__/button-font-size-compliance.test.ts");
    expect(isExcludedUiSourcePath("src/app/__tests__/fixture.tsx")).toBe(true);
    expect(isExcludedUiSourcePath("src/app/api/pdf/generate/route.tsx")).toBe(true);
    expect(isExcludedUiSourcePath(KO_FI_SUPPORT_SOURCE)).toBe(true);
    expect(isExcludedUiSourcePath("src/components/features/RoutePdfExport.tsx")).toBe(false);
    expect(paths.every((filePath) => !isExcludedUiSourcePath(filePath))).toBe(true);
  });

  it("requires every production button and button-like control to state its minimum size", () => {
    const violations = loadProductionUiSourceFiles().flatMap(inspectProductionControls);

    expect(violations).toEqual([]);
  });
});
