import type { TSESTree } from "@typescript-eslint/utils";

/**
 * Checks if node is an Identifier.
 */
export function isIdentifier(
  nodeToCheck: TSESTree.Node,
): nodeToCheck is TSESTree.Identifier {
  return nodeToCheck.type === "Identifier";
}

/**
 * Gets single expression argument from call or constructor.
 */
export function getSingleExpressionArgument(
  node: TSESTree.NewExpression | TSESTree.CallExpression,
): TSESTree.Expression | undefined {
  if (node.arguments.length !== 1) return undefined;
  const onlyArgument = node.arguments[0];
  if (!onlyArgument || onlyArgument.type === "SpreadElement") return undefined;
  return onlyArgument;
}

/**
 * Checks if node matches globalThis.Date member expression pattern.
 */
export function isGlobalThisDateCall(
  node: TSESTree.Node,
): node is TSESTree.MemberExpression & {
  object: TSESTree.Identifier & { name: "globalThis" };
  property: TSESTree.Identifier & { name: "Date" };
} {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "globalThis" &&
    node.property.type === "Identifier" &&
    node.property.name === "Date"
  );
}
