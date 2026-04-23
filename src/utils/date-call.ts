import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";
import { getNodeRange } from "./types.js";
import {
  hasFullTypeInformation,
  tryGetParserServices,
} from "./type-services.js";

/**
 * Conservative set of date-fns functions known to return `Date`. Kept
 * narrow on purpose: this list feeds AST-only Date detection where false
 * positives are worse than misses. Extend as concrete rule gaps surface.
 */
export const DATE_FNS_DATE_RETURNING: ReadonlySet<string> = new Set([
  "addDays",
  "addHours",
  "addMilliseconds",
  "addMinutes",
  "addMonths",
  "addQuarters",
  "addSeconds",
  "addWeeks",
  "addYears",
  "endOfDay",
  "endOfHour",
  "endOfISOWeek",
  "endOfMinute",
  "endOfMonth",
  "endOfQuarter",
  "endOfSecond",
  "endOfWeek",
  "endOfYear",
  "fromUnixTime",
  "lastDayOfMonth",
  "lastDayOfQuarter",
  "lastDayOfWeek",
  "lastDayOfYear",
  "parse",
  "parseISO",
  "parseJSON",
  "set",
  "setDate",
  "setDayOfYear",
  "setHours",
  "setISODay",
  "setISOWeek",
  "setISOWeekYear",
  "setMilliseconds",
  "setMinutes",
  "setMonth",
  "setQuarter",
  "setSeconds",
  "setWeek",
  "setWeekYear",
  "setYear",
  "startOfDay",
  "startOfHour",
  "startOfISOWeek",
  "startOfMinute",
  "startOfMonth",
  "startOfQuarter",
  "startOfSecond",
  "startOfWeek",
  "startOfYear",
  "subDays",
  "subHours",
  "subMilliseconds",
  "subMinutes",
  "subMonths",
  "subQuarters",
  "subSeconds",
  "subWeeks",
  "subYears",
  "toDate",
]);

/**
 * Collects the set of date-fns Date-returning identifiers actually
 * imported into this file. The local binding is what we match against at
 * the call site — an unrelated user-defined `parseISO` is not in this
 * set, which prevents AST-only Date detection from mis-firing on lookalikes.
 */
export function collectImportedDateReturners(
  program: TSESTree.Program,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const stmt of program.body) {
    if (stmt.type !== AST_NODE_TYPES.ImportDeclaration) continue;
    if (stmt.source.value !== "date-fns") continue;
    for (const spec of stmt.specifiers) {
      if (spec.type !== AST_NODE_TYPES.ImportSpecifier) continue;
      const importedName =
        spec.imported.type === AST_NODE_TYPES.Identifier
          ? spec.imported.name
          : spec.imported.value;
      if (DATE_FNS_DATE_RETURNING.has(importedName)) {
        out.add(spec.local.name);
      }
    }
  }
  return out;
}

/**
 * Recognizes expressions that clearly evaluate to a `Date` without
 * requiring the TypeScript type checker: `new Date(...)` and calls to a
 * date-fns Date-returning function that is actually imported in this file.
 */
export function isObviouslyDateExpression(
  node: TSESTree.Expression,
  importedDateReturners: ReadonlySet<string>,
): boolean {
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.NewExpression)(node)) {
    return isNewDateSyntax(node);
  }
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.CallExpression)(node)) {
    const { callee } = node;
    if (ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(callee)) {
      return importedDateReturners.has(callee.name);
    }
  }
  return false;
}

/**
 * Best-effort Date-type detection. Returns `true` when the TS checker
 * reports the expression's type as exactly "Date"; returns `false` both
 * when the type is something else and when type information is absent.
 * Callers must combine this with AST fallback for AST-only environments.
 *
 * The exact-string match is deliberately narrow: `Date | null`,
 * `Date | undefined`, aliases, and generic parameters are excluded.
 * That guarantees no false positives at the cost of some misses.
 * Contrast with `no-date-mutation`, which uses a permissive
 * `/\bDate\b/` substring match because its operators are safe to flag
 * on any receiver that claims to have a Date-setter method.
 */
export function isDateTyped(
  node: TSESTree.Node,
  services: ReturnType<typeof tryGetParserServices>,
): boolean {
  if (!hasFullTypeInformation(services)) return false;
  try {
    const type = services.getTypeAtLocation(node);
    const typeString = services.program.getTypeChecker().typeToString(type);
    return typeString === "Date";
  } catch {
    return false;
  }
}

/**
 * Detects Date constructor patterns including globalThis.Date and globalThis['Date'].
 */
export function isNewDateSyntax(node: TSESTree.NewExpression): boolean {
  const { callee } = node;
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(callee)) {
    return callee.name === "Date";
  }
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.MemberExpression)(callee)) {
    const object = callee.object;
    const property = callee.property;
    // Check for globalThis.Date (dot notation)
    if (
      ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(object) &&
      object.name === "globalThis" &&
      ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(property) &&
      property.name === "Date"
    ) {
      return true;
    }
    // Check for globalThis['Date'] (computed property with string literal)
    if (
      ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(object) &&
      object.name === "globalThis" &&
      ASTUtils.isNodeOfType(AST_NODE_TYPES.Literal)(property) &&
      property.value === "Date"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if Date identifier is shadowed by local declaration.
 */
export function isDateShadowed(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  node: TSESTree.NewExpression,
): boolean {
  const { callee } = node;
  // globalThis.Date cannot be shadowed
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.MemberExpression)(callee)) {
    return false;
  }
  if (
    !ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(callee) ||
    callee.name !== "Date"
  ) {
    return false;
  }

  const sourceCode = context.sourceCode;
  const scopeManager = sourceCode.scopeManager;
  if (scopeManager === null) return false;

  // Search through all scopes to find any that declare Date
  for (const scope of scopeManager.scopes) {
    const dateVariable = scope.variables.find(
      (variable) => variable.name === "Date",
    );
    if (dateVariable && dateVariable.defs.length > 0 && scope.block.range) {
      const [scopeStart, scopeEnd] = scope.block.range;
      const [nodeStart, nodeEnd] = getNodeRange(node);

      if (nodeStart >= scopeStart && nodeEnd <= scopeEnd) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detects bare Date() calls that reference the global Date function.
 */
export function isBareGlobalDateCall(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  node: TSESTree.CallExpression,
): boolean {
  const { callee } = node;

  // Must be a simple identifier call to "Date"
  if (
    !ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(callee) ||
    callee.name !== "Date"
  ) {
    return false;
  }

  const sourceCode = context.sourceCode;
  const scopeManager = sourceCode.scopeManager;
  if (scopeManager === null) return true;

  // Search through all scopes to find any that declare Date
  for (const scope of scopeManager.scopes) {
    const dateVariable = scope.variables.find(
      (variable) => variable.name === "Date",
    );
    if (dateVariable && dateVariable.defs.length > 0 && scope.block.range) {
      const [scopeStart, scopeEnd] = scope.block.range;
      const [nodeStart, nodeEnd] = getNodeRange(node);

      if (nodeStart >= scopeStart && nodeEnd <= scopeEnd) {
        return false;
      }
    }
  }

  return true;
}
