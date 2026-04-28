import test from "node:test";
import { runOnBoth } from "../_setup.ts";
import rule from "../../dist/rules/no-date-in-string-interpolation/index.js";

test("no-date-in-string-interpolation: valid cases", () => {
  runOnBoth("no-date-in-string-interpolation", rule, {
    valid: [
      // Explicit formatter application
      `import { format } from 'date-fns'; declare const d: Date; const s = \`t: \${format(d, 'yyyy-MM-dd')}\`;`,
      `import { formatISO } from 'date-fns'; declare const d: Date; const s = \`t: \${formatISO(d)}\`;`,

      // Explicit deterministic methods
      `declare const d: Date; const s = \`t: \${d.toISOString()}\`;`,
      `declare const d: Date; const s = \`t: \${d.toLocaleString('en-US')}\`;`,
      `declare const d: Date; const s = \`t: \${d.getTime()}\`;`,

      // Non-Date interpolation
      `const s = \`count: \${42}\`;`,
      `const s = \`hello \${'world'}\`;`,

      // Plain templates (no interpolation)
      "const s = `plain`;",

      // Tagged template literals skip
      `declare const d: Date; declare function sql(parts: TemplateStringsArray, ...args: unknown[]): string; const s = sql\`insert \${d}\`;`,

      // No interpolation, no Date
      `const s = 'plain string';`,

      // String concatenation with non-Date operands
      `const s = 'count: ' + 42;`,
      `const s = 'hello ' + 'world';`,
      `declare const n: number; const s = 'n=' + n;`,

      // Numeric Date arithmetic (valueOf/getTime side)
      `const s = new Date().getTime() + 1;`,
      `const s = new Date().valueOf() * 2;`,
    ],
    invalid: [],
  });
});

test("no-date-in-string-interpolation: direct Date interpolation", () => {
  runOnBoth("no-date-in-string-interpolation", rule, {
    valid: [],
    invalid: [
      // new Date() in template literal
      {
        code: "const s = `today: ${new Date()}`;",
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nconst s = `today: ${format(new Date(), 'yyyy-MM-dd')}`;",
              },
            ],
          },
        ],
      },

      // Nested templates: inner interpolation fires
      {
        code: "const s = `outer ${`inner ${new Date()}`}`;",
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nconst s = `outer ${`inner ${format(new Date(), 'yyyy-MM-dd')}`}`;",
              },
            ],
          },
        ],
      },

      // Imported date-fns call
      {
        code: "import { parseISO } from 'date-fns'; const s = `when: ${parseISO('2024-01-01')}`;",
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format, parseISO } from 'date-fns'; const s = `when: ${format(parseISO('2024-01-01'), 'yyyy-MM-dd')}`;",
              },
            ],
          },
        ],
      },

      // Date-typed identifier
      {
        code: "declare const d: Date; const s = `at ${d}`;",
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\ndeclare const d: Date; const s = `at ${format(d, 'yyyy-MM-dd')}`;",
              },
            ],
          },
        ],
        typeAwareOnly: true,
      },
    ],
  });
});

test("no-date-in-string-interpolation: string concatenation", () => {
  runOnBoth("no-date-in-string-interpolation", rule, {
    valid: [],
    invalid: [
      // string + Date
      {
        code: `const s = 'today: ' + new Date();`,
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nconst s = 'today: ' + format(new Date(), 'yyyy-MM-dd');",
              },
            ],
          },
        ],
      },

      // Date + string
      {
        code: `const s = new Date() + ' suffix';`,
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nconst s = format(new Date(), 'yyyy-MM-dd') + ' suffix';",
              },
            ],
          },
        ],
      },

      // Date + "" explicit coercion
      {
        code: `const s = new Date() + '';`,
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nconst s = format(new Date(), 'yyyy-MM-dd') + '';",
              },
            ],
          },
        ],
      },

      // Date-typed identifier + string
      {
        code: `declare const d: Date; const s = 'at ' + d;`,
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\ndeclare const d: Date; const s = 'at ' + format(d, 'yyyy-MM-dd');",
              },
            ],
          },
        ],
        typeAwareOnly: true,
      },

      // Date + Date — reports once, not twice, on the same `+` expression
      {
        code: `const s = new Date('2024-01-01') + new Date('2024-01-02');`,
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nconst s = format(new Date('2024-01-01'), 'yyyy-MM-dd') + new Date('2024-01-02');",
              },
            ],
          },
        ],
      },

      // `s += date` — AssignmentExpression with operator +=
      {
        code: `let s = 'log:'; declare const d: Date; s += d;`,
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nlet s = 'log:'; declare const d: Date; s += format(d, 'yyyy-MM-dd');",
              },
            ],
          },
        ],
        typeAwareOnly: true,
      },
    ],
  });
});

test("no-date-in-string-interpolation: explicit .toString() coercion", () => {
  runOnBoth("no-date-in-string-interpolation", rule, {
    valid: [],
    invalid: [
      // .toString() on new Date()
      {
        code: "const s = `today: ${new Date().toString()}`;",
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\nconst s = `today: ${format(new Date(), 'yyyy-MM-dd')}`;",
              },
            ],
          },
        ],
      },

      // .toString() on a typed Date identifier
      {
        code: "declare const d: Date; const s = `at ${d.toString()}`;",
        errors: [
          {
            messageId: "dateInInterpolation",
            suggestions: [
              {
                messageId: "suggestFormat",
                output:
                  "import { format } from 'date-fns';\ndeclare const d: Date; const s = `at ${format(d, 'yyyy-MM-dd')}`;",
              },
            ],
          },
        ],
        typeAwareOnly: true,
      },
    ],
  });
});
