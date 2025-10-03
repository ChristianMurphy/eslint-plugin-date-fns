import {
  ASTUtils,
  ESLintUtils,
  type TSESTree,
  type TSESLint,
} from "@typescript-eslint/utils";
import type { TypeChecker } from "typescript";
import {
  ensureDateFnsNamedImports,
  ensureDateFnsTzNamedImports,
} from "../../utils/imports.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds =
  | "mutatingDate"
  | "mutatingDateMismatch"
  | "mutatingDateUnsafe"
  | "suggestUTCIntent"
  | "suggestLocalIntent";

const LOCAL_SETTERS = new Set([
  "setFullYear",
  "setMonth",
  "setDate",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setMilliseconds",
  "setYear",
]);

const UTC_SETTERS = new Set([
  "setUTCFullYear",
  "setUTCMonth",
  "setUTCDate",
  "setUTCHours",
  "setUTCMinutes",
  "setUTCSeconds",
  "setUTCMilliseconds",
]);

const ALL_SETTERS = new Set([...LOCAL_SETTERS, ...UTC_SETTERS, "setTime"]);

const SETTER_TO_FIELD: Record<string, string> = {
  setFullYear: "year",
  setUTCFullYear: "year",
  setMonth: "month",
  setUTCMonth: "month",
  setDate: "date",
  setUTCDate: "date",
  setHours: "hours",
  setUTCHours: "hours",
  setMinutes: "minutes",
  setUTCMinutes: "minutes",
  setSeconds: "seconds",
  setUTCSeconds: "seconds",
  setMilliseconds: "milliseconds",
  setUTCMilliseconds: "milliseconds",
};

const GETTER_TO_UNIT: Record<string, string> = {
  getFullYear: "years",
  getUTCFullYear: "years",
  getMonth: "months",
  getUTCMonth: "months",
  getDate: "days",
  getUTCDate: "days",
  getHours: "hours",
  getUTCHours: "hours",
  getMinutes: "minutes",
  getUTCMinutes: "minutes",
  getSeconds: "seconds",
  getUTCSeconds: "seconds",
  getMilliseconds: "milliseconds",
  getUTCMilliseconds: "milliseconds",
};

const UNIT_CONVERSIONS: Array<{ from: string; to: string; factor: number }> = [
  { from: "months", to: "years", factor: 12 },
  { from: "quarters", to: "years", factor: 4 },
  { from: "months", to: "quarters", factor: 3 },
  { from: "days", to: "weeks", factor: 7 },
  { from: "hours", to: "days", factor: 24 },
  { from: "minutes", to: "days", factor: 1440 },
  { from: "seconds", to: "days", factor: 86_400 },
  { from: "milliseconds", to: "days", factor: 86_400_000 },
  { from: "minutes", to: "hours", factor: 60 },
  { from: "seconds", to: "hours", factor: 3600 },
  { from: "milliseconds", to: "hours", factor: 3_600_000 },
  { from: "seconds", to: "minutes", factor: 60 },
  { from: "milliseconds", to: "minutes", factor: 60_000 },
  { from: "milliseconds", to: "seconds", factor: 1000 },
];

/**
 * Normalizes delta to largest fitting unit using conversion table.
 */
function normalizeUnit(
  delta: number,
  unit: string,
): { delta: number; unit: string } {
  for (const conversion of UNIT_CONVERSIONS) {
    if (conversion.from === unit && delta % conversion.factor === 0) {
      return { delta: delta / conversion.factor, unit: conversion.to };
    }
  }
  return { delta, unit };
}

/**
 * Detects arithmetic pattern like obj.setX(obj.getX() ± N).
 */
function detectArithmetic(
  call: TSESTree.CallExpression,
  setterName: string,
):
  | { delta: number; unit: string; isUTC: boolean; mismatch?: boolean }
  | undefined {
  if (call.arguments.length !== 1) return undefined;

  const argument = call.arguments[0];
  if (!argument) return undefined;
  if (argument.type !== "BinaryExpression") return undefined;
  if (argument.operator !== "+" && argument.operator !== "-") return undefined;

  const left = argument.left;
  if (left.type !== "CallExpression") return undefined;
  if (left.callee.type !== "MemberExpression") return undefined;
  if (left.callee.property.type !== "Identifier") return undefined;

  const getterName = left.callee.property.name;
  const unit = GETTER_TO_UNIT[getterName];
  if (!unit) return undefined;

  const isSetterUTC = UTC_SETTERS.has(setterName);
  const expectedGetter = setterName.replace("set", "get");
  const isGetterUTC = getterName.startsWith("getUTC");

  const hasMismatch = isSetterUTC !== isGetterUTC;
  if (!hasMismatch && getterName !== expectedGetter) return undefined;

  if (hasMismatch) {
    const setterUnit = setterName
      .replace("set", "")
      .replace("UTC", "")
      .toLowerCase();
    const getterUnit = getterName
      .replace("get", "")
      .replace("UTC", "")
      .toLowerCase();
    if (setterUnit !== getterUnit) return undefined;
  }

  const setterReceiver = call.callee;
  if (setterReceiver.type !== "MemberExpression") return undefined;
  const setterObject = setterReceiver.object;
  const getterObject = left.callee.object;

  if (
    setterObject.type === "Identifier" &&
    getterObject.type === "Identifier"
  ) {
    if (setterObject.name !== getterObject.name) return undefined;
  } else {
    return undefined;
  }

  const right = argument.right;
  if (right.type !== "Literal" || typeof right.value !== "number")
    return undefined;

  let delta = right.value;
  if (argument.operator === "-") delta = -delta;

  return { delta, unit, isUTC: isSetterUTC, mismatch: hasMismatch };
}

/**
 * Checks if property name is a Date setter method.
 */
function isSetterName(name: string): boolean {
  return ALL_SETTERS.has(name);
}

/**
 * Checks for midnight zeroing pattern: setHours(0, 0, 0, 0) or setUTCHours(0, 0, 0, 0).
 */
function isMidnightZeroing(call: TSESTree.CallExpression): boolean {
  const callee = call.callee;
  if (
    callee.type !== "MemberExpression" ||
    callee.property.type !== "Identifier"
  ) {
    return false;
  }

  const setterName = callee.property.name;
  if (setterName !== "setHours" && setterName !== "setUTCHours") {
    return false;
  }

  if (call.arguments.length !== 4) {
    return false;
  }

  return call.arguments.every(
    (argument) => argument.type === "Literal" && argument.value === 0,
  );
}

/**
 * Checks if expression is a pure Math.* call with no side effects.
 */
function isPureMathCall(node: TSESTree.Expression): boolean {
  if (node.type !== "CallExpression") return false;
  if (node.callee.type !== "MemberExpression") return false;
  if (node.callee.object.type !== "Identifier") return false;
  if (node.callee.object.name !== "Math") return false;
  return true;
}

/**
 * Finds the parent statement node for a given AST node.
 */
function findParentStatement(
  node: TSESTree.Node,
): TSESTree.Statement | undefined {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    const currentType = current.type;
    if (
      currentType === "ExpressionStatement" ||
      currentType === "VariableDeclaration" ||
      currentType === "ReturnStatement" ||
      currentType === "IfStatement" ||
      currentType === "ForStatement" ||
      currentType === "WhileStatement"
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

/**
 * Checks if two call expression nodes are consecutive statements in the same block.
 */
function areConsecutiveStatements(
  node1: TSESTree.CallExpression,
  node2: TSESTree.CallExpression,
): boolean {
  const stmt1 = findParentStatement(node1);
  const stmt2 = findParentStatement(node2);
  if (!stmt1 || !stmt2) return false;

  const parent1 = stmt1.parent;
  const parent2 = stmt2.parent;
  if (parent1 !== parent2) return false;
  if (parent1.type !== "Program" && parent1.type !== "BlockStatement")
    return false;

  const body = parent1.body;
  const index1 = body.indexOf(stmt1 as TSESTree.Statement);
  const index2 = body.indexOf(stmt2 as TSESTree.Statement);

  return index2 === index1 + 1;
}

interface MutationInfo {
  node: TSESTree.CallExpression;
  receiver: TSESTree.Expression;
  receiverText: string;
  setterName: string;
  isUTC: boolean;
  fieldName?: string;
  argumentText?: string;
  hasSideEffect?: boolean;
  tempVarName?: string;
  type: "midnight" | "timestamp" | "arithmetic" | "field" | "other";
  arithmeticInfo?: {
    delta: number;
    unit: string;
    functionName: string;
    tzOption: string;
  };
}

/**
 * Checks if expression has side effects, treating Math.* calls as pure.
 */
function hasSideEffects(
  node: TSESTree.Expression,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (isPureMathCall(node)) return false;

  if (
    node.type === "Literal" ||
    node.type === "TemplateLiteral" ||
    node.type === "UnaryExpression"
  ) {
    return false;
  }

  return ASTUtils.hasSideEffect(node, sourceCode);
}

/**
 * Checks if Date identifier is shadowed by local declaration in node's scope.
 */
function isDateShadowedAtNode(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
): boolean {
  const scopeManager = sourceCode.scopeManager;
  if (!scopeManager) return false;

  for (const scope of scopeManager.scopes) {
    const dateVariable = scope.variables.find(
      (variable) => variable.name === "Date",
    );
    if (dateVariable && dateVariable.defs.length > 0 && scope.block.range) {
      const [scopeStart, scopeEnd] = scope.block.range;
      const [nodeStart, nodeEnd] = node.range;

      if (nodeStart >= scopeStart && nodeEnd <= scopeEnd) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if expression is of Date type using TypeScript type information or heuristics.
 */
function isDateType(
  node: TSESTree.Expression,
  checker: TypeChecker | undefined,
  parserServices:
    | NonNullable<TSESLint.SourceCode["parserServices"]>
    | undefined,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (isDateShadowedAtNode(node, sourceCode)) {
    return false;
  }

  if (checker && parserServices?.esTreeNodeToTSNodeMap) {
    try {
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
      if (tsNode) {
        const type = checker.getTypeAtLocation(tsNode);
        const typeString = checker.typeToString(type);
        const isDate = typeString === "Date" || /\bDate\b/.test(typeString);
        return isDate;
      }
    } catch {
      // Fall through to heuristics
    }
  }

  if (node.type === "NewExpression") {
    const callee = node.callee;
    if (callee.type === "Identifier" && callee.name === "Date") {
      return !isDateShadowedAtNode(node, sourceCode);
    }
    return (
      callee.type === "MemberExpression" &&
      callee.object.type === "Identifier" &&
      callee.object.name === "globalThis" &&
      callee.property.type === "Identifier" &&
      callee.property.name === "Date"
    );
  }

  if (node.type === "Identifier") {
    return false;
  }

  return false;
}

/**
 * Checks if receiver has aliases that are read after the mutation point.
 */
function hasAliasReadAfterMutation(
  mutationNode: TSESTree.CallExpression,
  receiver: TSESTree.Expression,
  sourceCode: TSESLint.SourceCode,
): { hasAlias: boolean; aliasName?: string } {
  if (receiver.type !== "Identifier") {
    return { hasAlias: false };
  }

  const receiverName = receiver.name;
  const scopeManager = sourceCode.scopeManager;
  if (!scopeManager) return { hasAlias: false };

  const mutationPosition = mutationNode.range[0];

  for (const scope of scopeManager.scopes) {
    for (const variable of scope.variables) {
      if (variable.name === receiverName) continue;

      for (const definition of variable.defs) {
        if (
          definition.type === "Variable" &&
          definition.node.type === "VariableDeclarator"
        ) {
          const init = definition.node.init;
          if (
            init &&
            init.type === "Identifier" &&
            init.name === receiverName
          ) {
            for (const reference of variable.references) {
              if (
                reference.isRead() &&
                reference.identifier.range[0] > mutationPosition
              ) {
                return { hasAlias: true, aliasName: variable.name };
              }
            }
          }
        }
      }
    }
  }

  return { hasAlias: false };
}

export default createRule<Options, MessageIds>({
  name: "no-date-mutation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow in-place Date mutation. Prefer immutable date-fns alternatives.",
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [],
    messages: {
      mutatingDate:
        "Avoid mutating Date in place. Rewritten to immutable date-fns usage.",
      mutatingDateMismatch:
        "Date mutation has unclear intent ({{reason}}). Review suggestions to clarify.",
      mutatingDateUnsafe: "Cannot autofix Date mutation - {{reason}}.",
      suggestUTCIntent: "Use UTC arithmetic (primary suggestion)",
      suggestLocalIntent: "Use local arithmetic",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const parserServices = context.sourceCode.parserServices;
    const checker = parserServices?.program?.getTypeChecker?.();

    const mutations: MutationInfo[] = [];
    let dateFixCounter = 0;

    function generateTemporaryVariableName(): string {
      dateFixCounter++;
      return `__dateFix${dateFixCounter}`;
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== "MemberExpression") return;

        const { property } = node.callee;
        if (property.type !== "Identifier") return;
        if (!isSetterName(property.name)) return;

        if (node.callee.optional || node.optional) return;

        const receiver = node.callee.object;
        if (!isDateType(receiver, checker, parserServices, sourceCode)) return;

        const aliasCheck = hasAliasReadAfterMutation(
          node,
          receiver,
          sourceCode,
        );
        if (aliasCheck.hasAlias) {
          context.report({
            node,
            messageId: "mutatingDateUnsafe",
            data: {
              reason: `alias "${aliasCheck.aliasName}" is read after mutation - changing to immutable would alter behavior`,
            },
          });
          return;
        }

        const setterName = property.name;
        const isUTC = UTC_SETTERS.has(setterName);
        const receiverText = sourceCode.getText(receiver);

        if (isMidnightZeroing(node)) {
          mutations.push({
            node,
            receiver,
            receiverText,
            setterName,
            isUTC,
            type: "midnight",
          });
          return;
        }

        if (setterName === "setTime" && node.arguments.length === 1) {
          mutations.push({
            node,
            receiver,
            receiverText,
            setterName,
            isUTC,
            type: "timestamp",
            argumentText: sourceCode.getText(node.arguments[0]),
          });
          return;
        }

        const arithmetic = detectArithmetic(node, setterName);
        if (arithmetic) {
          if (arithmetic.mismatch) {
            const normalized = normalizeUnit(arithmetic.delta, arithmetic.unit);
            const isAddition = normalized.delta > 0;
            const absoluteDelta = Math.abs(normalized.delta);
            const capitalizedUnit =
              normalized.unit.charAt(0).toUpperCase() +
              normalized.unit.slice(1);
            const functionName = isAddition
              ? `add${capitalizedUnit}`
              : `sub${capitalizedUnit}`;

            context.report({
              node,
              messageId: "mutatingDateMismatch",
              data: {
                reason: "UTC setter with local getter - intent unclear",
              },
              suggest: [
                {
                  messageId: "suggestUTCIntent",
                  fix(fixer) {
                    const fixes: TSESLint.RuleFix[] = [];
                    const tzImportFix = ensureDateFnsTzNamedImports(
                      context,
                      fixer,
                      [functionName, "tz"],
                    );
                    if (tzImportFix) fixes.unshift(tzImportFix);
                    fixes.push(
                      fixer.replaceText(
                        node,
                        `${receiverText} = ${functionName}(${receiverText}, ${absoluteDelta}, { in: tz('UTC') })`,
                      ),
                    );
                    return fixes;
                  },
                },
                {
                  messageId: "suggestLocalIntent",
                  fix(fixer) {
                    const fixes: TSESLint.RuleFix[] = [];
                    const dateFnsImportFix = ensureDateFnsNamedImports(
                      context,
                      fixer,
                      [functionName],
                    );
                    if (dateFnsImportFix) fixes.unshift(dateFnsImportFix);
                    fixes.push(
                      fixer.replaceText(
                        node,
                        `${receiverText} = ${functionName}(${receiverText}, ${absoluteDelta})`,
                      ),
                    );
                    return fixes;
                  },
                },
              ],
            });
            return;
          }

          const normalized = normalizeUnit(arithmetic.delta, arithmetic.unit);
          const isAddition = normalized.delta > 0;
          const absoluteDelta = Math.abs(normalized.delta);
          const capitalizedUnit =
            normalized.unit.charAt(0).toUpperCase() + normalized.unit.slice(1);
          const functionName = isAddition
            ? `add${capitalizedUnit}`
            : `sub${capitalizedUnit}`;
          const tzOption = arithmetic.isUTC ? `, { in: tz('UTC') }` : "";

          // No ambiguity detected, collect for normal processing
          mutations.push({
            node,
            receiver,
            receiverText,
            setterName,
            isUTC: arithmetic.isUTC,
            type: "arithmetic",
            arithmeticInfo: {
              delta: absoluteDelta,
              unit: normalized.unit,
              functionName,
              tzOption,
            },
          });
          return;
        }
        const fieldName = SETTER_TO_FIELD[setterName];
        if (fieldName && node.arguments.length > 0) {
          const argument = node.arguments[0];
          if (!argument) return;
          if (argument.type === "SpreadElement") return;

          mutations.push({
            node,
            receiver,
            receiverText,
            setterName,
            isUTC,
            type: "field",
            fieldName,
            argumentText: sourceCode.getText(argument),
            hasSideEffect: hasSideEffects(argument, sourceCode),
          });
          return;
        }

        mutations.push({
          node,
          receiver,
          receiverText,
          setterName,
          isUTC,
          type: "other",
        });
      },

      "Program:exit"() {
        dateFixCounter = 0;
        for (const mutation of mutations) {
          if (mutation.type === "field" && mutation.hasSideEffect) {
            mutation.tempVarName = generateTemporaryVariableName();
          }
        }

        const processedIndices = new Set<number>();

        for (let index = 0; index < mutations.length; index++) {
          if (processedIndices.has(index)) continue;

          const mutation = mutations[index];
          if (!mutation) continue;

          if (mutation.type !== "field") {
            reportSingleMutation(mutation);
            processedIndices.add(index);
            continue;
          }

          const group: MutationInfo[] = [mutation];
          let nextIndex = index + 1;

          while (nextIndex < mutations.length) {
            const next = mutations[nextIndex];
            if (!next) {
              nextIndex++;
              continue;
            }

            if (processedIndices.has(nextIndex)) {
              nextIndex++;
              continue;
            }

            const lastInGroup = group.at(-1);
            if (
              lastInGroup &&
              next.type === "field" &&
              next.receiverText === mutation.receiverText &&
              next.isUTC === mutation.isUTC &&
              areConsecutiveStatements(lastInGroup.node, next.node)
            ) {
              group.push(next);
              processedIndices.add(nextIndex);
              nextIndex++;
            } else {
              break;
            }
          }

          if (group.length > 1) {
            reportMergedMutations(group);
          } else {
            reportSingleMutation(mutation);
          }
          processedIndices.add(index);
        }
      },
    };

    function reportSingleMutation(mutation: MutationInfo) {
      const { node, receiverText, isUTC, type } = mutation;

      if (type === "midnight") {
        const tzOption = isUTC ? `, { in: tz('UTC') }` : "";
        context.report({
          node,
          messageId: "mutatingDate",
          fix(fixer) {
            const fixes: TSESLint.RuleFix[] = [];
            const dateFnsImportFix = ensureDateFnsNamedImports(context, fixer, [
              "startOfDay",
            ]);
            if (dateFnsImportFix) fixes.unshift(dateFnsImportFix);
            if (isUTC) {
              const tzImportFix = ensureDateFnsTzNamedImports(context, fixer, [
                "tz",
              ]);
              if (tzImportFix) fixes.unshift(tzImportFix);
            }
            fixes.push(
              fixer.replaceText(
                node,
                `${receiverText} = startOfDay(${receiverText}${tzOption})`,
              ),
            );
            return fixes;
          },
        });
      } else if (type === "timestamp") {
        context.report({
          node,
          messageId: "mutatingDate",
          fix(fixer) {
            const fixes: TSESLint.RuleFix[] = [];
            const importFix = ensureDateFnsNamedImports(context, fixer, [
              "toDate",
            ]);
            if (importFix) fixes.unshift(importFix);
            fixes.push(
              fixer.replaceText(
                node,
                `${receiverText} = toDate(${mutation.argumentText})`,
              ),
            );
            return fixes;
          },
        });
      } else if (type === "arithmetic" && mutation.arithmeticInfo) {
        const { functionName, delta, tzOption } = mutation.arithmeticInfo;
        context.report({
          node,
          messageId: "mutatingDate",
          fix(fixer) {
            const fixes: TSESLint.RuleFix[] = [];
            if (isUTC) {
              const tzImportFix = ensureDateFnsTzNamedImports(context, fixer, [
                "tz",
              ]);
              if (tzImportFix) fixes.unshift(tzImportFix);
            }
            const dateFnsImportFix = ensureDateFnsNamedImports(context, fixer, [
              functionName,
            ]);
            if (dateFnsImportFix) fixes.unshift(dateFnsImportFix);
            fixes.push(
              fixer.replaceText(
                node,
                `${receiverText} = ${functionName}(${receiverText}, ${delta}${tzOption})`,
              ),
            );
            return fixes;
          },
        });
      } else if (type === "field") {
        const tzOption = isUTC ? `, { in: tz('UTC') }` : "";

        // Phase 4b: Use pre-assigned temp variable if argument has side effects
        const temporaryVariableName = mutation.tempVarName; // Pre-assigned in Program:exit
        const effectiveArgumentText =
          temporaryVariableName || mutation.argumentText;

        context.report({
          node,
          messageId: "mutatingDate",
          fix(fixer) {
            const fixes: TSESLint.RuleFix[] = [];
            const dateFnsImportFix = ensureDateFnsNamedImports(context, fixer, [
              "set",
            ]);
            if (dateFnsImportFix) fixes.unshift(dateFnsImportFix);
            if (isUTC) {
              const tzImportFix = ensureDateFnsTzNamedImports(context, fixer, [
                "tz",
              ]);
              if (tzImportFix) fixes.unshift(tzImportFix);
            }

            const setCall = `${receiverText} = set(${receiverText}, { ${mutation.fieldName}: ${effectiveArgumentText} }${tzOption})`;
            const replacementText = temporaryVariableName
              ? `const ${temporaryVariableName} = ${mutation.argumentText}; ${setCall}`
              : setCall;

            fixes.push(fixer.replaceText(node, replacementText));
            return fixes;
          },
        });
      } else {
        context.report({
          node,
          messageId: "mutatingDate",
        });
      }
    }

    function reportMergedMutations(group: MutationInfo[]) {
      // All should be field type with same receiver and UTC mode
      const first = group[0];
      if (!first) return;

      const receiverText = first.receiverText;
      const isUTC = first.isUTC;
      const tzOption = isUTC ? `, { in: tz('UTC') }` : "";

      // Phase 4b: Use pre-assigned temp variables for side effects
      const temporaryVariableMap = new Map<string, string>(); // maps argumentText to temp var name
      const mutationsWithTemps = group.map((m) => {
        if (m.tempVarName && m.argumentText) {
          // Use pre-assigned temp var name (assigned in Program:exit)
          temporaryVariableMap.set(m.argumentText, m.tempVarName);
          return {
            ...m,
            effectiveArgumentText: m.tempVarName,
          };
        }
        return {
          ...m,
          effectiveArgumentText: m.argumentText || "",
        };
      });

      const fields = mutationsWithTemps
        .map((m) => `${m.fieldName}: ${m.effectiveArgumentText}`)
        .join(", ");

      const temporaryVariableDeclarations = [...temporaryVariableMap.entries()]
        .map(
          ([argumentText, temporaryVariable]) =>
            `const ${temporaryVariable} = ${argumentText};`,
        )
        .join("\n");

      for (const [index, mutation] of group.entries()) {
        if (!mutation) continue;

        if (index === 0) {
          context.report({
            node: mutation.node,
            messageId: "mutatingDate",
            fix(fixer) {
              const fixes: TSESLint.RuleFix[] = [];

              if (isUTC) {
                const tzImportFix = ensureDateFnsTzNamedImports(
                  context,
                  fixer,
                  ["tz"],
                );
                if (tzImportFix) fixes.unshift(tzImportFix);
              }
              const dateFnsImportFix = ensureDateFnsNamedImports(
                context,
                fixer,
                ["set"],
              );
              if (dateFnsImportFix) fixes.unshift(dateFnsImportFix);

              let firstStmt: TSESTree.Node | undefined = mutation.node.parent;
              while (firstStmt && firstStmt.type !== "ExpressionStatement") {
                firstStmt = firstStmt.parent;
              }

              const setCall = `${receiverText} = set(${receiverText}, { ${fields} }${tzOption});`;
              const replacementText =
                temporaryVariableDeclarations.length > 0
                  ? `${temporaryVariableDeclarations}\n${setCall}`
                  : setCall;

              if (firstStmt && group.length > 1) {
                const [start, end] = firstStmt.range;
                const text = sourceCode.getText();
                const hasTrailingNewline =
                  end < text.length && text[end] === "\n";
                const rangeEnd = hasTrailingNewline ? end + 1 : end;
                fixes.push(
                  fixer.replaceTextRange([start, rangeEnd], replacementText),
                );
              } else {
                fixes.push(fixer.replaceText(mutation.node, replacementText));
              }

              for (
                let mutationIndex = 1;
                mutationIndex < group.length;
                mutationIndex++
              ) {
                const nextMutation = group[mutationIndex];
                if (!nextMutation) continue;

                let stmt: TSESTree.Node | undefined = nextMutation.node.parent;
                while (stmt && stmt.type !== "ExpressionStatement") {
                  stmt = stmt.parent;
                }
                if (stmt) {
                  const [start, end] = stmt.range;
                  const text = sourceCode.getText();
                  const hasTrailingNewline =
                    end < text.length && text[end] === "\n";
                  const rangeEnd = hasTrailingNewline ? end + 1 : end;
                  fixes.push(fixer.removeRange([start, rangeEnd]));
                }
              }

              return fixes;
            },
          });
        } else {
          context.report({
            node: mutation.node,
            messageId: "mutatingDate",
          });
        }
      }
    }
  },
});
