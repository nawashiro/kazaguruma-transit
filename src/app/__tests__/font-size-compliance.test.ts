import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type * as TypeScript from "typescript";

// jest.setup.js mocks fs for API tests; use the real fs and TypeScript parser here.
jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const MINIMUM_FONT_SIZE_PX = 16;
const SOURCE_ROOTS = ["src/app", "src/components"];
const STYLE_SOURCE_FILES = ["src/app/globals.css"];
const EXCLUDED_PATH_PARTS = ["/api/pdf/", "/__tests__/"];
const CLASS_COMPOSITION_CALLS = new Set([
  "cn",
  "clsx",
  "classnames",
  "classNames",
  "cx",
  "twMerge",
  "twJoin",
  "buildBadgeClassName",
]);
const NON_FONT_SIZE_ARBITRARY_TYPES = new Set([
  "color",
  "family-name",
  "font-family",
  "image",
  "line-height",
  "percentage",
  "position",
  "url",
]);

type SourceFile = {
  path: string;
  content: string;
};

type StaticEvaluation = {
  fragments: string[];
  cannotInspect: boolean;
  fullyStatic: boolean;
  truthinessUnknown: boolean;
};

type ClassNameExpression = StaticEvaluation & {
  line: number;
};

type DeclarationIndex = Map<TypeScript.Node, Map<string, TypeScript.Expression | null>>;

type PropertyResolution = {
  found: boolean;
  expression?: TypeScript.Expression;
  unknown: boolean;
};

function listUiSourceFiles(): string[] {
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

      if (!entry.name.endsWith(".tsx")) continue;
      if (EXCLUDED_PATH_PARTS.some((part) => relativePath.includes(part))) continue;

      files.push(relativePath);
    }
  }

  for (const sourceRoot of SOURCE_ROOTS) {
    visit(path.resolve(process.cwd(), sourceRoot));
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function loadUiSourceFiles(): SourceFile[] {
  return listUiSourceFiles().map((filePath) => ({
    path: filePath,
    content: readFileSync(path.resolve(process.cwd(), filePath), "utf8"),
  }));
}

function loadUiStyleFiles(): SourceFile[] {
  return STYLE_SOURCE_FILES.map((filePath) => ({
    path: filePath,
    content: readFileSync(path.resolve(process.cwd(), filePath), "utf8"),
  }));
}

function parseFontSizeToPx(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?|\.\d+)(px|rem)$/);
  if (!match) return null;

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue)) return null;

  return match[2] === "px" ? numericValue : numericValue * 16;
}

function combineEvaluations(evaluations: StaticEvaluation[]): StaticEvaluation {
  return {
    fragments: evaluations.flatMap((evaluation) => evaluation.fragments),
    cannotInspect: evaluations.some((evaluation) => evaluation.cannotInspect),
    fullyStatic: evaluations.every((evaluation) => evaluation.fullyStatic),
    truthinessUnknown: evaluations.some((evaluation) => evaluation.truthinessUnknown),
  };
}

function knownString(fragment: string): StaticEvaluation {
  return {
    fragments: [fragment],
    cannotInspect: false,
    fullyStatic: true,
    truthinessUnknown: false,
  };
}

function unknownExpression(): StaticEvaluation {
  return {
    fragments: [],
    cannotInspect: true,
    fullyStatic: false,
    truthinessUnknown: true,
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

function propertyName(name: TypeScript.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) {
    return name.expression.text;
  }
  return null;
}

function isScopeNode(node: TypeScript.Node): boolean {
  return ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseBlock(node);
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
      const variableStatement = node.parent.parent;
      if (
        ts.isVariableStatement(variableStatement) &&
        variableStatement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword,
        )
      ) {
        ts.forEachChild(node, visit);
        return;
      }
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

function collectNextFontBindings(sourceFile: TypeScript.SourceFile): Set<string> {
  const fontFactoryNames = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (!statement.moduleSpecifier.text.startsWith("next/font/")) continue;

    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) fontFactoryNames.add(clause.name.text);

    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        fontFactoryNames.add(element.name.text);
      }
    }
  }

  const fontBindings = new Set<string>();
  function visit(node: TypeScript.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      fontFactoryNames.has(node.initializer.expression.text) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0 &&
      nearestScope(node, sourceFile) === sourceFile
    ) {
      fontBindings.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return fontBindings;
}

function declarationScopeFor(
  identifier: TypeScript.Identifier,
  declarations: DeclarationIndex,
): TypeScript.Node | undefined {
  let current: TypeScript.Node | undefined = identifier.parent;

  while (current) {
    const scopeDeclarations = declarations.get(current);
    if (scopeDeclarations?.has(identifier.text)) {
      return current;
    }
    current = current.parent;
  }

  return undefined;
}

function declarationFor(
  identifier: TypeScript.Identifier,
  declarations: DeclarationIndex,
): TypeScript.Expression | null | undefined {
  const scope = declarationScopeFor(identifier, declarations);
  return scope ? declarations.get(scope)?.get(identifier.text) : undefined;
}

function isTopLevelBinding(
  identifier: TypeScript.Identifier,
  declarations: DeclarationIndex,
): boolean {
  const scope = declarationScopeFor(identifier, declarations);
  return scope !== undefined && ts.isSourceFile(scope);
}

function isExternalBinding(
  identifier: TypeScript.Identifier,
  declarations: DeclarationIndex,
): boolean {
  const scope = declarationScopeFor(identifier, declarations);
  return scope === undefined || ts.isFunctionLike(scope);
}

function isExternalClassNameProperty(
  object: TypeScript.Expression,
  name: string,
  declarations: DeclarationIndex,
): boolean {
  if (!/className$/i.test(name) || !ts.isIdentifier(object)) return false;
  return isExternalBinding(object, declarations);
}

function objectProperty(
  expression: TypeScript.Expression,
  name: string,
  declarations: DeclarationIndex,
): PropertyResolution {
  const object = unwrapExpression(expression);
  const binding = ts.isIdentifier(object) ? declarationFor(object, declarations) : object;
  if (binding === null) return { found: false, unknown: true };
  const initializer = binding === undefined ? object : binding;
  if (!initializer || !ts.isObjectLiteralExpression(unwrapExpression(initializer))) {
    return { found: false, unknown: false };
  }

  const literal = unwrapExpression(initializer) as TypeScript.ObjectLiteralExpression;
  let candidate: TypeScript.Expression | undefined;
  let unknownAfterCandidate = false;

  for (const member of literal.properties) {
    if (ts.isSpreadAssignment(member)) {
      unknownAfterCandidate = true;
      continue;
    }

    const memberName = propertyName(member.name);
    if (!memberName) {
      unknownAfterCandidate = true;
      continue;
    }
    if (memberName !== name) continue;

    if (ts.isPropertyAssignment(member)) {
      candidate = member.initializer;
      unknownAfterCandidate = false;
    } else {
      candidate = undefined;
      unknownAfterCandidate = true;
    }
  }

  if (candidate && !unknownAfterCandidate) {
    return { found: true, expression: candidate, unknown: false };
  }
  return { found: false, unknown: unknownAfterCandidate };
}

function calleeName(expression: TypeScript.Expression): string | null {
  const callee = unwrapExpression(expression);
  if (ts.isIdentifier(callee)) return callee.text;
  return null;
}

function evaluateExpression(
  expression: TypeScript.Expression,
  declarations: DeclarationIndex,
  resolving: Set<string> = new Set(),
  nextFontBindings: Set<string> = new Set(),
): StaticEvaluation {
  const node = unwrapExpression(expression);

  if (ts.isStringLiteralLike(node)) return knownString(node.text);

  if (ts.isIdentifier(node)) {
    if (node.text === "undefined" || node.text === "null") {
      return {
        fragments: [],
        cannotInspect: false,
        fullyStatic: true,
        truthinessUnknown: false,
      };
    }

    const initializer = declarationFor(node, declarations);
    if (initializer === undefined) {
      if (/className$/i.test(node.text) && isExternalBinding(node, declarations)) {
        return {
          fragments: [],
          cannotInspect: false,
          fullyStatic: true,
          truthinessUnknown: false,
        };
      }
      return unknownExpression();
    }
    if (initializer === null) {
      return /className$/i.test(node.text) && isExternalBinding(node, declarations)
        ? {
            fragments: [],
            cannotInspect: false,
            fullyStatic: true,
            truthinessUnknown: false,
          }
        : unknownExpression();
    }
    if (resolving.has(node.text)) return unknownExpression();

    const nextResolving = new Set(resolving);
    nextResolving.add(node.text);
    return evaluateExpression(initializer, declarations, nextResolving, nextFontBindings);
  }

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const name = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : ts.isStringLiteralLike(node.argumentExpression)
        ? node.argumentExpression.text
        : null;
    const object = ts.isPropertyAccessExpression(node) ? node.expression : node.expression;
    const member = name
      ? objectProperty(object, name, declarations)
      : { found: false, unknown: true };
    if (member.unknown) return unknownExpression();
    if (
      !member.found &&
      name &&
      (isExternalClassNameProperty(object, name, declarations) ||
        (name === "variable" &&
          ts.isIdentifier(object) &&
          nextFontBindings.has(object.text) &&
          isTopLevelBinding(object, declarations)))
    ) {
      return {
        fragments: [],
        cannotInspect: false,
        fullyStatic: true,
        truthinessUnknown: false,
      };
    }
    return member.found && member.expression
      ? evaluateExpression(member.expression, declarations, resolving, nextFontBindings)
      : unknownExpression();
  }

  if (ts.isTemplateExpression(node)) {
    const fragments = [node.head.text];
    let cannotInspect = false;
    let fullyStatic = true;
    let truthinessUnknown = false;

    for (const span of node.templateSpans) {
      const interpolation = evaluateExpression(
        span.expression,
        declarations,
        resolving,
        nextFontBindings,
      );
      cannotInspect ||= interpolation.cannotInspect;
      fullyStatic &&= interpolation.fullyStatic && interpolation.fragments.length === 1;
      truthinessUnknown ||= interpolation.truthinessUnknown;

      if (interpolation.fullyStatic && interpolation.fragments.length === 1) {
        fragments[fragments.length - 1] += interpolation.fragments[0];
      } else {
        fragments.push(...interpolation.fragments);
      }

      fragments[fragments.length - 1] += span.literal.text;
    }

    return { fragments, cannotInspect, fullyStatic, truthinessUnknown };
  }

  if (ts.isConditionalExpression(node)) {
    return combineEvaluations([
      evaluateExpression(node.whenTrue, declarations, resolving, nextFontBindings),
      evaluateExpression(node.whenFalse, declarations, resolving, nextFontBindings),
    ]);
  }

  if (ts.isBinaryExpression(node)) {
    const left = evaluateExpression(node.left, declarations, resolving, nextFontBindings);
    const right = evaluateExpression(node.right, declarations, resolving, nextFontBindings);

    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      if (left.fullyStatic && right.fullyStatic) {
        return knownString(left.fragments.join("") + right.fragments.join(""));
      }
      return combineEvaluations([left, right]);
    }

    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return left.cannotInspect && left.fragments.length === 0 && right.fragments.length > 0
        ? { ...right, fullyStatic: false, truthinessUnknown: true }
        : left.cannotInspect
          ? combineEvaluations([left, right])
        : right.fragments.length > 0
          ? right
          : combineEvaluations([left, right]);
    }

    if (
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      if (left.fullyStatic && left.fragments.length === 1) {
        const leftValue = left.fragments[0] ?? "";
        if (
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          leftValue.length > 0
        ) {
          return left;
        }
      }
      const combined = combineEvaluations([left, right]);
      return left.truthinessUnknown ? { ...combined, cannotInspect: true } : combined;
    }
  }

  if (ts.isArrayLiteralExpression(node)) {
    return combineEvaluations(
      node.elements.map((element) =>
        ts.isSpreadElement(element)
          ? unknownExpression()
          : evaluateExpression(element, declarations, resolving, nextFontBindings),
      ),
    );
  }

  if (ts.isObjectLiteralExpression(node)) {
    const fragments: string[] = [];
    let cannotInspect = false;

    for (const member of node.properties) {
      if (ts.isSpreadAssignment(member)) {
        cannotInspect = true;
        continue;
      }
      const name = propertyName(member.name);
      if (name) fragments.push(name);
      else cannotInspect = true;
    }

    return {
      fragments,
      cannotInspect,
      fullyStatic: !cannotInspect,
      truthinessUnknown: false,
    };
  }

  if (ts.isCallExpression(node)) {
    const argumentsEvaluation = node.arguments.map((argument) =>
      ts.isSpreadElement(argument)
        ? unknownExpression()
        : evaluateExpression(argument, declarations, resolving, nextFontBindings),
    );
    const evaluation = combineEvaluations(argumentsEvaluation);
    const isKnownCompositionCall = CLASS_COMPOSITION_CALLS.has(calleeName(node.expression) ?? "");

    return {
      ...evaluation,
      cannotInspect: evaluation.cannotInspect || !isKnownCompositionCall,
      fullyStatic: evaluation.fullyStatic && isKnownCompositionCall,
    };
  }

  return unknownExpression();
}

function extractClassNameExpressions(sourceFile: SourceFile): ClassNameExpression[] {
  const parsed = ts.createSourceFile(
    sourceFile.path,
    sourceFile.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = declarationMap(parsed);
  const nextFontBindings = collectNextFontBindings(parsed);
  const expressions: ClassNameExpression[] = [];

  function visit(node: TypeScript.Node): void {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className") {
      const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
      const initializer = node.initializer;

      if (initializer && ts.isStringLiteralLike(initializer)) {
        expressions.push({ ...knownString(initializer.text), line });
      } else if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
        expressions.push({
          ...evaluateExpression(initializer.expression, declarations, new Set(), nextFontBindings),
          line,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(parsed);
  return expressions;
}

function splitClassTokens(value: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let squareDepth = 0;
  let parenthesisDepth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (const character of value) {
    if (quote) {
      token += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if ((character === "'" || character === '"') && (squareDepth > 0 || parenthesisDepth > 0)) {
      quote = character;
      token += character;
      continue;
    }

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
  let quote: string | null = null;
  let escaped = false;

  for (const character of token) {
    if (quote) {
      segment += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if ((character === "'" || character === '"') && (squareDepth > 0 || parenthesisDepth > 0)) {
      quote = character;
      segment += character;
      continue;
    }

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

function arbitraryValue(core: string, opening: "[" | "("): string | null {
  const closing = opening === "[" ? "]" : ")";
  const prefix = `text-${opening}`;
  if (!core.startsWith(prefix)) return null;

  const closingIndex = core.lastIndexOf(closing);
  if (closingIndex < prefix.length) return null;
  const trailing = core.slice(closingIndex + 1);
  if (trailing && !/^\/[^/]+$/.test(trailing)) return null;
  return core.slice(prefix.length, closingIndex);
}

function fontSizeFinding(token: string): { value: string; reason: string } | null {
  const segments = splitTopLevelVariants(token);
  let core = segments[segments.length - 1] ?? "";
  if (core.startsWith("!")) core = core.slice(1);
  if (core.endsWith("!")) core = core.slice(0, -1);

  if (/^text-(?:xs|sm)(?:\/[^/]+)?$/.test(core)) {
    return { value: token, reason: `below ${MINIMUM_FONT_SIZE_PX}px minimum` };
  }

  const arbitrary = arbitraryValue(core, "[") ?? arbitraryValue(core, "(");
  if (arbitrary === null) return null;

  const typeSeparator = arbitrary.indexOf(":");
  const type = typeSeparator > 0 ? arbitrary.slice(0, typeSeparator).toLowerCase() : null;
  if (type && NON_FONT_SIZE_ARBITRARY_TYPES.has(type)) return null;

  const value = type ? arbitrary.slice(typeSeparator + 1) : arbitrary;
  const parsedSize = parseFontSizeToPx(value);
  if (parsedSize === null) {
    return {
      value: token,
      reason: `font size cannot be verified as ${MINIMUM_FONT_SIZE_PX}px or larger`,
    };
  }
  if (parsedSize < MINIMUM_FONT_SIZE_PX) {
    return { value: token, reason: `below ${MINIMUM_FONT_SIZE_PX}px minimum` };
  }

  return null;
}

function findSmallCssDeclarations(sourceFile: SourceFile): string[] {
  const content = sourceFile.content.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
  const violations: string[] = [];
  const stack: Array<{ selector: string; bodyStart: number }> = [];
  let blockStart = 0;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === "{") {
      stack.push({
        selector: content.slice(blockStart, index).trim(),
        bodyStart: index + 1,
      });
      blockStart = index + 1;
      continue;
    }

    if (character !== "}") continue;
    const block = stack.pop();
    if (!block) {
      blockStart = index + 1;
      continue;
    }

    const body = content.slice(block.bodyStart, index);
    if (body.includes("{")) {
      blockStart = index + 1;
      continue;
    }

    const declarations = [...body.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;]+)/g)];
    const selector = block.selector.replace(/\s+/g, " ").trim();
    const isExactRubyRule =
      selector === "rt" &&
      declarations.length === 1 &&
      declarations[0]?.[1].trim() === "70%";

    if (!isExactRubyRule) {
      for (const declaration of declarations) {
        const value = declaration[1].trim();
        const declarationOffset =
          block.bodyStart + (declaration.index ?? 0) + declaration[0].indexOf("font-size");
        const line = content.slice(0, declarationOffset).split("\n").length;
        const parsedSize = parseFontSizeToPx(value);
        const reason =
          parsedSize === null
            ? `font size cannot be verified as ${MINIMUM_FONT_SIZE_PX}px or larger`
            : parsedSize < MINIMUM_FONT_SIZE_PX
              ? `below ${MINIMUM_FONT_SIZE_PX}px minimum`
              : null;

        if (reason) {
          violations.push(`${sourceFile.path}:${line}: font-size ${value} (${reason})`);
        }
      }
    }

    blockStart = index + 1;
  }

  return violations;
}

function needsInspection(evaluation: ClassNameExpression): boolean {
  return evaluation.cannotInspect;
}

function findSmallFontUtilities(sourceFile: SourceFile): string[] {
  const violations: string[] = [];

  for (const expression of extractClassNameExpressions(sourceFile)) {
    for (const fragment of expression.fragments) {
      for (const token of splitClassTokens(fragment)) {
        const finding = fontSizeFinding(token);
        if (finding) {
          violations.push(
            `${sourceFile.path}:${expression.line}: class ${finding.value} (${finding.reason})`,
          );
        }
      }
    }

    if (needsInspection(expression)) {
      violations.push(
        `${sourceFile.path}:${expression.line}: className expression cannot be statically inspected`,
      );
    }
  }

  return violations;
}

describe("UI minimum font-size utility compliance", () => {
  it("inspects only className expressions and handles Tailwind v4 font-size utilities", () => {
    const fixture: SourceFile = {
      path: "fixture.tsx",
      content: [
        'const staticClasses = "text-sm";',
        'const typedClasses = "text-[length:15px]";',
        'const shorthandClasses = "text-(length:--font-size-small)";',
        'const safeClasses = "text-base";',
        "const Fixture = (condition: boolean) => (",
        "  <>",
        '    <p className="text-xs" />',
        '    <p className="text-sm!" />',
        '    <p className="!text-sm" />',
        '    <p className="md:text-[length:15px]" />',
        '    <p className="text-[length:var(--small)]" />',
        '    <p className="text-(length:--font-size-small)" />',
        '    <p className={`text-sm${condition ? " text-base" : ""}`} />',
        '    <p className={condition ? "text-sm" : "text-base"} />',
        '    <p className={["text-base", condition && "text-[length:15px]"]} />',
        '    <p className={cn("text-base", "text-(length:--font-size-small)")} />',
        '    <p className={staticClasses} />',
        '    <p className={typedClasses} />',
        '    <p className={shorthandClasses} />',
        '    <p className={safeClasses} />',
        "  </>",
        ");",
        'const localClassName = "text-sm";',
        "const Local = () => <p className={localClassName} />;",
        "declare const dynamicClasses: string;",
        "declare const props: { className: string };",
        "const Dynamic = () => (",
        "  <>",
        '    <p className={["text-base", dynamicClasses]} />',
        '    <p className={cn("text-base", dynamicClasses)} />',
        '    <p className={condition ? dynamicClasses : "text-base"} />',
        '    <p className={props.className} />',
        "  </>",
        ");",
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "fixture.tsx:7: class text-xs (below 16px minimum)",
      "fixture.tsx:8: class text-sm! (below 16px minimum)",
      "fixture.tsx:9: class !text-sm (below 16px minimum)",
      "fixture.tsx:10: class md:text-[length:15px] (below 16px minimum)",
      "fixture.tsx:11: class text-[length:var(--small)] (font size cannot be verified as 16px or larger)",
      "fixture.tsx:12: class text-(length:--font-size-small) (font size cannot be verified as 16px or larger)",
      "fixture.tsx:13: class text-sm (below 16px minimum)",
      "fixture.tsx:14: class text-sm (below 16px minimum)",
      "fixture.tsx:15: class text-[length:15px] (below 16px minimum)",
      "fixture.tsx:16: class text-(length:--font-size-small) (font size cannot be verified as 16px or larger)",
      "fixture.tsx:17: class text-sm (below 16px minimum)",
      "fixture.tsx:18: class text-[length:15px] (below 16px minimum)",
      "fixture.tsx:19: class text-(length:--font-size-small) (font size cannot be verified as 16px or larger)",
      "fixture.tsx:24: class text-sm (below 16px minimum)",
      "fixture.tsx:29: className expression cannot be statically inspected",
      "fixture.tsx:30: className expression cannot be statically inspected",
      "fixture.tsx:31: className expression cannot be statically inspected",
    ]);
  });

  it("resolves same-name declarations from their lexical scope", () => {
    const fixture: SourceFile = {
      path: "scope-fixture.tsx",
      content: [
        'const classes = "text-base";',
        'const A = () => <p className={classes} />;',
        "function B() {",
        '  const classes = "text-sm";',
        '  return <p className={classes} />;',
        "}",
        "function C() {",
        "  let classes;",
        '  return <p className={classes} />;',
        "}",
        "function D(classes: string) {",
        '  return <p className={classes} />;',
        "}",
        "function E(props: { classes: string }) {",
        "  const { classes } = props;",
        '  return <p className={classes} />;',
        "}",
        "function FunctionShadow() {",
        "  function classes() {}",
        '  return <p className={classes} />;',
        "}",
        "function ClassShadow() {",
        "  class classes {}",
        '  return <p className={classes} />;',
        "}",
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "scope-fixture.tsx:5: class text-sm (below 16px minimum)",
      "scope-fixture.tsx:9: className expression cannot be statically inspected",
      "scope-fixture.tsx:12: className expression cannot be statically inspected",
      "scope-fixture.tsx:16: className expression cannot be statically inspected",
      "scope-fixture.tsx:20: className expression cannot be statically inspected",
      "scope-fixture.tsx:24: className expression cannot be statically inspected",
    ]);
  });

  it("fails closed for unknown class composition calls", () => {
    const fixture: SourceFile = {
      path: "unknown-call-fixture.tsx",
      content: [
        "const Fixture = () => (",
        "  <>",
        '    <p className={makeClasses("text-base")} />',
        '    <p className={makeClasses("text-sm")} />',
        "  </>",
        ");",
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "unknown-call-fixture.tsx:3: className expression cannot be statically inspected",
      "unknown-call-fixture.tsx:4: class text-sm (below 16px minimum)",
      "unknown-call-fixture.tsx:4: className expression cannot be statically inspected",
    ]);
  });

  it("inspects the fallback branch when a static left operand is empty", () => {
    const fixture: SourceFile = {
      path: "fallback-fixture.tsx",
      content: [
        'const maybe = "";',
        'const Fixture = () => <p className={maybe || "text-sm"} />;',
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "fallback-fixture.tsx:2: class text-sm (below 16px minimum)",
    ]);
  });

  it("only permits variable properties produced by next/font bindings", () => {
    const fixture: SourceFile = {
      path: "font-boundary-fixture.tsx",
      content: [
        "import { Geist } from \"next/font/google\";",
        "declare const factory: { variable: string };",
        'const goodFont = Geist({});',
        'const Bad = () => <p className={factory.variable} />;',
        'const Good = () => <p className={goodFont.variable} />;',
        "function ShadowFactory(Geist: () => { variable: string }) {",
        "  const localFont = Geist();",
        '  return <p className={localFont.variable} />;',
        "}",
        "function ShadowResult() {",
        '  const goodFont = "text-base";',
        '  return <p className={goodFont.variable} />;',
        "}",
        "let mutableFont = Geist({});",
        "mutableFont = factory;",
        'const Reassigned = () => <p className={mutableFont.variable} />;',
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "font-boundary-fixture.tsx:4: className expression cannot be statically inspected",
      "font-boundary-fixture.tsx:8: className expression cannot be statically inspected",
      "font-boundary-fixture.tsx:12: className expression cannot be statically inspected",
      "font-boundary-fixture.tsx:16: className expression cannot be statically inspected",
    ]);
  });

  it("keeps unknown logical operands when inspecting fallback classes", () => {
    const fixture: SourceFile = {
      path: "logical-fallback-fixture.tsx",
      content: [
        "declare const condition: boolean;",
        'const maybe = condition && "text-base";',
        'const Fixture = () => <p className={maybe || "text-sm"} />;',
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "logical-fallback-fixture.tsx:3: class text-sm (below 16px minimum)",
      "logical-fallback-fixture.tsx:3: className expression cannot be statically inspected",
    ]);
  });

  it("does not inspect comments, text, attributes, or content arbitrary values as classes", () => {
    const fixture: SourceFile = {
      path: "false-positive-fixture.tsx",
      content: [
        '// className="text-sm"',
        'const text = "text-sm";',
        "const Fixture = () => (",
        "  <>",
        '    {/* className="text-sm" */}',
        '    <p data-class="text-sm" title="text-sm">text-sm</p>',
        '    <p class="text-sm">text-sm</p>',
        '    <p className="before:content-[\'text-sm\'] text-base" />',
        '    <p className="text-[color:var(--text-sm)] text-base" />',
        '    <p className="text-[length:16px] text-lg" />',
        "  </>",
        ");",
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([]);
  });

  it("fails closed for a fully dynamic className expression", () => {
    const fixture: SourceFile = {
      path: "dynamic-fixture.tsx",
      content: [
        "declare const dynamicClasses: string;",
        "declare const props: { foo: string };",
        "const Fixture = () => <p className={dynamicClasses} />;",
        "const Other = () => <p className={props.foo} />;",
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "dynamic-fixture.tsx:3: className expression cannot be statically inspected",
      "dynamic-fixture.tsx:4: className expression cannot be statically inspected",
    ]);
  });

  it("inspects static computed keys in object-form composition calls", () => {
    const fixture: SourceFile = {
      path: "computed-key-fixture.tsx",
      content: [
        "declare const ok: boolean;",
        'const Fixture = () => <p className={cn({ ["text-sm"]: ok })} />;',
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "computed-key-fixture.tsx:2: class text-sm (below 16px minimum)",
    ]);
  });

  it("fails closed for mutable bindings and uncertain local properties", () => {
    const fixture: SourceFile = {
      path: "mutable-property-fixture.tsx",
      content: [
        'let classes = "text-base";',
        'classes = "text-sm";',
        'const Mutable = () => <p className={classes} />;',
        "declare const unknownProps: { className?: string };",
        "const props = {",
        '  className: "text-base",',
        "  ...unknownProps,",
        "};",
        'const Spread = () => <p className={props.className} />;',
        "const accessorProps = {",
        "  get className() {",
        '    return "text-sm";',
        "  },",
        "};",
        'const Accessor = () => <p className={accessorProps.className} />;',
        'const { className } = { className: "text-sm" };',
        'const Destructured = () => <p className={className} />;',
      ].join("\n"),
    };

    expect(findSmallFontUtilities(fixture)).toEqual([
      "mutable-property-fixture.tsx:3: className expression cannot be statically inspected",
      "mutable-property-fixture.tsx:9: className expression cannot be statically inspected",
      "mutable-property-fixture.tsx:15: className expression cannot be statically inspected",
      "mutable-property-fixture.tsx:17: className expression cannot be statically inspected",
    ]);
  });

  it("checks CSS font-size declarations except the exact ruby rule", () => {
    const fixture: SourceFile = {
      path: "fixture.css",
      content: [
        "rt {",
        "  font-size: 70%;",
        "}",
        ".small {",
        "  font-size: 15px;",
        "}",
        ".unknown {",
        "  font-size: var(--font-size);",
        "}",
        "rt.special {",
        "  font-size: 70%;",
        "}",
      ].join("\n"),
    };

    expect(findSmallCssDeclarations(fixture)).toEqual([
      "fixture.css:5: font-size 15px (below 16px minimum)",
      "fixture.css:8: font-size var(--font-size) (font size cannot be verified as 16px or larger)",
      "fixture.css:11: font-size 70% (font size cannot be verified as 16px or larger)",
    ]);
  });

  it("rejects named and arbitrary utility classes below 16px in regular UI source", () => {
    const violations = [
      ...loadUiSourceFiles().flatMap(findSmallFontUtilities),
      ...loadUiStyleFiles().flatMap(findSmallCssDeclarations),
    ];

    expect(violations).toEqual([]);
  });
});
