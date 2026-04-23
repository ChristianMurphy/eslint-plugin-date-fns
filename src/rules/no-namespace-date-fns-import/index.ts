import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESTree,
} from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = readonly [{ readonly packages?: readonly string[] }];
type MessageIds = "noNamespaceImport";

const DEFAULT_PACKAGES: readonly string[] = [
  "date-fns",
  "date-fns/fp",
  "@date-fns/tz",
];

function isRequireCall(
  node: TSESTree.Expression,
): node is TSESTree.CallExpression & {
  arguments: [TSESTree.StringLiteral];
} {
  // Matches the `require` identifier by name without a scope lookup;
  // a user-defined `require` that happens to be called with a date-fns
  // string literal will be flagged. Same shortcut ESLint's own
  // `no-require-imports` takes — the collision is vanishingly rare.
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  if (node.callee.type !== AST_NODE_TYPES.Identifier) return false;
  if (node.callee.name !== "require") return false;
  if (node.arguments.length !== 1) return false;
  const argument = node.arguments[0];
  return (
    argument !== undefined &&
    argument.type === AST_NODE_TYPES.Literal &&
    typeof argument.value === "string"
  );
}

/**
 * Flags namespace-style imports of date-fns packages, which defeat
 * tree-shaking. Covers `import * as dateFns from 'date-fns'`,
 * `const dateFns = require('date-fns')`, and package-specific variants.
 */
export default createRule<Options, MessageIds>({
  name: "no-namespace-date-fns-import",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow namespace-style imports of date-fns packages, which defeat tree-shaking.",
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        description:
          "Packages to treat as date-fns-like when detecting namespace imports.",
        properties: {
          packages: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
            description:
              "Package specifiers whose namespace imports should be flagged.",
          },
        },
      },
    ],
    defaultOptions: [{ packages: DEFAULT_PACKAGES }],
    messages: {
      noNamespaceImport:
        "Importing all of {{ source }} as a namespace defeats tree-shaking; use named imports.",
    },
  },
  defaultOptions: [{ packages: DEFAULT_PACKAGES }],
  create(context, [options]) {
    const packages = new Set<string>(options.packages ?? DEFAULT_PACKAGES);

    return {
      ImportDeclaration(node) {
        // Skip type-only namespace imports — types are erased at runtime
        // and do not affect bundle output.
        if (node.importKind === "type") return;
        if (!packages.has(node.source.value)) return;

        for (const specifier of node.specifiers) {
          if (specifier.type !== AST_NODE_TYPES.ImportNamespaceSpecifier) {
            continue;
          }
          context.report({
            node: specifier,
            messageId: "noNamespaceImport",
            data: { source: node.source.value },
          });
        }
      },
      VariableDeclaration(node) {
        for (const decl of node.declarations) {
          if (decl.init === null) continue;
          if (!isRequireCall(decl.init)) continue;
          const source = decl.init.arguments[0].value;
          if (!packages.has(source)) continue;
          // Only flag the "bag" shape: `const X = require('date-fns')`.
          // Destructuring (`const { format } = require('date-fns')`) is
          // fine — it reaches each export directly.
          if (decl.id.type !== AST_NODE_TYPES.Identifier) continue;
          context.report({
            node: decl,
            messageId: "noNamespaceImport",
            data: { source },
          });
        }
      },
    };
  },
});
