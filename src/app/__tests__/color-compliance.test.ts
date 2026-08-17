import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type * as TypeScript from "typescript";

// jest.setup.js mocks fs for API tests; use the real fs and TypeScript parser here.
jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const COMPOSITION_CALLS = new Set(["cn", "clsx", "classnames", "classNames", "cx", "twMerge", "twJoin"]);
const EXCLUDED_PATH_PARTS = ["/api/pdf/", "/__tests__/"];
const EXCLUDED_FILES = new Set(["src/components/features/KoFiSupport.tsx"]);
// Non-canonical arbitrary color syntax is intentionally outside this contract.
const LOW_CONTRAST_TOKEN =
  /^(?:text-(?:black|white)\/(?:[0-9]|[1-9]\d|100|\[[^\]]+\])|text-gray-(?:400|500|600)(?:\/(?:[0-9]|[1-9]\d|100|\[[^\]]+\]))?|text-base-content\/(?:[0-9]|[1-9]\d|100|\[[^\]]+\])|\/(?:[0-9]|[1-9]\d|100|\[[^\]]+\]))$/;

type SourceFile = {
  path: string;
  content: string;
};

type Evaluation = {
  fragments: string[];
  cannotInspect: boolean;
};

type ClassNameExpression = Evaluation & {
  elementName: string;
  line: number;
};

function knownString(fragment: string): Evaluation {
  return { fragments: [fragment], cannotInspect: false };
}

function unknownExpression(): Evaluation {
  return { fragments: [], cannotInspect: true };
}

function combine(evaluations: Evaluation[]): Evaluation {
  return {
    fragments: evaluations.flatMap((evaluation) => evaluation.fragments),
    cannotInspect: evaluations.some((evaluation) => evaluation.cannotInspect),
  };
}

function concatenate(evaluations: Evaluation[]): Evaluation {
  if (evaluations.some((evaluation) => evaluation.cannotInspect)) {
    return unknownExpression();
  }

  return {
    fragments: evaluations.reduce<string[]>(
      (fragments, evaluation) =>
        fragments.flatMap((prefix) =>
          evaluation.fragments.map((fragment) => `${prefix}${fragment}`),
        ),
      [""],
    ),
    cannotInspect: false,
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

function jsxNameText(name: TypeScript.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) {
    return `${jsxNameText(name.expression as TypeScript.JsxTagNameExpression)}.${name.name.text}`;
  }
  if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`;
  return name.getText();
}

type DirectBinding = TypeScript.Expression | null;
type DirectBindings = Map<string, DirectBinding>;
type Binding = { initializer: TypeScript.Expression; scope: Bindings } | null;
type Bindings = Map<string, Binding>;

function addBindingName(
  bindings: DirectBindings,
  name: TypeScript.BindingName,
  initializer?: TypeScript.Expression,
): void {
  if (ts.isIdentifier(name)) {
    bindings.set(name.text, initializer ?? null);
    return;
  }

  for (const element of name.elements) {
    if (ts.isBindingElement(element)) addBindingName(bindings, element.name);
  }
}

function collectDirectBindings(node: TypeScript.Node): DirectBindings {
  const bindings: DirectBindings = new Map();

  function addStatementBindings(statements: readonly TypeScript.Statement[]): void {
    for (const statement of statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          addBindingName(bindings, declaration.name, declaration.initializer ?? undefined);
        }
      } else if (
        (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
        statement.name
      ) {
        bindings.set(statement.name.text, null);
      }
    }
  }

  if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
    addStatementBindings(node.statements);
  }
  if (ts.isCaseBlock(node)) {
    for (const clause of node.clauses) addStatementBindings(clause.statements);
  }
  if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
    addStatementBindings(node.statements);
  }
  if (
    ts.isForStatement(node) &&
    node.initializer &&
    ts.isVariableDeclarationList(node.initializer)
  ) {
    for (const declaration of node.initializer.declarations) {
      addBindingName(bindings, declaration.name, declaration.initializer ?? undefined);
    }
  }
  if (
    (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
    ts.isVariableDeclarationList(node.initializer)
  ) {
    for (const declaration of node.initializer.declarations) {
      addBindingName(bindings, declaration.name, declaration.initializer ?? undefined);
    }
  }

  if (ts.isFunctionLike(node)) {
    if (node.name && ts.isIdentifier(node.name)) bindings.set(node.name.text, null);
    for (const parameter of node.parameters) addBindingName(bindings, parameter.name);
  }
  if (ts.isClassExpression(node) && node.name) {
    bindings.set(node.name.text, null);
  }

  if (ts.isCatchClause(node) && node.variableDeclaration) {
    addBindingName(bindings, node.variableDeclaration.name);
  }

  function markMutationTarget(target: TypeScript.Node): void {
    if (ts.isIdentifier(target)) {
      if (bindings.has(target.text)) bindings.set(target.text, null);
      return;
    }
    if (ts.isBindingElement(target)) {
      markMutationTarget(target.name);
      return;
    }
    if (ts.isSpreadElement(target)) {
      markMutationTarget(target.expression);
      return;
    }
    if (ts.isSpreadAssignment(target)) {
      markMutationTarget(target.expression);
      return;
    }
    if (ts.isParenthesizedExpression(target)) {
      markMutationTarget(target.expression);
      return;
    }
    if (ts.isArrayLiteralExpression(target) || ts.isArrayBindingPattern(target)) {
      for (const element of target.elements) markMutationTarget(element);
      return;
    }
    if (ts.isObjectLiteralExpression(target)) {
      for (const property of target.properties) {
        if (ts.isShorthandPropertyAssignment(property)) {
          markMutationTarget(property.name);
        } else if (ts.isPropertyAssignment(property)) {
          markMutationTarget(property.initializer);
        } else if (ts.isSpreadAssignment(property)) {
          markMutationTarget(property.expression);
        }
      }
      return;
    }
    if (ts.isObjectBindingPattern(target)) {
      for (const element of target.elements) markMutationTarget(element);
    }
  }

  function markMutations(child: TypeScript.Node): void {
    if (
      (ts.isForInStatement(child) || ts.isForOfStatement(child)) &&
      !ts.isVariableDeclarationList(child.initializer)
    ) {
      markMutationTarget(child.initializer);
    }
    if (
      ts.isBinaryExpression(child) &&
      child.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      child.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      markMutationTarget(child.left);
    }
    if (
      (ts.isPrefixUnaryExpression(child) || ts.isPostfixUnaryExpression(child)) &&
      (child.operator === ts.SyntaxKind.PlusPlusToken ||
        child.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      markMutationTarget(child.operand);
    }
    ts.forEachChild(child, markMutations);
  }

  markMutations(node);
  return bindings;
}

function collectNextFontFactories(sourceFile: TypeScript.SourceFile): Set<string> {
  const factories = new Set<string>();

  function visitImports(node: TypeScript.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text.startsWith("next/font/")) {
        const clause = node.importClause;
        if (clause?.name) factories.add(clause.name.text);
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) factories.add(element.name.text);
        }
      }
    }
    ts.forEachChild(node, visitImports);
  }
  visitImports(sourceFile);
  return factories;
}

function isNextFontVariableReceiver(
  receiverName: string,
  bindings: Bindings,
  nextFontFactories: Set<string>,
): boolean {
  if (!bindings.has(receiverName)) return false;
  const receiverBinding = bindings.get(receiverName);
  if (!receiverBinding || !ts.isCallExpression(receiverBinding.initializer)) return false;
  if (!ts.isIdentifier(receiverBinding.initializer.expression)) return false;
  const factoryName = receiverBinding.initializer.expression.text;
  return nextFontFactories.has(factoryName) && !receiverBinding.scope.has(factoryName);
}


function evaluateExpression(
  expression: TypeScript.Expression,
  bindings: Bindings,
  nextFontFactories: Set<string>,
  resolving: Set<string> = new Set(),
): Evaluation {
  const current = unwrapExpression(expression);

  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
    return knownString(current.text);
  }

  if (ts.isIdentifier(current)) {
    if (!bindings.has(current.text)) return unknownExpression();
    const binding = bindings.get(current.text);
    if (!binding || resolving.has(current.text)) return unknownExpression();
    const nextResolving = new Set(resolving);
    nextResolving.add(current.text);
    return evaluateExpression(
      binding.initializer,
      binding.scope,
      nextFontFactories,
      nextResolving,
    );
  }

  if (ts.isArrayLiteralExpression(current)) {
    return combine(
      current.elements.map((element) =>
        ts.isSpreadElement(element)
          ? unknownExpression()
          : evaluateExpression(element, bindings, nextFontFactories, resolving),
      ),
    );
  }

  if (ts.isConditionalExpression(current)) {
    return combine([
      evaluateExpression(current.whenTrue, bindings, nextFontFactories, resolving),
      evaluateExpression(current.whenFalse, bindings, nextFontFactories, resolving),
    ]);
  }

  if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return concatenate([
      evaluateExpression(current.left, bindings, nextFontFactories, resolving),
      evaluateExpression(current.right, bindings, nextFontFactories, resolving),
    ]);
  }

  if (ts.isCallExpression(current)) {
    const callee = ts.isIdentifier(current.expression) ? current.expression.text : "";
    if (!COMPOSITION_CALLS.has(callee) || bindings.has(callee)) return unknownExpression();
    return combine(
      current.arguments.map((argument) =>
        evaluateExpression(argument, bindings, nextFontFactories, resolving),
      ),
    );
  }

  if (
    ts.isPropertyAccessExpression(current) &&
    ts.isIdentifier(current.expression) &&
    current.name.text === "variable" &&
    isNextFontVariableReceiver(
      current.expression.text,
      bindings,
      nextFontFactories,
    )
  ) {
    // Only a receiver proven to come from next/font may use *.variable here.
    return knownString("");
  }

  if (ts.isTemplateExpression(current)) {
    return concatenate([
      knownString(current.head.text),
      ...current.templateSpans.flatMap((span) => [
        evaluateExpression(span.expression, bindings, nextFontFactories, resolving),
        knownString(span.literal.text),
      ]),
    ]);
  }

  return unknownExpression();
}

function isDecorativeElement(elementName: string): boolean {
  const normalized = elementName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return (
    normalized.endsWith("icon") ||
    ["svg", "path", "img", "circle", "line", "polygon", "polyline"].includes(normalized)
  );
}

function extractClassNameExpressions(sourceFile: SourceFile): ClassNameExpression[] {
  const parsed = ts.createSourceFile(
    sourceFile.path,
    sourceFile.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const nextFontFactories = collectNextFontFactories(parsed);
  const expressions: ClassNameExpression[] = [];

  function inspectElement(
    element: TypeScript.JsxOpeningLikeElement,
    bindings: Bindings,
  ): void {
    const elementName = jsxNameText(element.tagName);
    if (isDecorativeElement(elementName)) return;

    const className = element.attributes.properties.find(
      (property): property is TypeScript.JsxAttribute =>
        ts.isJsxAttribute(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === "className",
    );
    if (!className) return;

    const line = parsed.getLineAndCharacterOfPosition(className.getStart(parsed)).line + 1;
    if (!className.initializer) {
      expressions.push({ elementName, line, ...unknownExpression() });
      return;
    }
    if (ts.isStringLiteral(className.initializer)) {
      expressions.push({ elementName, line, ...knownString(className.initializer.text) });
      return;
    }
    if (!ts.isJsxExpression(className.initializer)) {
      expressions.push({ elementName, line, ...unknownExpression() });
      return;
    }
    if (!className.initializer.expression) {
      expressions.push({ elementName, line, ...unknownExpression() });
      return;
    }

    expressions.push({
      elementName,
      line,
      ...evaluateExpression(className.initializer.expression, bindings, nextFontFactories),
    });
  }

  function visit(node: TypeScript.Node, inheritedBindings: Bindings): void {
    const directBindings = collectDirectBindings(node);
    let bindings = inheritedBindings;
    if (directBindings.size) {
      bindings = new Map(inheritedBindings);
      for (const [name, initializer] of directBindings) {
        bindings.set(
          name,
          initializer ? { initializer, scope: bindings } : null,
        );
      }
    }

    if (ts.isJsxElement(node)) inspectElement(node.openingElement, bindings);
    if (ts.isJsxSelfClosingElement(node)) inspectElement(node, bindings);
    ts.forEachChild(node, (child) => visit(child, bindings));
  }

  visit(parsed, new Map());
  return expressions;
}

function normalizeColorToken(token: string): string {
  let squareDepth = 0;
  let parenthesisDepth = 0;
  let lastTopLevelColon = -1;

  for (let index = 0; index < token.length; index += 1) {
    const character = token[index];
    if (character === "[") squareDepth += 1;
    else if (character === "]") squareDepth = Math.max(0, squareDepth - 1);
    else if (character === "(") parenthesisDepth += 1;
    else if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    else if (character === ":" && squareDepth === 0 && parenthesisDepth === 0) {
      lastTopLevelColon = index;
    }
  }

  const utility = lastTopLevelColon >= 0 ? token.slice(lastTopLevelColon + 1) : token;
  return utility.replace(/^!/, "").replace(/!$/, "");
}

function isExplicitFullOpacity(normalized: string): boolean {
  return /^(?:opacity-(?:100|\[100%?\]|\[1\])|(?:text-(?:black|white)|text-base-content)\/(?:100|\[100%?\]|\[1\])|\/(?:100|\[100%?\]|\[1\]))$/.test(
    normalized,
  );
}

function colorFinding(token: string): string | null {
  const normalized = normalizeColorToken(token);
  if (isExplicitFullOpacity(normalized)) return null;
  if (
    LOW_CONTRAST_TOKEN.test(normalized) ||
    (/^opacity-/.test(normalized) && normalized !== "opacity-100")
  ) {
    return `class ${token} (low-contrast color or opacity utility)`;
  }
  return null;
}

function splitClassTokens(fragment: string): string[] {
  return fragment.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function findColorViolations(sourceFile: SourceFile): string[] {
  const violations: string[] = [];
  for (const expression of extractClassNameExpressions(sourceFile)) {
    for (const fragment of expression.fragments) {
      for (const token of splitClassTokens(fragment)) {
        const finding = colorFinding(token);
        if (finding) violations.push(`${sourceFile.path}:${expression.line}: ${finding}`);
      }
    }
    if (expression.cannotInspect) {
      violations.push(
        `${sourceFile.path}:${expression.line}: className expression cannot be statically inspected for color`,
      );
    }
  }
  return violations;
}

function listSourceFiles(): string[] {
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
      if (!entry.name.endsWith(".tsx")) continue;
      if (entry.name.endsWith(".test.tsx") || entry.name.endsWith(".spec.tsx")) continue;
      const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
      if (EXCLUDED_PATH_PARTS.some((part) => relativePath.includes(part))) continue;
      if (EXCLUDED_FILES.has(relativePath)) continue;
      files.push(relativePath);
    }
  }

  visit(path.resolve(process.cwd(), "src/app"));
  visit(path.resolve(process.cwd(), "src/components"));
  return files.sort((left, right) => left.localeCompare(right));
}

function loadSourceFiles(): SourceFile[] {
  return listSourceFiles().map((filePath) => ({
    path: filePath,
    content: readFileSync(path.resolve(process.cwd(), filePath), "utf8"),
  }));
}

describe("UI color and opacity compliance", () => {
  it("detects low-contrast tokens and opacity only on text-bearing elements", () => {
    const fixture: SourceFile = {
      path: "fixture.tsx",
      content: [
        'declare const condition: boolean;',
        'declare const dynamicClasses: string;',
        "const Fixture = () => (",
        "  <>",
        '    <p className="text-base-content">safe</p>',
        '    <p className="text-gray-600 dark:text-gray-400">muted</p>',
        '    <p className="text-black/60">opaque</p>',
        '    <p className="opacity-70">faded</p>',
        '    <p className="text-base /60">malformed</p>',
        '    <p className={condition ? "text-base-content" : "text-gray-500"}>conditional</p>',
        '    <svg className="text-gray-400" />',
        '    <StatusIcon className="text-gray-400" />',
        '    <p className={dynamicClasses}>dynamic</p>',
        "  </>",
        ");",
      ].join("\n"),
    };

    expect(findColorViolations(fixture)).toEqual([
      "fixture.tsx:6: class text-gray-600 (low-contrast color or opacity utility)",
      "fixture.tsx:6: class dark:text-gray-400 (low-contrast color or opacity utility)",
      "fixture.tsx:7: class text-black/60 (low-contrast color or opacity utility)",
      "fixture.tsx:8: class opacity-70 (low-contrast color or opacity utility)",
      "fixture.tsx:9: class /60 (low-contrast color or opacity utility)",
      "fixture.tsx:10: class text-gray-500 (low-contrast color or opacity utility)",
      "fixture.tsx:13: className expression cannot be statically inspected for color",
    ]);
  });

  it("does not report comments, text, non-class attributes, content arbitrary values, non-canonical colors, or icons", () => {
    const fixture: SourceFile = {
      path: "false-positive-fixture.tsx",
      content: [
        '// className="text-black/60"',
        'const text = "text-gray-600";',
        "const Fixture = () => (",
        "  <>",
        '    {/* className="text-black/60" */}',
        '    <p data-class="text-black/60" title="text-gray-600">text-gray-600</p>',
        '    <p class="text-black/60">text-black/60</p>',
        '    <p className="before:content-[\'text-gray-600\'] text-base-content" />',
        '    <p className="text-(color:--color) text-[red] text-[theme(colors.red.500)] text-[length:16px] text-base-content" />',
        '    <svg className="text-gray-600" />',
        '    <StatusIcon className="text-gray-600" />',
        "  </>",
        ");",
      ].join("\n"),
    };

    expect(findColorViolations(fixture)).toEqual([]);
  });

  it("fails closed for lexical shadowing, unknown receivers, and utility boundaries", () => {
    const fixture: SourceFile = {
      path: "scope-fixture.tsx",
      content: [
        'declare const condition: boolean;',
        'import { Geist } from "next/font/google";',
        'const provenFont = Geist({ variable: "--font" });',
        'const safe = "text-base-content";',
        'declare const factory: { variable: string };',
        "const Fixture = ({ safe }: { safe: string }) => {",
        '  const local = "text-gray-500";',
        '  const { destructured } = { destructured: "text-base-content" };',
        "  let uninitialized: string;",
        '  const Geist = () => ({ variable: "--shadowed" });',
        "  const localFont = Geist({});",
        "  const suffix = \"500\";",
        "  const staticTemplate = `text-gray-${suffix}`;",
        '  let mutableClasses = "text-base-content";',
        '  mutableClasses = "text-black/60";',
        '  function cn() { return "text-black/60"; }',
        "  return (",
        "    <div>",
        '      <p className={safe}>shadowed</p>',
        '      <p className={local}>local</p>',
        '      <p className={destructured}>destructured</p>',
        '      <p className={uninitialized}>uninitialized</p>',
        '      <p className={factory.variable}>variable</p>',
        '      <p className={localFont.variable}>font shadow</p>',
        '      <p className={staticTemplate}>template</p>',
        '      <p className={mutableClasses}>mutable</p>',
        '      <p className={cn("text-base-content")}>composition shadow</p>',
        '      <p className="text-[length:16px]">font size</p>',
        '      <p className="opacity-0 opacity-5 opacity-[0.5] opacity-100">opacity</p>',
        '      <p className="[&>*]:!text-gray-500 md:!text-gray-500 text-gray-500! text-gray-500/100 data-[state=open]:text-gray-500 group-data-[state=open]:text-gray-500 min-[500px]:opacity-70">grammar</p>',
        "    </div>",
        "  );",
        "};",
        'const ProvenFont = () => <p className={provenFont.variable}>font safe</p>;',
        'const shadowedClasses = "text-base-content";',
        "function FunctionShadow() {",
        "  function shadowedClasses() { return null; }",
        '  return <p className={shadowedClasses}>function</p>;',
        "}",
        "function ClassShadow() {",
        "  class shadowedClasses {}",
        '  return <p className={shadowedClasses}>class</p>;',
        "}",
      ].join("\n"),
    };

    expect(findColorViolations(fixture)).toEqual([
      "scope-fixture.tsx:19: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:20: class text-gray-500 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:21: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:22: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:23: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:24: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:25: class text-gray-500 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:26: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:27: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:29: class opacity-0 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:29: class opacity-5 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:29: class opacity-[0.5] (low-contrast color or opacity utility)",
      "scope-fixture.tsx:30: class [&>*]:!text-gray-500 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:30: class md:!text-gray-500 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:30: class text-gray-500! (low-contrast color or opacity utility)",
      "scope-fixture.tsx:30: class text-gray-500/100 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:30: class data-[state=open]:text-gray-500 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:30: class group-data-[state=open]:text-gray-500 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:30: class min-[500px]:opacity-70 (low-contrast color or opacity utility)",
      "scope-fixture.tsx:38: className expression cannot be statically inspected for color",
      "scope-fixture.tsx:42: className expression cannot be statically inspected for color",
    ]);
  });


  it("fails closed for loop and switch shadowing and destructuring assignments", () => {
    const fixture: SourceFile = {
      path: "binding-scope-fixture.tsx",
      content: [
        "declare const condition: boolean;",
        'const outer = "text-base-content";',
        "const LoopFixture = () => {",
        '  for (const outer of ["text-gray-500"]) {',
        '    return <p className={outer}>loop</p>;',
        "  }",
        "  switch (condition) {",
        "    case true:",
        '      const outer = "text-gray-500";',
        '      return <p className={outer}>switch</p>;',
        "    default:",
        "      return null;",
        "  }",
        "};",
        "const MutationFixture = ({ props, values }: { props: object; values: string[] }) => {",
        '  let objectClasses = "text-base-content";',
        '  let arrayClasses = "text-base-content";',
        "  ({ objectClasses } = props);",
        "  [arrayClasses] = values;",
        "  return (",
        "    <>",
        '      <p className={objectClasses}>object</p>',
        '      <p className={arrayClasses}>array</p>',
        "    </>",
        "  );",
        "};",
      ].join("\n"),
    };

    expect(findColorViolations(fixture)).toEqual([
      "binding-scope-fixture.tsx:5: className expression cannot be statically inspected for color",
      "binding-scope-fixture.tsx:10: class text-gray-500 (low-contrast color or opacity utility)",
      "binding-scope-fixture.tsx:22: className expression cannot be statically inspected for color",
      "binding-scope-fixture.tsx:23: className expression cannot be statically inspected for color",
    ]);
  });

  it("fails closed for loop reassignment, aliased/rest destructuring, and named class expressions", () => {
    const fixture: SourceFile = {
      path: "mutation-fixture.tsx",
      content: [
        'const loopClasses = "text-base-content";',
        "const LoopMutation = ({ values }: { values: string[] }) => {",
        "  for (loopClasses of values) {",
        '    return <p className={loopClasses}>loop of</p>;',
        "  }",
        "  for (loopClasses in values) {",
        '    return <p className={loopClasses}>loop in</p>;',
        "  }",
        "  return null;",
        "};",
        "const AliasMutation = ({ props }: { props: object }) => {",
        '  let aliasClasses = "text-base-content";',
        "  ({ source: aliasClasses } = props);",
        '  return <p className={aliasClasses}>alias</p>;',
        "};",
        "const RestMutation = ({ props }: { props: object }) => {",
        '  let restClasses = "text-base-content";',
        "  ({ ...restClasses } = props);",
        '  return <p className={restClasses}>rest</p>;',
        "};",
        "const ArrayRestMutation = ({ values }: { values: string[] }) => {",
        '  let arrayRestClasses = "text-base-content";',
        "  [...arrayRestClasses] = values;",
        '  return <p className={arrayRestClasses}>array rest</p>;',
        "};",
        "const NamedClassExpression = class classes {",
        "  render() {",
        '    return <p className={classes}>class expression</p>;',
        "  }",
        "};",
      ].join("\n"),
    };

    expect(findColorViolations(fixture)).toEqual([
      "mutation-fixture.tsx:4: className expression cannot be statically inspected for color",
      "mutation-fixture.tsx:7: className expression cannot be statically inspected for color",
      "mutation-fixture.tsx:14: className expression cannot be statically inspected for color",
      "mutation-fixture.tsx:19: className expression cannot be statically inspected for color",
      "mutation-fixture.tsx:24: className expression cannot be statically inspected for color",
      "mutation-fixture.tsx:28: className expression cannot be statically inspected for color",
    ]);
  });

  it("resolves binding initializers in their declaration scope", () => {
    const fixture: SourceFile = {
      path: "declaration-scope-fixture.tsx",
      content: [
        'const unsafe = "text-black/60";',
        "const alias = unsafe;",
        "function View() {",
        '  const unsafe = "text-base-content";',
        '  return <p className={alias}>alias</p>;',
        "}",
      ].join("\n"),
    };

    expect(findColorViolations(fixture)).toEqual([
      "declaration-scope-fixture.tsx:5: class text-black/60 (low-contrast color or opacity utility)",
    ]);
  });

  it("excludes the preserved Ko-fi source from the normal-text audit", () => {
    expect(listSourceFiles()).not.toContain("src/components/features/KoFiSupport.tsx");
  });

  it("reports the current production low-contrast and opacity violations", () => {
    const violations = loadSourceFiles().flatMap(findColorViolations);
    expect(violations).toEqual([]);
  });
});
