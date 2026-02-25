import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * Creates ESLint fix to ensure date-fns named imports are available.
 * Merges new imports into existing date-fns import or creates new import.
 */
export function ensureDateFnsNamedImports(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  fixer: TSESLint.RuleFixer,
  names: string[],
): TSESLint.RuleFix | undefined {
  const sourceCode = context.sourceCode;
  const program = sourceCode.ast;

  // Find all date-fns imports (only named imports)
  const existing = (program.body as TSESTree.Node[]).filter(
    (nodeToCheck): nodeToCheck is TSESTree.ImportDeclaration =>
      nodeToCheck.type === "ImportDeclaration" &&
      nodeToCheck.source.value === "date-fns" &&
      nodeToCheck.specifiers.some((spec) => spec.type === "ImportSpecifier"),
  );

  // Deduplicate and sort input names alphabetically
  const uniqueNames = [...new Set(names)];
  uniqueNames.sort();

  // Collect existing imported names
  const existingNames = new Set<string>();
  for (const importNode of existing) {
    for (const spec of importNode.specifiers) {
      if (
        spec.type === "ImportSpecifier" &&
        spec.imported.type === "Identifier"
      ) {
        existingNames.add(spec.imported.name);
      }
    }
  }

  // Filter out already imported names
  const newNames = uniqueNames.filter(
    (name: string) => !existingNames.has(name),
  );

  // If no new imports needed, return undefined (no fix)
  if (newNames.length === 0) {
    return undefined;
  }

  // If there's an existing named import from date-fns, merge into the first one
  if (existing.length > 0) {
    const firstImport = existing[0];
    if (!firstImport) {
      throw new Error(
        "Array access returned undefined despite positive length",
      );
    }

    // Get all existing named import specifiers
    const existingSpecifiers = firstImport.specifiers
      .filter(
        (spec): spec is TSESTree.ImportSpecifier =>
          spec.type === "ImportSpecifier",
      )
      .map((spec) =>
        spec.imported.type === "Identifier"
          ? spec.imported.name
          : spec.imported.value,
      );

    // Combine and sort all names alphabetically
    const allNames = [...existingSpecifiers, ...newNames];
    allNames.sort();

    // Build new import statement
    const newImportText = `import { ${allNames.join(", ")} } from 'date-fns';`;

    return fixer.replaceText(firstImport, newImportText);
  }

  // No existing date-fns imports - create new import at top
  const importText = `import { ${newNames.join(", ")} } from 'date-fns';`;

  const firstNode = program.body[0];
  if (firstNode) {
    return fixer.insertTextBefore(firstNode, `${importText}\n`);
  }

  // Empty file - add at start
  return fixer.insertTextAfterRange([0, 0], `${importText}\n`);
}

/**
 * Creates ESLint fix to ensure @date-fns/tz named imports are available.
 * Merges new imports into existing @date-fns/tz import or creates new import.
 */
export function ensureDateFnsTzNamedImports(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  fixer: TSESLint.RuleFixer,
  names: string[],
): TSESLint.RuleFix | undefined {
  const sourceCode = context.sourceCode;
  const program = sourceCode.ast;

  // Find all @date-fns/tz imports (only named imports)
  const existing = (program.body as TSESTree.Node[]).filter(
    (nodeToCheck): nodeToCheck is TSESTree.ImportDeclaration =>
      nodeToCheck.type === "ImportDeclaration" &&
      nodeToCheck.source.value === "@date-fns/tz" &&
      nodeToCheck.specifiers.some((spec) => spec.type === "ImportSpecifier"),
  );

  // Deduplicate and sort input names alphabetically
  const uniqueNames = [...new Set(names)];
  uniqueNames.sort();

  // Collect existing imported names
  const existingNames = new Set<string>();
  for (const importNode of existing) {
    for (const spec of importNode.specifiers) {
      if (
        spec.type === "ImportSpecifier" &&
        spec.imported.type === "Identifier"
      ) {
        existingNames.add(spec.imported.name);
      }
    }
  }

  // Filter out already imported names
  const newNames = uniqueNames.filter(
    (name: string) => !existingNames.has(name),
  );

  // If no new imports needed, return undefined (no fix)
  if (newNames.length === 0) {
    return undefined;
  }

  // If there's an existing named import from @date-fns/tz, merge into the first one
  if (existing.length > 0) {
    const firstImport = existing[0];
    if (!firstImport) {
      throw new Error(
        "Array access returned undefined despite positive length",
      );
    }

    // Get all existing named import specifiers
    const existingSpecifiers = firstImport.specifiers
      .filter(
        (spec): spec is TSESTree.ImportSpecifier =>
          spec.type === "ImportSpecifier",
      )
      .map((spec) =>
        spec.imported.type === "Identifier"
          ? spec.imported.name
          : spec.imported.value,
      );

    // Combine and sort all names alphabetically
    const allNames = [...existingSpecifiers, ...newNames];
    allNames.sort();

    // Build new import statement
    const newImportText = `import { ${allNames.join(", ")} } from '@date-fns/tz';`;

    return fixer.replaceText(firstImport, newImportText);
  }

  // No existing @date-fns/tz imports - create new import at top
  const importText = `import { ${newNames.join(", ")} } from '@date-fns/tz';`;

  const firstNode = program.body[0];
  if (firstNode) {
    return fixer.insertTextBefore(firstNode, `${importText}\n`);
  }

  // Empty file - add at start
  return fixer.insertTextAfterRange([0, 0], `${importText}\n`);
}
