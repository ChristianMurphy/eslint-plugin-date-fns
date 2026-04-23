import {
  AST_NODE_TYPES,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";

/**
 * Checks module-scope statements for any binding of `name`. Covers import
 * specifiers (by their local binding), variable declarations binding a
 * plain identifier, and function or class declarations. Nested scopes,
 * destructuring patterns (`const { isEqual } = obj`), re-exports, and
 * TS-only namespace / enum declarations are not inspected — widen this
 * helper when a caller hits one of those cases.
 */
function isModuleScopeBindingUsed(
  program: TSESTree.Program,
  name: string,
): boolean {
  for (const stmt of program.body) {
    if (stmt.type === AST_NODE_TYPES.ImportDeclaration) {
      for (const spec of stmt.specifiers) {
        if (spec.local.name === name) return true;
      }
    } else if (stmt.type === AST_NODE_TYPES.VariableDeclaration) {
      for (const declaration of stmt.declarations) {
        if (
          declaration.id.type === AST_NODE_TYPES.Identifier &&
          declaration.id.name === name
        ) {
          return true;
        }
      }
    } else if (
      (stmt.type === AST_NODE_TYPES.FunctionDeclaration ||
        stmt.type === AST_NODE_TYPES.ClassDeclaration) &&
      stmt.id !== null &&
      stmt.id.name === name
    ) {
      return true;
    }
  }
  return false;
}

export interface DateFnsNamedImportResult {
  readonly fix: TSESLint.RuleFix | undefined;
  readonly localBinding: string;
}

/**
 * Ensures a single named export from date-fns is imported and returns the
 * local identifier the caller should use in replacement text. Reuses an
 * existing local binding when the name is already imported (with or
 * without an alias). Falls back to an alias when the plain name would
 * shadow a pre-existing module-scope declaration.
 */
export function ensureDateFnsNamedImport(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  fixer: TSESLint.RuleFixer,
  name: string,
  options?: { readonly aliasIfShadowed?: string },
): DateFnsNamedImportResult {
  const sourceCode = context.sourceCode;
  const program = sourceCode.ast;

  for (const stmt of program.body) {
    if (stmt.type !== AST_NODE_TYPES.ImportDeclaration) continue;
    if (stmt.source.value !== "date-fns") continue;
    for (const spec of stmt.specifiers) {
      if (spec.type !== AST_NODE_TYPES.ImportSpecifier) continue;
      const importedName =
        spec.imported.type === AST_NODE_TYPES.Identifier
          ? spec.imported.name
          : spec.imported.value;
      if (importedName === name) {
        return { fix: undefined, localBinding: spec.local.name };
      }
    }
  }

  const fallbackAlias = options?.aliasIfShadowed ?? `${name}Date`;
  const isShadowed = isModuleScopeBindingUsed(program, name);
  const localBinding = isShadowed ? fallbackAlias : name;
  const specifierText =
    localBinding === name ? name : `${name} as ${localBinding}`;

  const existing = (program.body as TSESTree.Node[]).filter(
    (nodeToCheck): nodeToCheck is TSESTree.ImportDeclaration =>
      nodeToCheck.type === AST_NODE_TYPES.ImportDeclaration &&
      nodeToCheck.source.value === "date-fns" &&
      nodeToCheck.specifiers.some((spec) => spec.type === "ImportSpecifier"),
  );

  if (existing.length > 0) {
    const firstImport = existing[0];
    if (!firstImport) {
      throw new Error(
        "Array access returned undefined despite positive length",
      );
    }
    const existingSpecifiers = firstImport.specifiers
      .filter(
        (spec): spec is TSESTree.ImportSpecifier =>
          spec.type === AST_NODE_TYPES.ImportSpecifier,
      )
      .map((spec) => {
        const impName =
          spec.imported.type === AST_NODE_TYPES.Identifier
            ? spec.imported.name
            : spec.imported.value;
        return impName === spec.local.name
          ? impName
          : `${impName} as ${spec.local.name}`;
      });
    const allSpecs = [...existingSpecifiers, specifierText];
    allSpecs.sort();
    const newText = `import { ${allSpecs.join(", ")} } from 'date-fns';`;
    return { fix: fixer.replaceText(firstImport, newText), localBinding };
  }

  const importText = `import { ${specifierText} } from 'date-fns';\n`;
  const firstNode = program.body[0];
  if (firstNode) {
    return { fix: fixer.insertTextBefore(firstNode, importText), localBinding };
  }
  return { fix: fixer.insertTextAfterRange([0, 0], importText), localBinding };
}

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
