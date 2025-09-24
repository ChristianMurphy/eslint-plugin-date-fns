import test from "node:test";
import { tester } from "./_setup.ts";
import rule from "../dist/rules/prefer-iso-literal-over-components/index.js";

// Test cases for prefer-iso-literal-over-components rule
// Tests conversion of multi-argument Date constructors to ISO literals via parseISO
test("prefer-iso-literal-over-components", () => {
  tester.run("prefer-iso-literal-over-components", rule, {
    valid: [
      `import { parseISO } from 'date-fns'; const d = parseISO('2024-01-02T00:00:00.000Z');`,

      // ✅ Unknown/any variables (not component patterns)
      `declare const unknownValue: unknown; const d = new Date(unknownValue as any);`,
      `declare const anyValue: any; const d = new Date(anyValue);`,
      `const val: unknown = getValue(); const d = new Date(val as number);`,
    ],
    invalid: [
      {
        code: `const d = new Date(2024, 0, 2);`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('2024-01-02T00:00:00.000Z');`,
        errors: [{ messageId: "preferIso" }],
      },
      {
        code: `declare const m: number; const d = new Date(2024, m, 1);`,
        errors: [
          {
            messageId: "preferIso",
            suggestions: [
              {
                messageId: "suggestIso",
                output: `import { parseISO } from 'date-fns';\ndeclare const m: number; const d = parseISO('YYYY-MM-DDT00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ Unknown type in component position
      {
        code: `declare const unknownMonth: unknown; const d = new Date(2024, unknownMonth as number, 1);`,
        errors: [
          {
            messageId: "preferIso",
            suggestions: [
              {
                messageId: "suggestIso",
                output: `import { parseISO } from 'date-fns';\ndeclare const unknownMonth: unknown; const d = parseISO('YYYY-MM-DDT00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ Any type in component position
      {
        code: `declare const anyDay: any; const d = new Date(2024, 5, anyDay);`,
        errors: [
          {
            messageId: "preferIso",
            suggestions: [
              {
                messageId: "suggestIso",
                output: `import { parseISO } from 'date-fns';\ndeclare const anyDay: any; const d = parseISO('2024-06-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },
    ],
  });
});
