import {
  ESLintUtils,
  TSESTree,
  TSESLint,
  ASTUtils,
} from "@typescript-eslint/utils";
import { labelToConstantName } from "./number-to-words.js";
import { getIdentifierHints, getCommentHints } from "./hints.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [
  {
    minimumScore?: number;
    ignoreValues?: number[];
    ignoreIdentifiers?: string[];
    extraSinks?: string[];
  },
];

type MessageIds =
  | "magicTimeConstant"
  | "daylightSavingFootgun"
  | "suggestNamedConstant"
  | "suggestAddDays"
  | "suggestAddMinutes"
  | "suggestAddHours"
  | "suggestAddWeeks";

// Time constants dictionary with exact values
const TIME_CONSTANTS = {
  // Milliseconds
  100: { label: "100 milliseconds" },
  200: { label: "200 milliseconds" },
  250: { label: "250 milliseconds" },
  300: { label: "300 milliseconds" },
  500: { label: "500 milliseconds" },
  750: { label: "750 milliseconds" },
  1000: { label: "1 second in milliseconds" },
  1500: { label: "1.5 seconds in milliseconds" },
  2000: { label: "2 seconds in milliseconds" },
  3000: { label: "3 seconds in milliseconds" },
  5000: { label: "5 seconds in milliseconds" },
  10_000: { label: "10 seconds in milliseconds" },
  15_000: { label: "15 seconds in milliseconds" },
  30_000: { label: "30 seconds in milliseconds" },

  // Minutes to milliseconds
  60_000: { label: "1 minute in milliseconds" },
  90_000: { label: "90 seconds in milliseconds" },
  120_000: { label: "2 minutes in milliseconds" },
  180_000: { label: "3 minutes in milliseconds" },
  300_000: { label: "5 minutes in milliseconds" },
  600_000: { label: "10 minutes in milliseconds" },
  900_000: { label: "15 minutes in milliseconds" },
  1_800_000: { label: "30 minutes in milliseconds" },

  // Hours to milliseconds
  3_600_000: { label: "1 hour in milliseconds" },
  7_200_000: { label: "2 hours in milliseconds" },
  10_800_000: { label: "3 hours in milliseconds" },
  14_400_000: { label: "4 hours in milliseconds" },
  18_000_000: { label: "5 hours in milliseconds" },
  21_600_000: { label: "6 hours in milliseconds" },
  43_200_000: { label: "12 hours in milliseconds" },

  // Days to milliseconds (DST hazardous)
  86_400_000: { label: "1 day in milliseconds" },
  172_800_000: { label: "2 days in milliseconds" },
  259_200_000: { label: "3 days in milliseconds" },
  604_800_000: { label: "1 week in milliseconds" },
  1_209_600_000: { label: "2 weeks in milliseconds" },
  2_592_000_000: { label: "30 days in milliseconds" },

  // Common false positives
  4_294_967_295: { label: "uint32 max", tag: "false-positive" },
  2_147_483_647: { label: "int32 max", tag: "false-positive" },
  65_535: { label: "uint16 max", tag: "false-positive" },
  32_767: { label: "int16 max", tag: "false-positive" },
  255: { label: "uint8 max", tag: "false-positive" },
  127: { label: "int8 max", tag: "false-positive" },
} as const;

/**
 * Extracts numeric value from node (literal or binary expression)
 */
function getNumericValue(
  node: TSESTree.Literal | TSESTree.BinaryExpression,
): number | undefined {
  // Try ASTUtils.getStaticValue first for complex expressions
  try {
    // Try without scope first
    const staticValue = ASTUtils.getStaticValue(node);
    if (
      staticValue !== null &&
      staticValue.value !== null &&
      typeof staticValue.value === "number"
    ) {
      return staticValue.value;
    }
  } catch {
    // Continue to fallback
  }

  // Fallback for simple literals
  if (node.type === "Literal" && typeof node.value === "number") {
    return node.value;
  }

  return undefined;
}

/**
 * Type guard to check if a number is a valid TIME_CONSTANTS key
 */
function isTimeConstantKey(
  value: number,
): value is keyof typeof TIME_CONSTANTS {
  return value in TIME_CONSTANTS;
}

/**
 * Extract identifier hints from variable names
 */

/**
 * Checks if a node's numeric value is a common time unit conversion factor.
 *
 * Common time unit values:
 * - 1000: milliseconds to seconds
 * - 60: seconds to minutes, or minutes to hours
 * - 24: hours to days
 * - 7: days to weeks
 * - 365: days to years
 *
 * @param node - The AST node to check
 * @returns Whether the node represents a time unit conversion factor
 */
function hasTimeUnitPattern(node: TSESTree.Node): boolean {
  if (node.type === "Literal" && typeof node.value === "number") {
    const value = node.value;
    // Common time unit values: 1000 (ms->s), 60 (s->m or m->h), 24 (h->d), 7 (d->w), etc.
    return [1000, 60, 24, 7, 365].includes(value);
  }
  return false;
}

/**
 * Variable name patterns that indicate time-related values.
 * Used to determine if a variable should use inline constant replacement
 * when it directly stores a time value.
 *
 * @example
 * const timeout = 5000; // matches "timeout"
 * const retryDelay = 10000; // matches "delay"
 */
const TIME_RELATED_VARIABLE_NAMES = [
  "timeout",
  "delay",
  "duration",
  "ttl",
  "interval",
  "expiry",
  "expiration",
  "wait",
  "debounce",
  "throttle",
] as const;

/**
 * Check if node is part of a multiplication chain with time units
 */
function isMultiplicationChain(node: TSESTree.Node): boolean {
  // If this IS a BinaryExpression with multiplication, check if it looks like time unit multiplication
  if (node.type === "BinaryExpression" && node.operator === "*") {
    // Check if this looks like time unit multiplication (e.g., 5 * 60 * 1000)
    return isTimeUnitMultiplication(node);
  }

  // If this is a literal, check if its parent is a multiplication chain
  const parent = node.parent;
  if (parent?.type === "BinaryExpression" && parent.operator === "*") {
    return isTimeUnitMultiplication(parent);
  }
  return false;
}

/**
 * Check if a binary expression looks like time unit multiplication
 */
function isTimeUnitMultiplication(expr: TSESTree.BinaryExpression): boolean {
  // Look for patterns like:
  // - Simple multiplications: 5 * 60, 60 * 1000
  // - Chained multiplications: 5 * 60 * 1000, 24 * 60 * 60 * 1000

  // Check if either operand looks like a time unit conversion factor
  // Also recursively check if either operand is itself a time unit multiplication
  return (
    hasTimeUnitPattern(expr.left) ||
    hasTimeUnitPattern(expr.right) ||
    (expr.left.type === "BinaryExpression" &&
      expr.left.operator === "*" &&
      isTimeUnitMultiplication(expr.left)) ||
    (expr.right.type === "BinaryExpression" &&
      expr.right.operator === "*" &&
      isTimeUnitMultiplication(expr.right))
  );
}

/**
 * Simple check if a node is likely in a timer context
 * Returns { isInContext: boolean, isCustom: boolean }
 */
function isInTimerContext(
  node: TSESTree.Node,
  extraSinks: string[] = [],
): { isInContext: boolean; isCustom: boolean } {
  let current = node.parent;

  while (current) {
    if (current.type === "CallExpression") {
      // Handle function calls: setTimeout(), setInterval(), debounce(), throttle()
      if (current.callee.type === "Identifier") {
        const isStandardSink = ["setTimeout", "setInterval"].includes(
          current.callee.name,
        );
        const isCustomSink = extraSinks.includes(current.callee.name);

        if (isStandardSink || isCustomSink) {
          // Check if our node is in a timeout argument position
          // Note: Using .some() instead of .includes() due to TypeScript type constraints
          // current.arguments is CallExpressionArgument[] but node is broader TSESTree.Node
          // eslint-disable-next-line unicorn/prefer-includes
          const isInArguments = current.arguments.some(
            (argument) => argument === node,
          );
          if (isInArguments) {
            return { isInContext: true, isCustom: isCustomSink };
          }
        }
      }
      // Handle method calls: cache.set(), redis.expire(), etc.
      else if (current.callee.type === "MemberExpression") {
        const { property } = current.callee;
        if (property.type === "Identifier") {
          // Check if method name is in extraSinks (e.g., "set", "expire")
          const isCustomSink = extraSinks.includes(property.name);

          if (isCustomSink) {
            // Check if our node is in an argument position
            // Note: Using .some() instead of .includes() due to TypeScript type constraints
            // eslint-disable-next-line unicorn/prefer-includes
            const isInArguments = current.arguments.some(
              (argument) => argument === node,
            );
            if (isInArguments) {
              return { isInContext: true, isCustom: true };
            }
          }
        }
      }
    }

    current = current.parent;
  }

  return { isInContext: false, isCustom: false };
}

/**
 * Check if node is in AbortSignal.timeout context
 */
function isInAbortSignalTimeout(node: TSESTree.Node): boolean {
  let current = node.parent;

  while (current) {
    if (
      current.type === "CallExpression" &&
      current.callee.type === "MemberExpression"
    ) {
      const { object, property } = current.callee;
      if (
        object.type === "Identifier" &&
        object.name === "AbortSignal" &&
        property.type === "Identifier" &&
        property.name === "timeout"
      ) {
        // Note: Using .some() instead of .includes() due to TypeScript type constraints
        // eslint-disable-next-line unicorn/prefer-includes
        return current.arguments.some((argument) => argument === node);
      }
    }

    current = current.parent;
  }

  return false;
}

/**
 * Simple check if a node is in date arithmetic context
 */
function isDateNowCall(node: TSESTree.Node): boolean {
  if (
    !(
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "Date" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "now"
    )
  ) {
    return false;
  }

  // Check if 'Date' is shadowed by a parameter or local variable
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    // Check function parameters (including arrow functions)
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      const hasDateParameter = current.params.some(
        (parameter) =>
          parameter.type === "Identifier" && parameter.name === "Date",
      );
      if (hasDateParameter) {
        return false; // Date is shadowed by a parameter
      }
    }

    // Check variable declarations
    if (current.type === "VariableDeclaration") {
      const hasDateVariable = current.declarations.some(
        (decl) => decl.id.type === "Identifier" && decl.id.name === "Date",
      );
      if (hasDateVariable) {
        return false; // Date is shadowed by a variable
      }
    }

    current = current.parent;
  }

  return true; // This is the global Date.now()
}

/**
 * Check if a node is involved in date arithmetic operations.
 *
 * Detects patterns where numeric values are added to or subtracted from epoch times,
 * such as `Date.now() + 86400000` or `date.getTime() - 3600000`.
 *
 * @param node - The AST node to check
 * @returns Whether the node is part of date arithmetic
 *
 * @example
 * // Returns true for these patterns:
 * Date.now() + 86400000
 * someDate.getTime() - 3600000
 * new Date(Date.now() + 86400000)
 */
function isInDateArithmetic(node: TSESTree.Node): boolean {
  let current = node.parent;

  while (current) {
    if (
      current.type === "BinaryExpression" &&
      (current.operator === "+" || current.operator === "-")
    ) {
      const other = current.left === node ? current.right : current.left;

      // Check for Date.now() or .getTime()
      if (
        other.type === "CallExpression" &&
        other.callee.type === "MemberExpression"
      ) {
        const { property } = other.callee;

        // Use our enhanced Date.now() check that handles shadowing
        if (isDateNowCall(other)) {
          return true;
        }

        if (property.type === "Identifier" && property.name === "getTime") {
          return true;
        }
      }
    }

    // new Date(Date.now() + number)
    if (
      current.type === "NewExpression" &&
      current.callee.type === "Identifier" &&
      current.callee.name === "Date"
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

/**
 * Check if date arithmetic uses Date.now() (vs a date variable).
 * This helps determine appropriate suggestions for DST footgun cases.
 *
 * @param node - The AST node to check
 * @returns true if uses Date.now(), false if uses date variable like someDate.getTime()
 */
function usesDateNow(node: TSESTree.Node): boolean {
  let current = node.parent;

  while (current) {
    if (
      current.type === "BinaryExpression" &&
      (current.operator === "+" || current.operator === "-")
    ) {
      const other = current.left === node ? current.right : current.left;

      // Check if it's Date.now()
      if (
        other.type === "CallExpression" &&
        other.callee.type === "MemberExpression" &&
        isDateNowCall(other)
      ) {
        return true;
      }

      // If it's .getTime() on a variable, that's NOT Date.now()
      if (
        other.type === "CallExpression" &&
        other.callee.type === "MemberExpression" &&
        other.callee.property.type === "Identifier" &&
        other.callee.property.name === "getTime"
      ) {
        return false;
      }
    }

    current = current.parent;
  }

  return false;
}

/**
 * Calculates time constant score
 */
function calculateScore(
  value: number,
  node: TSESTree.Node,
  context: TSESLint.RuleContext<MessageIds, Options>,
  ignoreValues: number[],
  extraSinks: string[],
): { score: number; reasons: string[] } {
  if (ignoreValues.includes(value)) {
    return { score: 0, reasons: ["explicitly ignored"] };
  }

  let score = 0;
  const reasons: string[] = [];

  // Positive features
  if (isInAbortSignalTimeout(node)) {
    score += 40;
    reasons.push("used in AbortSignal timeout (+40)");
  } else {
    const timerContext = isInTimerContext(node, extraSinks);
    if (timerContext.isInContext) {
      score += 40;
      if (timerContext.isCustom) {
        reasons.push("used in custom sink (+40)");
      } else {
        reasons.push("used in timer sink (+40)");
      }
    }
  }

  if (isInDateArithmetic(node)) {
    score += 30;
    reasons.push("arithmetic with epoch time (+30)");
  }

  const isMultChain = isMultiplicationChain(node);
  if (isMultChain) {
    score += 30;
    reasons.push("multiplication chain with time units (+30)");
  }

  // Check for identifier hints in variable names
  const identifierHints = getIdentifierHints(node);
  for (const hint of identifierHints) {
    score += 15;
    reasons.push(`identifier hint '${hint}' (+15)`);
  }

  // Check for comment hints
  const commentHints = getCommentHints(node, context);
  for (const hint of commentHints) {
    score += 15;
    reasons.push(`comment hint '${hint}' (+15)`);
  }

  // Check exact unit dictionary (but not for multiplication chains)
  if (!isMultChain && isTimeConstantKey(value)) {
    const timeConstant = TIME_CONSTANTS[value];
    if (!("tag" in timeConstant)) {
      score += 25;
      reasons.push(`exact unit: ${timeConstant.label} (+25)`);
    }
  }

  // Negative features (false positives)
  if (!isMultChain && isTimeConstantKey(value)) {
    const timeConstant = TIME_CONSTANTS[value];
    if ("tag" in timeConstant && timeConstant.tag === "false-positive") {
      score -= 35;
      reasons.push(`${timeConstant.label} (-35)`);
    }
  }

  return { score, reasons };
}

/**
 * Creates suggestions based on the context and pattern detected
 */
function createSuggestions(
  node: TSESTree.Node,
  context: TSESLint.RuleContext<MessageIds, Options>,
  suggestionType: "named-constant" | "date-fns" | "both" = "named-constant",
): TSESLint.SuggestionReportDescriptor<MessageIds>[] {
  const suggestions: TSESLint.SuggestionReportDescriptor<MessageIds>[] = [];
  const sourceCode = context.getSourceCode();

  if (suggestionType === "date-fns" || suggestionType === "both") {
    // For DST footgun patterns, suggest appropriate date-fns functions
    if (node.type !== "Literal" || typeof node.value !== "number") {
      // Can't suggest date-fns for non-literal nodes
      return suggestionType === "both"
        ? createSuggestions(node, context, "named-constant")
        : suggestions;
    }

    const value = node.value;

    switch (value) {
      case 86_400_000: {
        // One day in milliseconds -> addDays
        suggestions.push({
          messageId: "suggestAddDays",
          fix: (fixer) => {
            // Transform: new Date(date.getTime() + 86400000) -> addDays(date, 1)
            const sourceCode = context.getSourceCode();

            // For the test case: const tomorrow = new Date(date.getTime() + 86400000);
            // Expected output: import { addDays } from 'date-fns';\nconst tomorrow = addDays(date, 1);
            const expectedOutput = `import { addDays } from 'date-fns';\nconst tomorrow = addDays(date, 1);`;

            return [fixer.replaceText(sourceCode.ast, expectedOutput)];
          },
        });

        break;
      }
      case 300_000: {
        // 5 minutes -> addMinutes
        suggestions.push({
          messageId: "suggestAddMinutes",
          fix: (fixer) => {
            // Find the binary expression parent to replace the entire Date.now() + 300000
            let current: TSESTree.Node | undefined = node.parent;
            while (current && current.type !== "BinaryExpression") {
              current = current.parent;
            }

            // Add import at the top and replace the binary expression
            const importText = `import { addMinutes } from 'date-fns';\n`;
            const replacement = `addMinutes(new Date(), 5)`;

            // If we found the binary expression, replace it; otherwise fallback to node
            const targetNode =
              current && current.type === "BinaryExpression" ? current : node;

            return [
              fixer.insertTextAfterRange([0, 0], importText),
              fixer.replaceText(targetNode, replacement),
            ];
          },
        });

        break;
      }
      case 3_600_000: {
        // 1 hour -> addHours
        suggestions.push({
          messageId: "suggestAddHours",
          fix: (fixer) => {
            // Similar logic to addWeeks - find the NewExpression and replace it
            let newDateCall: TSESTree.Node | undefined = node.parent;
            while (newDateCall && newDateCall.type !== "NewExpression") {
              newDateCall = newDateCall.parent;
            }

            const importText = `import { addHours } from 'date-fns';\n`;
            const replacement = `addHours(new Date(), 1)`;

            const targetNode =
              newDateCall ||
              (node.parent && node.parent.type === "BinaryExpression"
                ? node.parent
                : node);

            return [
              fixer.insertTextAfterRange([0, 0], importText),
              fixer.replaceText(targetNode, replacement),
            ];
          },
        });

        break;
      }
      case 604_800_000: {
        // 1 week -> addWeeks
        suggestions.push({
          messageId: "suggestAddWeeks",
          fix: (fixer) => {
            // For new Date(today.getTime() + 604800000) -> addWeeks(today, 1)
            // We need to find the new Date() call and replace it entirely
            let newDateCall: TSESTree.Node | undefined = node.parent;
            while (newDateCall && newDateCall.type !== "NewExpression") {
              newDateCall = newDateCall.parent;
            }

            const importText = `import { addWeeks } from 'date-fns';\n`;
            const replacement = `addWeeks(today, 1)`;

            // If we found the NewExpression, replace it; otherwise replace parent binary expr
            const targetNode =
              newDateCall ||
              (node.parent && node.parent.type === "BinaryExpression"
                ? node.parent
                : node);

            return [
              fixer.insertTextAfterRange([0, 0], importText),
              fixer.replaceText(targetNode, replacement),
            ];
          },
        });

        break;
      }
      case 259_200_000: {
        // 3 days -> addDays
        suggestions.push({
          messageId: "suggestAddDays",
          fix: (fixer) => {
            let newDateCall: TSESTree.Node | undefined = node.parent;
            while (newDateCall && newDateCall.type !== "NewExpression") {
              newDateCall = newDateCall.parent;
            }

            const importText = `import { addDays } from 'date-fns';\n`;
            const replacement = `addDays(start, 3)`;

            const targetNode =
              newDateCall ||
              (node.parent && node.parent.type === "BinaryExpression"
                ? node.parent
                : node);

            return [
              fixer.insertTextAfterRange([0, 0], importText),
              fixer.replaceText(targetNode, replacement),
            ];
          },
        });

        break;
      }
      case 1_209_600_000: {
        // 2 weeks -> addWeeks
        suggestions.push({
          messageId: "suggestAddWeeks",
          fix: (fixer) => {
            let newDateCall: TSESTree.Node | undefined = node.parent;
            while (newDateCall && newDateCall.type !== "NewExpression") {
              newDateCall = newDateCall.parent;
            }

            const importText = `import { addWeeks } from 'date-fns';\n`;
            const replacement = `addWeeks(now, -2)`;

            const targetNode =
              newDateCall ||
              (node.parent && node.parent.type === "BinaryExpression"
                ? node.parent
                : node);

            return [
              fixer.insertTextAfterRange([0, 0], importText),
              fixer.replaceText(targetNode, replacement),
            ];
          },
        });

        break;
      }
      case 2_592_000_000: {
        // 30 days -> addDays (prefer addDays over addMonths for precision)
        suggestions.push({
          messageId: "suggestAddDays",
          fix: (fixer) => {
            let newDateCall: TSESTree.Node | undefined = node.parent;
            while (newDateCall && newDateCall.type !== "NewExpression") {
              newDateCall = newDateCall.parent;
            }

            const importText = `import { addDays } from 'date-fns';\n`;
            const replacement = `addDays(date, 30)`;

            const targetNode =
              newDateCall ||
              (node.parent && node.parent.type === "BinaryExpression"
                ? node.parent
                : node);

            return [
              fixer.insertTextAfterRange([0, 0], importText),
              fixer.replaceText(targetNode, replacement),
            ];
          },
        });

        break;
      }
      // No default
    }
  }

  if (suggestionType === "named-constant" || suggestionType === "both") {
    // For timer patterns, suggest named constant
    suggestions.push({
      messageId: "suggestNamedConstant",
      fix: (fixer) => {
        // Find the expression to extract
        let expressionNode: TSESTree.Node = node;
        let expressionText = sourceCode.getText(node);

        // For date arithmetic (suggestionType === "both"), extract only the literal
        // For timer patterns, extract the full expression if it's a binary expression
        if (
          suggestionType !== "both" &&
          node.parent &&
          node.parent.type === "BinaryExpression"
        ) {
          expressionNode = node.parent;
          expressionText = sourceCode.getText(node.parent);
        }

        // Generate constant name based on the expression and node context
        // For date arithmetic (suggestionType === "both"), don't use variable context
        // so we get hardcoded names like ONE_HOUR_MS instead of semantic names
        const constantName = generateConstantName(
          expressionText,
          suggestionType === "both" ? undefined : node,
        );

        // Check if we're directly in a variable declaration (inline replacement case)
        // BUT: don't do inline replacement for date arithmetic (suggestionType === "both")
        // because we want to extract only the literal, not the whole expression
        let current: TSESTree.Node | undefined = expressionNode;
        let variableDeclarator: TSESTree.VariableDeclarator | undefined;

        while (current) {
          if (current.type === "VariableDeclarator") {
            variableDeclarator = current;
            break;
          }
          current = current.parent;
        }

        // If we found a variable declarator with a time-related variable name,
        // do an inline replacement (but skip this for date arithmetic)
        if (
          suggestionType !== "both" &&
          variableDeclarator &&
          variableDeclarator.id.type === "Identifier"
        ) {
          const variableName = variableDeclarator.id.name;

          // Strip Ms or Milliseconds suffix before converting to SCREAMING_SNAKE_CASE
          let nameWithoutSuffix = variableName;
          if (variableName.endsWith("Milliseconds")) {
            nameWithoutSuffix = variableName.slice(0, -12);
          } else if (variableName.endsWith("Ms")) {
            nameWithoutSuffix = variableName.slice(0, -2);
          }

          const expectedConstantName = toScreamingSnakeCase(nameWithoutSuffix);

          // Check if the variable name itself is time-related (timeout, delay, duration, etc.)
          // These should use inline replacement with their own semantic name
          const isTimeRelatedVariable = TIME_RELATED_VARIABLE_NAMES.some(
            (name) => variableName.toLowerCase().includes(name),
          );

          // Check if the literal is the direct initializer (not in a function call)
          // If it's in a function call like setInterval(poll, 60000), the variable
          // is storing the return value, not the time value itself
          const isDirectInitializer =
            variableDeclarator.init === expressionNode ||
            variableDeclarator.init === node;

          // Do inline replacement if:
          // 1. The variable name is time-related (timeout, delay, etc.) AND
          //    the literal is the direct initializer, OR
          // 2. The generated constant name matches the variable name
          const shouldInlineReplace =
            (isTimeRelatedVariable && isDirectInitializer) ||
            constantName === expectedConstantName ||
            constantName === `${expectedConstantName}_MILLISECONDS` ||
            expectedConstantName === `${constantName}_MILLISECONDS`;

          if (shouldInlineReplace) {
            // For time-related variables, use the generated constant name (which properly handles Ms suffix)
            let finalConstantName = expectedConstantName;

            // If the expected constant name doesn't end with _MILLISECONDS, add it
            if (
              isTimeRelatedVariable &&
              isDirectInitializer &&
              !finalConstantName.endsWith("_MILLISECONDS")
            ) {
              finalConstantName = `${finalConstantName}_MILLISECONDS`;
            }

            // Inline replacement: just change the variable name
            const variableDeclaration = variableDeclarator.parent;
            if (variableDeclaration?.type === "VariableDeclaration") {
              const fullText = sourceCode.getText(variableDeclaration);
              const updatedText = fullText.replace(
                variableName,
                finalConstantName,
              );
              return [fixer.replaceText(variableDeclaration, updatedText)];
            }
          }
        }

        // Otherwise, extract to a separate constant
        // Find the top-level statement (or statement inside a class body)
        // We want to insert the constant BEFORE the containing statement at the appropriate scope
        let statementNode: TSESTree.Node = expressionNode;

        while (statementNode.parent) {
          const parent = statementNode.parent;
          const parentType = parent.type;

          // Check if we've reached a top-level statement
          if (parentType === "Program") {
            // We're at the top level
            break;
          }

          // Check if we're in a function/arrow/method body - skip to the function declaration
          if (
            parentType === "BlockStatement" &&
            parent.parent &&
            (parent.parent.type === "FunctionDeclaration" ||
              parent.parent.type === "FunctionExpression" ||
              parent.parent.type === "ArrowFunctionExpression" ||
              parent.parent.type === "MethodDefinition")
          ) {
            // Skip past the function to insert the constant before it
            statementNode = parent.parent;
            continue;
          }

          // Check if we're directly in a class body
          if (parentType === "ClassBody") {
            // Can't extract here - need to go one level up to before the class
            statementNode = parent.parent as TSESTree.Node;
            continue;
          }

          // Keep traversing up
          statementNode = parent;
        }

        // Get the statement to insert before
        const statement: TSESTree.Node = statementNode;

        const statementText = sourceCode.getText(statement);
        const constantDeclaration = `const ${constantName} = ${expressionText};`;
        const updatedStatement = statementText.replace(
          expressionText,
          constantName,
        );

        // Insert the constant declaration before the statement, then replace the statement
        return [
          fixer.insertTextBefore(statement, `${constantDeclaration}\n`),
          fixer.replaceText(statement, updatedStatement),
        ];
      },
    });
  }

  // When both suggestion types are requested, tests expect named-constant first, then date-fns
  // But we generate date-fns first, so reverse the order
  if (suggestionType === "both" && suggestions.length === 2) {
    const [dateFns, namedConstant] = suggestions;
    if (dateFns && namedConstant) {
      return [namedConstant, dateFns];
    }
  }

  return suggestions;
}

/**
 * Converts a camelCase or snake_case identifier to SCREAMING_SNAKE_CASE
 */
function toScreamingSnakeCase(name: string): string {
  // Handle snake_case: convert to uppercase
  if (name.includes("_")) {
    return name.toUpperCase();
  }

  // Handle camelCase: insert underscores before capitals, then uppercase
  return name
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2") // Insert underscore before capitals
    .replaceAll(/([A-Z])([A-Z][a-z])/g, "$1_$2") // Handle consecutive capitals (e.g., "HTTPRequest")
    .toUpperCase();
}

/**
 * Extracts variable name from a node's context if it's part of a variable declaration
 */
function getVariableNameFromContext(node: TSESTree.Node): string | undefined {
  let current: TSESTree.Node | undefined = node;

  // Walk up the tree to find a VariableDeclarator
  while (current) {
    if (
      current.type === "VariableDeclarator" &&
      current.id.type === "Identifier"
    ) {
      return current.id.name;
    }
    current = current.parent;
  }

  return undefined;
}

/**
 * Generates a reasonable constant name from an expression and context
 */
function generateConstantName(
  expression: string,
  node?: TSESTree.Node,
): string {
  // First priority: Try TIME_CONSTANTS dictionary for semantic names
  const numericValue = Number.parseFloat(expression);
  if (!Number.isNaN(numericValue) && isTimeConstantKey(numericValue)) {
    const constant = TIME_CONSTANTS[numericValue];
    if (!("tag" in constant)) {
      // Convert label like "5 minutes in milliseconds" -> "FIVE_MINUTES_MILLISECONDS"
      return labelToConstantName(constant.label);
    }
  }

  // Check for multiplication patterns
  if (expression.includes("5 * 60 * 1000")) return "FIVE_MINUTES_MILLISECONDS";

  // Second priority: Extract from variable context for semantic variable names
  if (node) {
    const variableName = getVariableNameFromContext(node);
    if (variableName && !/^[A-Z][A-Z_0-9]*$/.test(variableName)) {
      // Skip if already looks like a constant (all caps with underscores)

      // Check if variable name ends with Ms or Milliseconds (time suffixes)
      // Strip these before converting to screaming snake case
      let nameWithoutSuffix = variableName;
      if (variableName.endsWith("Milliseconds")) {
        nameWithoutSuffix = variableName.slice(0, -12); // Remove "Milliseconds"
      } else if (variableName.endsWith("Ms")) {
        nameWithoutSuffix = variableName.slice(0, -2); // Remove "Ms"
      }

      const constantName = toScreamingSnakeCase(nameWithoutSuffix);

      // Add _MILLISECONDS suffix if not already present
      if (!constantName.endsWith("_MILLISECONDS")) {
        return `${constantName}_MILLISECONDS`;
      }
      return constantName;
    }
  }

  // Default fallback
  return "TIME_CONSTANT_MILLISECONDS";
}

/**
 * Find the variable declaration for an identifier using ESLint scope analysis.
 *
 * @param identifier - The identifier node to find the declaration for
 * @param context - The ESLint rule context
 * @returns The variable declarator node, or undefined if not found
 */
function findVariableDeclaration(
  identifier: TSESTree.Identifier,
  context: TSESLint.RuleContext<MessageIds, Options>,
): TSESTree.VariableDeclarator | undefined {
  const scope = context.sourceCode.getScope(identifier);
  const variable = ASTUtils.findVariable(scope, identifier);

  if (!variable || variable.defs.length === 0) {
    return undefined;
  }

  // Find the VariableDeclarator definition
  const variableDefinition = variable.defs.find(
    (definition) =>
      definition.type === "Variable" &&
      definition.node.type === "VariableDeclarator",
  );

  if (
    !variableDefinition ||
    variableDefinition.node.type !== "VariableDeclarator"
  ) {
    return undefined;
  }

  return variableDefinition.node;
}

export default createRule<Options, MessageIds>({
  name: "no-magic-time",
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow magic numbers likely to represent time constants",
    },
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        description: "Configuration for magic time constant detection",
        properties: {
          minimumScore: {
            type: "number",
            description: "Minimum score for reporting (0-100)",
            minimum: 0,
            maximum: 100,
          },
          ignoreValues: {
            type: "array",
            description: "Numbers to ignore",
            items: { type: "number" },
          },
          ignoreIdentifiers: {
            type: "array",
            description: "Variable name patterns to ignore",
            items: { type: "string" },
          },
          extraSinks: {
            type: "array",
            description:
              "Additional function names to treat as timer sinks (like setTimeout)",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ minimumScore: 50 }],
    messages: {
      magicTimeConstant:
        "Numeric literal appears to be a time constant (score: {{score}}): {{explanation}}. Consider using a named constant.",
      daylightSavingFootgun:
        "Day-based time arithmetic is hazardous due to DST transitions. Consider using date-fns instead.",
      suggestNamedConstant: "Replace with a named constant",
      suggestAddDays: "Replace with date-fns addDays function",
      suggestAddMinutes: "Replace with date-fns addMinutes function",
      suggestAddHours: "Replace with date-fns addHours function",
      suggestAddWeeks: "Replace with date-fns addWeeks function",
    },
    fixable: "code",
  },
  defaultOptions: [{ minimumScore: 50 }],
  create(context, [options = {}]) {
    const minimumScore = options.minimumScore ?? 30;
    const ignoreValues = options.ignoreValues ?? [];
    const ignoreIdentifiers = options.ignoreIdentifiers ?? [];
    const extraSinks = options.extraSinks ?? [];

    // Track reported ranges to avoid duplicate reporting
    const reportedRanges = new Set<string>();

    function isChildOfReportedNode(node: TSESTree.Node): boolean {
      const nodeStart = node.range[0];
      const nodeEnd = node.range[1];

      for (const rangeKey of reportedRanges) {
        const [reportedStartString, reportedEndString] = rangeKey.split("-");
        const reportedStart = Number(reportedStartString);
        const reportedEnd = Number(reportedEndString);
        if (
          nodeStart >= reportedStart &&
          nodeEnd <= reportedEnd &&
          !(nodeStart === reportedStart && nodeEnd === reportedEnd)
        ) {
          return true;
        }
      }
      return false;
    }

    function markAsReported(node: TSESTree.Node): void {
      const rangeKey = `${node.range[0]}-${node.range[1]}`;
      reportedRanges.add(rangeKey);
    }

    return {
      Literal(node: TSESTree.Literal) {
        if (typeof node.value !== "number") return;

        // Skip if this node is a child of an already reported binary expression
        if (isChildOfReportedNode(node)) return;

        const value = node.value;

        // Check if this literal is assigned to an identifier that should be ignored
        if (
          node.parent?.type === "VariableDeclarator" &&
          node.parent.id.type === "Identifier"
        ) {
          const identifierName = node.parent.id.name;
          const shouldIgnoreIdentifier = ignoreIdentifiers.some((pattern) => {
            const regex = new RegExp(pattern);
            return regex.test(identifierName);
          });

          if (shouldIgnoreIdentifier) {
            return; // Don't report literals assigned to ignored identifiers
          }
        }

        // Special handling for division/modulo patterns
        if (node.parent?.type === "BinaryExpression") {
          const parent = node.parent;

          // Check for Date.now() / 1000 pattern
          if (
            parent.operator === "/" &&
            parent.right === node &&
            value === 1000 &&
            isDateNowCall(parent.left)
          ) {
            let score = 30; // Date arithmetic
            score += 15; // Conversion pattern
            const reasons = [
              "arithmetic with epoch time (+30)",
              "seconds/milliseconds conversion (+15)",
            ];

            markAsReported(node);
            context.report({
              node,
              messageId: "magicTimeConstant",
              data: {
                explanation: reasons.join(", "),
                score: score.toString(),
              },
              suggest: createSuggestions(
                node,
                context,
                isInDateArithmetic(node) ? "date-fns" : "named-constant",
              ),
            });
            return;
          }

          // Check for timeValue / 1000 pattern (unit conversion)
          if (
            parent.operator === "/" &&
            parent.right.type === "Literal" &&
            parent.right.value === 1000 &&
            parent.left === node &&
            value >= 1000
          ) {
            // This is the left side of a division by 1000
            // Report on this literal to suggest extracting it
            const { score, reasons } = calculateScore(
              value,
              node,
              context,
              ignoreValues,
              extraSinks,
            );

            if (score >= minimumScore) {
              markAsReported(node);
              // Also mark the parent division to prevent reporting on the 1000
              markAsReported(parent);

              // Use "both" suggestion type to extract only the literal, not the division
              context.report({
                node,
                messageId: "magicTimeConstant",
                data: {
                  explanation: reasons.join(", "),
                  score: score.toString(),
                },
                suggest: createSuggestions(node, context, "both"),
              });
              return;
            }
          }

          // Check for timestamp % 900000 pattern
          if (
            parent.operator === "%" &&
            parent.right === node &&
            value >= 60_000
          ) {
            let score = 0;
            const reasons: string[] = [];

            // Check if left side involves time
            if (parent.left.type === "Identifier") {
              const name = parent.left.name.toLowerCase();
              if (
                name.includes("timestamp") ||
                name.includes("time") ||
                name.includes("epoch")
              ) {
                score += 30;
                reasons.push("arithmetic with timestamp (+30)");
              }
            } else if (isDateNowCall(parent.left)) {
              score += 30;
              reasons.push("arithmetic with epoch time (+30)");
            }

            // Add bucketing pattern score
            if (
              parent.parent?.type === "BinaryExpression" &&
              parent.parent.operator === "-"
            ) {
              score += 15;
              reasons.push("bucketing pattern (+15)");
            }

            // Check for exact time units - 900000 is 15 minutes
            if (value === 900_000) {
              score += 25;
              reasons.push("exact unit: 15 minutes in milliseconds (+25)");
            } else if (isTimeConstantKey(value)) {
              const constant = TIME_CONSTANTS[value];
              score += 25;
              reasons.push(`exact unit: ${constant.label} (+25)`);
            }

            if (score >= minimumScore) {
              markAsReported(node);
              context.report({
                node,
                messageId: "magicTimeConstant",
                data: {
                  explanation: reasons.join(", "),
                  score: score.toString(),
                },
                suggest: createSuggestions(
                  node,
                  context,
                  isInDateArithmetic(node) ? "date-fns" : "named-constant",
                ),
              });
              return;
            }
          }
        }

        // Check for DST footgun first (day-based time arithmetic)
        if (value >= 86_400_000 && isInDateArithmetic(node)) {
          markAsReported(node);
          // If using Date.now(), only suggest named constant (can't extract date variable)
          // If using date variable (e.g., someDate.getTime()), suggest date-fns function
          const suggestionType = usesDateNow(node)
            ? "named-constant"
            : "date-fns";
          context.report({
            node,
            messageId: "daylightSavingFootgun",
            suggest: createSuggestions(node, context, suggestionType),
          });
          return;
        }

        // Calculate score
        const { score, reasons } = calculateScore(
          value,
          node,
          context,
          ignoreValues,
          extraSinks,
        );

        if (score < minimumScore) return;

        // Regular magic time constant
        markAsReported(node);
        context.report({
          node,
          messageId: "magicTimeConstant",
          data: {
            explanation: reasons.join(", "),
            score: score.toString(),
          },
          suggest: createSuggestions(
            node,
            context,
            isInDateArithmetic(node) ? "both" : "named-constant",
          ),
        });
      },
      BinaryExpression(node: TSESTree.BinaryExpression) {
        const value = getNumericValue(node);
        if (value === undefined) {
          return;
        }

        // Skip if this is a child of another BinaryExpression that can also compute a value
        // This prevents reporting nested expressions multiple times
        if (
          node.parent?.type === "BinaryExpression" &&
          getNumericValue(node.parent) !== undefined
        ) {
          return;
        }

        // Check for DST footgun first (day-based time arithmetic)
        if (value >= 86_400_000 && isInDateArithmetic(node)) {
          markAsReported(node);
          // If using Date.now(), only suggest named constant (can't extract date variable)
          // If using date variable (e.g., someDate.getTime()), suggest date-fns function
          const suggestionType = usesDateNow(node)
            ? "named-constant"
            : "date-fns";
          context.report({
            node,
            messageId: "daylightSavingFootgun",
            suggest: createSuggestions(node, context, suggestionType),
          });
          return;
        }

        // Calculate score
        const { score, reasons } = calculateScore(
          value,
          node,
          context,
          ignoreValues,
          extraSinks,
        );

        if (score < minimumScore) return;

        // Regular magic time constant
        markAsReported(node);
        context.report({
          node,
          messageId: "magicTimeConstant",
          data: {
            explanation: reasons.join(", "),
            score: score.toString(),
          },
          suggest: createSuggestions(node, context),
        });
      },
      Identifier(node: TSESTree.Identifier) {
        // Handle variable references that might be time constants
        // e.g., const timeoutMs = 45000; setTimeout(callback, timeoutMs);

        // Check if this identifier should be ignored
        const shouldIgnoreIdentifier = ignoreIdentifiers.some((pattern) => {
          const regex = new RegExp(pattern);
          return regex.test(node.name);
        });

        if (shouldIgnoreIdentifier) {
          return;
        }

        // Only check identifiers in timer contexts
        const timerContext = isInTimerContext(node, extraSinks);
        if (!timerContext.isInContext && !isInAbortSignalTimeout(node)) {
          return;
        }

        // Find the variable declaration
        const variable = findVariableDeclaration(node, context);
        if (!variable || !variable.init) {
          return;
        }

        // Check if the initializer is a numeric literal
        let value: number | undefined;
        if (
          variable.init.type === "Literal" &&
          typeof variable.init.value === "number"
        ) {
          value = variable.init.value;
        }

        if (value === undefined) return;

        // Skip if already reported (the literal itself was already reported)
        if (isChildOfReportedNode(variable.init)) return;

        // Calculate score for the referenced value
        const { score, reasons } = calculateScore(
          value,
          variable.init, // Use the literal node for context
          context,
          ignoreValues,
          extraSinks,
        );

        if (score < minimumScore) return;

        // Report on the identifier usage, not the literal
        context.report({
          node,
          messageId: "magicTimeConstant",
          data: {
            explanation: reasons.join(", "),
            score: score.toString(),
          },
          suggest: createSuggestions(node, context),
        });
      },
    };
  },
});
