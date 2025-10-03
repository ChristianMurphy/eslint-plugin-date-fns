import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { ensureDateFnsNamedImports } from "./imports.js";

/**
 * Creates fix that imports date-fns functions and replaces node.
 */
export function createImportAndReplaceFix<
  MessageIds extends string,
  Options extends unknown[],
>(
  context: TSESLint.RuleContext<MessageIds, Options>,
  fixer: TSESLint.RuleFixer,
  imports: string[],
  node: TSESTree.Node,
  replacement: string,
): TSESLint.RuleFix[] {
  const importFix = ensureDateFnsNamedImports(context, fixer, imports);
  const fixes = [fixer.replaceText(node, replacement)];
  if (importFix) {
    fixes.unshift(importFix);
  }
  return fixes;
}
