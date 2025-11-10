import { ESLintUtils, type TSESTree } from "@typescript-eslint/utils";
import { createImportAndReplaceFix } from "../../utils/fixers.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type EndOfDayHeuristic = "strict" | "lenient" | "aggressive";

export interface RuleOptions {
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  detectHacks?: boolean;
  suggestOnlyForAmbiguity?: boolean;
  endOfDayHeuristic?: EndOfDayHeuristic;
}

type Options = [RuleOptions?];

type MessageIds =
  | "useStartOfDay"
  | "useEndOfDay"
  | "useStartOfWeek"
  | "useEndOfWeek"
  | "useStartOfMonth"
  | "useEndOfMonth"
  | "useStartOfQuarter"
  | "useEndOfQuarter"
  | "useStartOfYear"
  | "useEndOfYear"
  | "useStartOfHour"
  | "useStartOfMinute"
  | "useStartOfSecond"
  | "useAddDays"
  | "possibleBoundary"
  | "nearEndOfDay"
  | "mixedUtcLocal"
  | "complexBoundaryExpression"
  | "dstWarning"
  | "suggestStartOfDay"
  | "suggestEndOfDay"
  | "suggestStartOfWeek"
  | "suggestEndOfMonth"
  | "suggestLocalBoundary"
  | "suggestKeepAsIs"
  | "suggestStartOrEnd";

const DATE_SETTERS = new Set([
  "setFullYear",
  "setMonth",
  "setDate",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setMilliseconds",
]);

// Time constants in milliseconds
const MS_PER_DAY = 86_400_000;


export default createRule<Options, MessageIds>({
  name: "no-plain-boundary-math",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow manual date boundary calculations in favor of date-fns boundary helpers",
    },
    fixable: "code",
    hasSuggestions: true,
    messages: {
      useStartOfDay:
        "Use startOfDay() instead of manually setting to start of day",
      useEndOfDay: "Use endOfDay() instead of manually setting to end of day",
      useStartOfWeek:
        "Use startOfWeek() instead of manual week start calculation",
      useEndOfWeek: "Use endOfWeek() instead of manual week end calculation",
      useStartOfMonth:
        "Use startOfMonth() instead of manually setting to start of month",
      useEndOfMonth: "Use endOfMonth() instead of day 0 trick for end of month",
      useStartOfQuarter:
        "Use startOfQuarter() instead of manual quarter start calculation",
      useEndOfQuarter:
        "Use endOfQuarter() instead of manual quarter end calculation",
      useStartOfYear:
        "Use startOfYear() instead of manually setting to start of year",
      useEndOfYear:
        "Use endOfYear() instead of manually setting to end of year",
      useStartOfHour:
        "Use startOfHour() instead of manually zeroing minutes/seconds",
      useStartOfMinute:
        "Use startOfMinute() instead of manually zeroing seconds",
      useStartOfSecond:
        "Use startOfSecond() instead of manually zeroing milliseconds",
      useAddDays: "Use addDays() instead of millisecond arithmetic",
      possibleBoundary:
        "This may be a boundary calculation. Consider using date-fns helpers",
      nearEndOfDay:
        "This appears to be near end-of-day. Consider using endOfDay()",
      mixedUtcLocal:
        "Mixed UTC and local setters detected. Consider consistent timezone handling",
      complexBoundaryExpression:
        "Complex boundary expression detected. Consider date-fns helpers",
      dstWarning:
        "Boundary calculation near DST transition. date-fns helpers handle this correctly",
      suggestStartOfDay: "Replace with startOfDay()",
      suggestEndOfDay: "Replace with endOfDay()",
      suggestStartOfWeek: "Replace with startOfWeek()",
      suggestEndOfMonth: "Replace with endOfMonth()",
      suggestLocalBoundary: "Use local-time boundary helper",
      suggestKeepAsIs: "Keep existing code (not a boundary)",
      suggestStartOrEnd: "Replace with conditional using startOfDay/endOfDay",
    },
    schema: [
      {
        type: "object",
        properties: {
          weekStartsOn: {
            type: "number",
            enum: [0, 1, 2, 3, 4, 5, 6],
            description: "The day of the week to start on (0=Sunday, 1=Monday)",
          },
          detectHacks: {
            type: "boolean",
            description: "Whether to detect millisecond arithmetic hacks",
          },
          suggestOnlyForAmbiguity: {
            type: "boolean",
            description: "Only suggest fixes for ambiguous patterns",
          },
          endOfDayHeuristic: {
            type: "string",
            enum: ["strict", "lenient", "aggressive"],
            description: "Strictness level for detecting end-of-day patterns",
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [
      {
        weekStartsOn: 1,
        detectHacks: true,
        suggestOnlyForAmbiguity: true,
        endOfDayHeuristic: "lenient",
      },
    ],
  },
  defaultOptions: [
    {
      weekStartsOn: 1,
      detectHacks: true,
      suggestOnlyForAmbiguity: true,
      endOfDayHeuristic: "lenient",
    },
  ],
  create(context, [options]) {
    const sourceCode = context.sourceCode;
    const services = ESLintUtils.getParserServices(context);
    const checker = services?.program?.getTypeChecker();

    // Track date-fns imports
    const dateFnsImports = new Map<string, string>(); // localName -> importedName

    return {
      // Track date-fns imports
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        if (node.source.value === "date-fns") {
          for (const specifier of node.specifiers) {
            if (specifier.type === "ImportSpecifier") {
              const imported = specifier.imported;
              const importedName =
                imported.type === "Identifier" ? imported.name : imported.value;
              const localName = specifier.local.name;
              dateFnsImports.set(localName, importedName);
            }
          }
        }
      },

      "CallExpression[callee.type='MemberExpression']"(
        node: TSESTree.CallExpression,
      ) {
        if (node.callee.type !== "MemberExpression") return;
        const callee = node.callee;
        if (callee.property.type !== "Identifier") return;

        const methodName = callee.property.name;
        if (!DATE_SETTERS.has(methodName)) return;

        const objectNode = callee.object;

        // Skip if the object type is any or unknown
        if (shouldSkipType(objectNode, checker, services)) return;

        // Check if setHours is used for its return value (timestamp)
        const parent = node.parent;
        const needsTimestamp =
          parent &&
          (parent.type === "VariableDeclarator" ||
            parent.type === "AssignmentExpression" ||
            parent.type === "ReturnStatement" ||
            parent.type === "ArrowFunctionExpression" ||
            (parent.type === "CallExpression" &&
              parent.arguments.includes(node)));

        // Check for start of day pattern: setHours(0, 0, 0, 0)
        if (methodName === "setHours" && node.arguments.length === 4) {
          const arguments_ = node.arguments;
          if (
            arguments_.every(
              (argument) => argument.type === "Literal" && argument.value === 0,
            )
          ) {
            context.report({
              node,
              messageId: "useStartOfDay",
              fix(fixer) {
                const objectText = sourceCode.getText(objectNode);
                const replacement = needsTimestamp
                  ? `+startOfDay(${objectText})`
                  : `startOfDay(${objectText})`;

                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["startOfDay"],
                  node,
                  replacement,
                );
              },
            });
            return;
          }
        }

        // Check for end of day patterns
        if (methodName === "setHours") {
          const heuristic = options?.endOfDayHeuristic ?? "lenient";
          const arguments_ = node.arguments;

          // Helper to check if argument is a literal with specific value
          const isLiteralValue = (
            argument: TSESTree.Node | undefined,
            value: number,
          ) => argument?.type === "Literal" && argument.value === value;

          const argumentCount = arguments_.length;
          let shouldAutofix = false;
          let shouldSuggest = false;

          switch (argumentCount) {
            case 4: {
              const [hours, minutes, seconds, ms] = arguments_;
              const is23_59_59_999 =
                isLiteralValue(hours, 23) &&
                isLiteralValue(minutes, 59) &&
                isLiteralValue(seconds, 59) &&
                isLiteralValue(ms, 999);

              const is23_59_59_0 =
                isLiteralValue(hours, 23) &&
                isLiteralValue(minutes, 59) &&
                isLiteralValue(seconds, 59) &&
                isLiteralValue(ms, 0);

              const is23_58Plus =
                isLiteralValue(hours, 23) &&
                minutes?.type === "Literal" &&
                typeof minutes.value === "number" &&
                minutes.value >= 58;

              // Always autofix canonical 23:59:59.999
              if (is23_59_59_999) {
                shouldAutofix = true;
              }
              // Lenient/Aggressive: autofix 23:59:59.0
              else if (heuristic !== "strict" && is23_59_59_0) {
                shouldAutofix = true;
              }
              // Aggressive: autofix 23:58+
              else if (heuristic === "aggressive" && is23_58Plus) {
                shouldAutofix = true;
              }
              // Strict/Lenient: suggest for 23:58+
              else if (heuristic !== "aggressive" && is23_58Plus) {
                shouldSuggest = true;
              }

              break;
            }
            case 3: {
              const [hours, minutes, seconds] = arguments_;
              const is23_59_59 =
                isLiteralValue(hours, 23) &&
                isLiteralValue(minutes, 59) &&
                isLiteralValue(seconds, 59);

              // Lenient/Aggressive: autofix 23:59:59
              if (heuristic !== "strict" && is23_59_59) {
                shouldAutofix = true;
              }
              // Strict: suggest for 23:59:59
              else if (heuristic === "strict" && is23_59_59) {
                shouldSuggest = true;
              }

              break;
            }
            case 2: {
              const [hours, minutes] = arguments_;
              const is23_58Plus =
                isLiteralValue(hours, 23) &&
                minutes?.type === "Literal" &&
                typeof minutes.value === "number" &&
                minutes.value >= 58;

              // Aggressive: autofix 23:58 or 23:59
              if (heuristic === "aggressive" && is23_58Plus) {
                shouldAutofix = true;
              }
              // Strict/Lenient: suggest for 23:58+
              else if (heuristic !== "aggressive" && is23_58Plus) {
                shouldSuggest = true;
              }

              break;
            }
            // No default
          }

          if (shouldAutofix) {
            context.report({
              node,
              messageId: "useEndOfDay",
              fix(fixer) {
                const objectText = sourceCode.getText(objectNode);
                const replacement = needsTimestamp
                  ? `+endOfDay(${objectText})`
                  : `endOfDay(${objectText})`;

                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["endOfDay"],
                  node,
                  replacement,
                );
              },
            });
            return;
          } else if (shouldSuggest) {
            context.report({
              node,
              messageId: "nearEndOfDay",
              suggest: [
                {
                  messageId: "suggestEndOfDay",
                  fix(fixer) {
                    const objectText = sourceCode.getText(objectNode);
                    const replacement = needsTimestamp
                      ? `+endOfDay(${objectText})`
                      : `endOfDay(${objectText})`;

                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["endOfDay"],
                      node,
                      replacement,
                    );
                  },
                },
              ],
            });
            return;
          }
        }

        // Check for ambiguous patterns with non-literal values
        if (methodName === "setHours" && node.arguments.length === 4) {
          const [hours, minutes, seconds, ms] = node.arguments;

          // Check if hours is non-literal but other args are literals (boundary indicators)
          const hasNonLiteralHours = hours && hours.type !== "Literal";
          const otherArgumentsAreBoundaryLike =
            minutes?.type === "Literal" &&
            seconds?.type === "Literal" &&
            ms?.type === "Literal" &&
            minutes.value === 0 &&
            seconds.value === 0 &&
            ms.value === 0;

          // Skip complex expressions that we can't confidently analyze
          // (LogicalExpression like || or &&, ChainExpression with optional chaining)
          const isExcludedExpression =
            hours &&
            (hours.type === "LogicalExpression" ||
              hours.type === "ChainExpression");

          if (
            hasNonLiteralHours &&
            otherArgumentsAreBoundaryLike &&
            hours &&
            !isExcludedExpression
          ) {
            // Check if hours is a simple conditional (ternary) with boundary values
            const isComplexExpression =
              hours.type === "ConditionalExpression" &&
              ((hours.consequent.type === "Literal" &&
                (hours.consequent.value === 0 ||
                  hours.consequent.value === 23)) ||
                (hours.alternate.type === "Literal" &&
                  (hours.alternate.value === 0 ||
                    hours.alternate.value === 23)));

            const messageId = isComplexExpression
              ? "complexBoundaryExpression"
              : "possibleBoundary";

            const suggestionMessageId = isComplexExpression
              ? "suggestStartOrEnd"
              : "suggestStartOfDay";

            context.report({
              node,
              messageId,
              suggest: [
                {
                  messageId: suggestionMessageId,
                  fix(fixer) {
                    const objectText = sourceCode.getText(objectNode);
                    let replacement: string;

                    if (
                      isComplexExpression &&
                      hours.type === "ConditionalExpression"
                    ) {
                      // For complex expressions, suggest conditional startOfDay/endOfDay
                      const testText = sourceCode.getText(hours.test);
                      const needsTimestampPrefix = needsTimestamp ? "+" : "";
                      replacement = `${testText} ? ${needsTimestampPrefix}startOfDay(${objectText}) : ${needsTimestampPrefix}endOfDay(${objectText})`;

                      return createImportAndReplaceFix(
                        context,
                        fixer,
                        ["startOfDay", "endOfDay"],
                        node,
                        replacement,
                      );
                    } else {
                      // For simple variables, suggest startOfDay
                      replacement = needsTimestamp
                        ? `+startOfDay(${objectText})`
                        : `startOfDay(${objectText})`;

                      return createImportAndReplaceFix(
                        context,
                        fixer,
                        ["startOfDay"],
                        node,
                        replacement,
                      );
                    }
                  },
                },
              ],
            });
            return;
          }
        }
        // Check for start of hour: setMinutes(0, 0, 0)
        if (methodName === "setMinutes" && node.arguments.length === 3) {
          const arguments_ = node.arguments;
          if (
            arguments_.every(
              (argument) => argument.type === "Literal" && argument.value === 0,
            )
          ) {
            context.report({
              node,
              messageId: "useStartOfHour",
              fix(fixer) {
                const objectText = sourceCode.getText(objectNode);
                const replacement = needsTimestamp
                  ? `+startOfHour(${objectText})`
                  : `startOfHour(${objectText})`;

                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["startOfHour"],
                  node,
                  replacement,
                );
              },
            });
            return;
          }
        }

        // Check for start of minute: setSeconds(0, 0)
        if (methodName === "setSeconds" && node.arguments.length === 2) {
          const arguments_ = node.arguments;
          if (
            arguments_.every(
              (argument) => argument.type === "Literal" && argument.value === 0,
            )
          ) {
            context.report({
              node,
              messageId: "useStartOfMinute",
              fix(fixer) {
                const objectText = sourceCode.getText(objectNode);
                const replacement = needsTimestamp
                  ? `+startOfMinute(${objectText})`
                  : `startOfMinute(${objectText})`;

                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["startOfMinute"],
                  node,
                  replacement,
                );
              },
            });
            return;
          }
        }

        // Check for start of second: setMilliseconds(0)
        if (methodName === "setMilliseconds" && node.arguments.length === 1) {
          const argument = node.arguments[0];
          if (argument?.type === "Literal" && argument.value === 0) {
            context.report({
              node,
              messageId: "useStartOfSecond",
              fix(fixer) {
                const objectText = sourceCode.getText(objectNode);
                const replacement = needsTimestamp
                  ? `+startOfSecond(${objectText})`
                  : `startOfSecond(${objectText})`;

                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["startOfSecond"],
                  node,
                  replacement,
                );
              },
            });
            return;
          }
        }
      },

      // Detect date-fns set() and setter chains
      CallExpression(node: TSESTree.CallExpression) {
        // Skip MemberExpression calls (handled above)
        if (node.callee.type === "MemberExpression") return;

        // Check for date-fns set() with boundary object
        if (
          isDateFnsFunction(node, "set", dateFnsImports) &&
          node.arguments.length === 2
        ) {
          const objectArgument = node.arguments[1];
          if (objectArgument?.type === "ObjectExpression") {
            const properties = objectArgument.properties;
            const propertyMap = new Map<string, number>();

            // Build map of property names to literal values
            for (const property of properties) {
              if (
                property.type === "Property" &&
                property.key.type === "Identifier" &&
                property.value.type === "Literal" &&
                typeof property.value.value === "number"
              ) {
                propertyMap.set(property.key.name, property.value.value);
              }
            }

            // Check for month boundary patterns first
            const isStartOfMonth =
              propertyMap.get("date") === 1 &&
              propertyMap.get("hours") === 0 &&
              propertyMap.get("minutes") === 0 &&
              propertyMap.get("seconds") === 0 &&
              propertyMap.get("milliseconds") === 0 &&
              !propertyMap.has("year") &&
              !propertyMap.has("month");

            if (isStartOfMonth) {
              const dateArgument = node.arguments[0];
              if (!dateArgument) return;

              context.report({
                node,
                messageId: "useStartOfMonth",
                fix(fixer) {
                  const dateArgumentText = sourceCode.getText(dateArgument);
                  return createImportAndReplaceFix(
                    context,
                    fixer,
                    ["startOfMonth"],
                    node,
                    `startOfMonth(${dateArgumentText})`,
                  );
                },
              });
              return;
            }

            // Check for year boundary patterns
            const isStartOfYear =
              propertyMap.get("month") === 0 &&
              propertyMap.get("date") === 1 &&
              propertyMap.get("hours") === 0 &&
              propertyMap.get("minutes") === 0 &&
              propertyMap.get("seconds") === 0 &&
              propertyMap.get("milliseconds") === 0 &&
              !propertyMap.has("year");

            if (isStartOfYear) {
              const dateArgument = node.arguments[0];
              if (!dateArgument) return;

              context.report({
                node,
                messageId: "useStartOfYear",
                fix(fixer) {
                  const dateArgumentText = sourceCode.getText(dateArgument);
                  return createImportAndReplaceFix(
                    context,
                    fixer,
                    ["startOfYear"],
                    node,
                    `startOfYear(${dateArgumentText})`,
                  );
                },
              });
              return;
            }

            const isEndOfYear =
              propertyMap.get("month") === 11 &&
              propertyMap.get("date") === 31 &&
              propertyMap.get("hours") === 23 &&
              propertyMap.get("minutes") === 59 &&
              propertyMap.get("seconds") === 59 &&
              propertyMap.get("milliseconds") === 999 &&
              !propertyMap.has("year");

            if (isEndOfYear) {
              const dateArgument = node.arguments[0];
              if (!dateArgument) return;

              context.report({
                node,
                messageId: "useEndOfYear",
                fix(fixer) {
                  const dateArgumentText = sourceCode.getText(dateArgument);
                  return createImportAndReplaceFix(
                    context,
                    fixer,
                    ["endOfYear"],
                    node,
                    `endOfYear(${dateArgumentText})`,
                  );
                },
              });
              return;
            }

            // Check if it's ONLY time properties (no year/month/date)
            const hasDateProperties = ["year", "month", "date"].some((key) =>
              propertyMap.has(key),
            );

            if (!hasDateProperties) {
              // Check for start of day pattern
              const isStartOfDay =
                propertyMap.get("hours") === 0 &&
                propertyMap.get("minutes") === 0 &&
                propertyMap.get("seconds") === 0 &&
                propertyMap.get("milliseconds") === 0;

              if (isStartOfDay) {
                const dateArgument = node.arguments[0];
                if (!dateArgument) return;

                context.report({
                  node,
                  messageId: "useStartOfDay",
                  fix(fixer) {
                    const dateArgumentText = sourceCode.getText(dateArgument);
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["startOfDay"],
                      node,
                      `startOfDay(${dateArgumentText})`,
                    );
                  },
                });
                return;
              }

              // Check for end of day patterns
              const heuristic = options?.endOfDayHeuristic ?? "lenient";
              const hours = propertyMap.get("hours");
              const minutes = propertyMap.get("minutes");
              const seconds = propertyMap.get("seconds");
              const ms = propertyMap.get("milliseconds");

              const isEndOfDay = isEndOfDayPattern(
                hours,
                minutes,
                seconds,
                ms,
                heuristic,
              );
              const shouldSuggest =
                !isEndOfDay &&
                heuristic !== "aggressive" &&
                isNearEndOfDay(hours, minutes);

              if (isEndOfDay) {
                const dateArgument = node.arguments[0];
                if (!dateArgument) return;

                context.report({
                  node,
                  messageId: "useEndOfDay",
                  fix(fixer) {
                    const dateArgumentText = sourceCode.getText(dateArgument);
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["endOfDay"],
                      node,
                      `endOfDay(${dateArgumentText})`,
                    );
                  },
                });
                return;
              } else if (shouldSuggest) {
                const dateArgument = node.arguments[0];
                if (!dateArgument) return;

                context.report({
                  node,
                  messageId: "nearEndOfDay",
                  suggest: [
                    {
                      messageId: "suggestEndOfDay",
                      fix(fixer) {
                        const dateArgumentText =
                          sourceCode.getText(dateArgument);
                        return createImportAndReplaceFix(
                          context,
                          fixer,
                          ["endOfDay"],
                          node,
                          `endOfDay(${dateArgumentText})`,
                        );
                      },
                    },
                  ],
                });
                return;
              }
            }
          }
        }

        // Check for date-fns setter chains: setHours(setMinutes(setSeconds(...)))
        // Detect patterns like:
        // - setHours(setMinutes(setSeconds(setMilliseconds(d, 0), 0), 0), 0) → startOfDay
        // - setHours(setMinutes(d, 0), 0) → startOfHour
        // - setSeconds(setMinutes(setHours(d, 23), 59), 59) → endOfDay
        if (node.callee.type === "Identifier") {
          const setterName = node.callee.name;
          const setterFunctions = new Set([
            "setHours",
            "setMinutes",
            "setSeconds",
            "setMilliseconds",
          ]);

          // Check if this is a date-fns setter function
          const importedName = dateFnsImports.get(setterName);

          if (importedName && setterFunctions.has(importedName)) {
            // Check if this node is nested inside another setter chain
            // If so, skip it - we'll handle it at the outermost level
            const parent = node.parent;
            if (
              parent?.type === "CallExpression" &&
              parent.callee.type === "Identifier"
            ) {
              const parentImportedName = dateFnsImports.get(parent.callee.name);
              if (
                parentImportedName &&
                setterFunctions.has(parentImportedName)
              ) {
                // This is nested inside another date-fns setter, skip it
                return;
              }
            }

            // Analyze the chain to extract all values
            const chainInfo = analyzeSetterChain(node);

            if (chainInfo) {
              const { hours, minutes, seconds, milliseconds } = chainInfo;

              // Check for start of day: ALL FOUR explicitly set to 0
              if (isStartOfDayPattern(hours, minutes, seconds, milliseconds)) {
                context.report({
                  node,
                  messageId: "useStartOfDay",
                  fix(fixer) {
                    const dateArgumentText = sourceCode.getText(
                      chainInfo.dateArgument,
                    );
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["startOfDay"],
                      node,
                      `startOfDay(${dateArgumentText})`,
                    );
                  },
                });
                return;
              }

              // Check for start of hour: setHours(setMinutes(d, 0), 0)
              // ONLY hours and minutes set (to 0), seconds/ms not touched
              if (
                hours === 0 &&
                minutes === 0 &&
                seconds === undefined &&
                milliseconds === undefined
              ) {
                context.report({
                  node,
                  messageId: "useStartOfHour",
                  fix(fixer) {
                    const dateArgumentText = sourceCode.getText(
                      chainInfo.dateArgument,
                    );
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["startOfHour"],
                      node,
                      `startOfHour(${dateArgumentText})`,
                    );
                  },
                });
                return;
              }

              // Check for end of day patterns in setter chains
              const chainHeuristic = options?.endOfDayHeuristic ?? "lenient";

              // Check if we have an EOD pattern
              const isChainEndOfDay = isEndOfDayPattern(
                hours,
                minutes,
                seconds,
                milliseconds,
                chainHeuristic,
              );

              if (isChainEndOfDay) {
                context.report({
                  node,
                  messageId: "useEndOfDay",
                  fix(fixer) {
                    const dateArgumentText = sourceCode.getText(
                      chainInfo.dateArgument,
                    );
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["endOfDay"],
                      node,
                      `endOfDay(${dateArgumentText})`,
                    );
                  },
                });
                return;
              }

              // Check for start of minute: setMinutes(setSeconds(setMilliseconds(d, 0), 0), 0)
              // hours is undefined, ONLY minutes, seconds, ms are set (to 0)
              if (
                hours === undefined &&
                minutes === 0 &&
                seconds === 0 &&
                milliseconds === 0
              ) {
                context.report({
                  node,
                  messageId: "useStartOfHour",
                  fix(fixer) {
                    const dateArgumentText = sourceCode.getText(
                      chainInfo.dateArgument,
                    );
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["startOfHour"],
                      node,
                      `startOfHour(${dateArgumentText})`,
                    );
                  },
                });
                return;
              }

              // Check for end of day patterns
              const heuristic = options?.endOfDayHeuristic ?? "lenient";
              const isEndOfDay = isEndOfDayPattern(
                hours,
                minutes,
                seconds,
                milliseconds,
                heuristic,
              );

              if (isEndOfDay) {
                context.report({
                  node,
                  messageId: "useEndOfDay",
                  fix(fixer) {
                    const dateArgumentText = sourceCode.getText(
                      chainInfo.dateArgument,
                    );
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["endOfDay"],
                      node,
                      `endOfDay(${dateArgumentText})`,
                    );
                  },
                });
                return;
              }
            }
          }
        }
      },

      // Detect new Date() constructor patterns for month boundaries
      NewExpression(node: TSESTree.NewExpression) {
        // Detect millisecond hacks if enabled
        if (
          (options?.detectHacks ?? true) &&
          node.callee.type === "Identifier" &&
          node.callee.name === "Date" &&
          node.arguments.length === 1
        ) {
          const argument = node.arguments[0];

          // Check for: new Date(+date + 86400000) or new Date(+date - ...)
          if (
            argument &&
            argument.type === "BinaryExpression" &&
            (argument.operator === "+" || argument.operator === "-")
          ) {
            // Left side should be unary + with a date-like expression
            const left = argument.left;
            const right = argument.right;

            // Pattern: +date + 86400000 (adding days)
            if (
              left.type === "UnaryExpression" &&
              left.operator === "+" &&
              right.type === "Literal" &&
              typeof right.value === "number"
            ) {
              const milliseconds = right.value;
              const days = milliseconds / MS_PER_DAY;

              // Check if it's a whole number of days
              if (
                argument.operator === "+" &&
                Number.isInteger(days) &&
                days > 0
              ) {
                const dateExpression = sourceCode.getText(left.argument);
                context.report({
                  node,
                  messageId: "useAddDays",
                  fix(fixer) {
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["addDays"],
                      node,
                      `addDays(${dateExpression}, ${days})`,
                    );
                  },
                });
                return;
              }
            }

            // Pattern: +date - date.getDay() * 86400000 (week start)
            if (
              left.type === "UnaryExpression" &&
              left.operator === "+" &&
              argument.operator === "-" &&
              right.type === "BinaryExpression" &&
              right.operator === "*"
            ) {
              // Check if right side is: something.getDay() * 86400000
              const multiplier = right.right;
              const getDayCall = right.left;

              if (
                multiplier.type === "Literal" &&
                multiplier.value === MS_PER_DAY &&
                getDayCall.type === "CallExpression" &&
                getDayCall.callee.type === "MemberExpression" &&
                getDayCall.callee.property.type === "Identifier" &&
                getDayCall.callee.property.name === "getDay"
              ) {
                // This is a week start calculation
                const dateExpression = sourceCode.getText(left.argument);
                const weekStartsOn = options?.weekStartsOn ?? 1;

                context.report({
                  node,
                  messageId: "useStartOfWeek",
                  fix(fixer) {
                    return createImportAndReplaceFix(
                      context,
                      fixer,
                      ["startOfWeek"],
                      node,
                      `startOfWeek(${dateExpression}, { weekStartsOn: ${weekStartsOn} })`,
                    );
                  },
                });
                return;
              }
            }
          }
        }

        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "Date" &&
          node.arguments.length === 3
        ) {
          const [yearArgument, monthArgument, dateArgument] = node.arguments;

          // Check for end of month: new Date(year, month + 1, 0)
          if (
            dateArgument?.type === "Literal" &&
            dateArgument.value === 0 &&
            monthArgument?.type === "BinaryExpression" &&
            monthArgument.operator === "+" &&
            monthArgument.right.type === "Literal" &&
            monthArgument.right.value === 1
          ) {
            if (!yearArgument) return;

            context.report({
              node,
              messageId: "useEndOfMonth",
              fix(fixer) {
                // Get the base month expression (left side of +)
                const baseMonthText = sourceCode.getText(monthArgument.left);
                const yearText = sourceCode.getText(yearArgument);
                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["endOfMonth"],
                  node,
                  `endOfMonth(new Date(${yearText}, ${baseMonthText}))`,
                );
              },
            });
            return;
          }

          // Check for start of month: new Date(year, month, 1)
          if (
            dateArgument?.type === "Literal" &&
            dateArgument.value === 1 &&
            monthArgument?.type !== "BinaryExpression" && // Simple month reference, not an expression
            yearArgument
          ) {
            context.report({
              node,
              messageId: "useStartOfMonth",
              fix(fixer) {
                const yearText = sourceCode.getText(yearArgument);
                const monthText = sourceCode.getText(monthArgument);
                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["startOfMonth"],
                  node,
                  `startOfMonth(new Date(${yearText}, ${monthText}))`,
                );
              },
            });
            return;
          }
        }
      },
    };
  },
});

/**
 * Checks if time components match a start-of-day pattern (00:00:00.000)
 */
function isStartOfDayPattern(
  hours: number | undefined,
  minutes: number | undefined,
  seconds: number | undefined,
  ms: number | undefined | null,
): boolean {
  return hours === 0 && minutes === 0 && seconds === 0 && ms === 0;
}

/**
 * Checks if time components match an end-of-day pattern based on heuristic
 * @param heuristic - Detection strictness level
 * @returns true if pattern matches EOD based on heuristic
 */
function isEndOfDayPattern(
  hours: number | undefined,
  minutes: number | undefined,
  seconds: number | undefined,
  ms: number | undefined | null,
  heuristic: EndOfDayHeuristic,
): boolean {
  // Strict: only 23:59:59.999
  if (hours === 23 && minutes === 59 && seconds === 59 && ms === 999) {
    return true;
  }

  // Lenient/Aggressive: 23:59:59 with ms===0 or undefined/null
  if (
    heuristic !== "strict" &&
    hours === 23 &&
    minutes === 59 &&
    seconds === 59 &&
    (ms === 0 || ms === undefined || ms === null)
  ) {
    return true;
  }

  // Aggressive: near-EOD (23:58 or 23:59)
  if (
    heuristic === "aggressive" &&
    hours === 23 &&
    minutes !== undefined &&
    minutes >= 58
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if time components are "near" end-of-day (23:58 or later)
 * Used for suggesting endOfDay even when not auto-fixing
 */
function isNearEndOfDay(
  hours: number | undefined,
  minutes: number | undefined,
): boolean {
  return hours === 23 && minutes !== undefined && minutes >= 58;
}

/**
 * Check if a node has a type that we should skip analyzing
 * (any, unknown, or not a Date type)
 */
function shouldSkipType(
  node: TSESTree.Node,
  checker: import("typescript").TypeChecker | undefined,
  services: ReturnType<typeof ESLintUtils.getParserServices>,
): boolean {
  if (!checker) return false;

  try {
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);
    const type = checker.getTypeAtLocation(tsNode);
    const typeString = checker.typeToString(type);

    // Skip if type is any or unknown
    if (typeString === "any" || typeString === "unknown") {
      return true;
    }
  } catch {
    // If we can't get type info, proceed with the check
    return false;
  }

  return false;
}

/**
 * Check if a function call is a date-fns import
 */
function isDateFnsFunction(
  node: TSESTree.CallExpression,
  functionName: string,
  dateFnsImports: Map<string, string>,
): boolean {
  if (node.callee.type !== "Identifier") return false;
  const calleeName = node.callee.name;
  const importedName = dateFnsImports.get(calleeName);
  return importedName === functionName;
}

// Helper to analyze nested setter chains
function analyzeSetterChain(node: TSESTree.CallExpression):
  | {
      hours: number | undefined;
      minutes: number | undefined;
      seconds: number | undefined;
      milliseconds: number | undefined;
      dateArgument: TSESTree.Node;
    }
  | undefined {
  const values = {
    hours: undefined as number | undefined,
    minutes: undefined as number | undefined,
    seconds: undefined as number | undefined,
    milliseconds: undefined as number | undefined,
  };

  let currentNode: TSESTree.Node = node;
  let dateArgument: TSESTree.Node | undefined = undefined;

  // Walk down the chain
  while (
    currentNode.type === "CallExpression" &&
    currentNode.callee.type === "Identifier"
  ) {
    const functionName = currentNode.callee.name;
    const nodeArguments: readonly TSESTree.Node[] = currentNode.arguments;

    // Extract the value being set
    // For date-fns setters: setHours(date, hours) - value is at index 1
    switch (functionName) {
      case "setHours": {
        const argument = nodeArguments[1];
        if (
          argument?.type === "Literal" &&
          typeof argument.value === "number"
        ) {
          values.hours = argument.value;
        }
        break;
      }
      case "setMinutes": {
        const argument = nodeArguments[1];
        if (
          argument?.type === "Literal" &&
          typeof argument.value === "number"
        ) {
          values.minutes = argument.value;
        }
        break;
      }
      case "setSeconds": {
        const argument = nodeArguments[1];
        if (
          argument?.type === "Literal" &&
          typeof argument.value === "number"
        ) {
          values.seconds = argument.value;
        }
        break;
      }
      case "setMilliseconds": {
        const argument = nodeArguments[1];
        if (
          argument?.type === "Literal" &&
          typeof argument.value === "number"
        ) {
          values.milliseconds = argument.value;
        }
        break;
      }
    }

    // Move to the first argument (the date, which might be another setter call)
    if (nodeArguments[0]) {
      currentNode = nodeArguments[0];
    } else {
      break;
    }
  }

  // The final node is the date argument
  dateArgument = currentNode;

  return dateArgument ? { ...values, dateArgument } : undefined;
}
