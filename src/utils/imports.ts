import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * Creates ESLint fix to ensure date-fns named imports are available.
 */
export function ensureDateFnsNamedImports(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  fixer: TSESLint.RuleFixer,
  names: string[],
): TSESLint.RuleFix {
  const sourceCode = context.getSourceCode();
  const program = sourceCode.ast;
  const existing = (program.body as TSESTree.Node[]).filter(
    (nodeToCheck): nodeToCheck is TSESTree.ImportDeclaration =>
      nodeToCheck.type === "ImportDeclaration" &&
      nodeToCheck.source.value === "date-fns",
  );

  // Check which names are already imported
  const existingNames = new Set<string>();
  for (const importNode of existing) {
    if (importNode.specifiers) {
      for (const spec of importNode.specifiers) {
        if (
          spec.type === "ImportSpecifier" &&
          spec.imported.type === "Identifier"
        ) {
          existingNames.add(spec.imported.name);
        }
      }
    }
  }

  // Filter out already imported names
  const newNames = names.filter((name) => !existingNames.has(name));

  // If no new imports needed, return a no-op fix
  if (newNames.length === 0) {
    return fixer.insertTextAfterRange([0, 0], "");
  }

  const importText =
    newNames.length === 1
      ? `import { ${newNames[0]} } from 'date-fns';`
      : `import { ${newNames.join(", ")} } from 'date-fns';`;

  if (existing.length > 0) {
    const last = existing.at(-1);
    if (!last)
      throw new Error("Array.at() returned undefined despite positive length");

    // Check if there's code on the same line after this import
    const lastImportEnd = last.range[1];
    const sourceText = sourceCode.getText();
    const restOfLine = sourceText.slice(lastImportEnd).match(/^[^\n\r]*/) ?? [
      "",
    ];
    const restOfLineText = restOfLine[0];

    if (restOfLineText.trim() === "") {
      return fixer.insertTextAfter(last, `\n${importText}`);
    } else {
      const leadingWhitespace = restOfLineText.match(/^\s*/)?.[0] ?? "";
      return fixer.replaceTextRange(
        [lastImportEnd, lastImportEnd + leadingWhitespace.length],
        `\n${importText}\n`,
      );
    }
  }

  const firstNode = program.body[0];
  if (firstNode) {
    return fixer.insertTextBefore(firstNode, `${importText}\n`);
  }
  return fixer.insertTextAfterRange([0, 0], `${importText}\n`);
}
