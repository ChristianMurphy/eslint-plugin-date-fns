import test from "node:test";
import { tester } from "./_setup.ts";
import rule from "../dist/rules/no-date-constructor-string/index.js";

// Test cases for no-date-constructor-string rule
// Tests string literal autofixes, variable suggestions, and edge cases
test("no-date-constructor-string: valid", () => {
  tester.run("no-date-constructor-string", rule, {
    valid: [
      // Valid date-fns usage
      `import { parseISO } from 'date-fns'; const d = parseISO('2024-10-11T00:00:00Z');`,
      `import { parse } from 'date-fns'; const d = parse('2024-10-11', 'yyyy-MM-dd', new Date());`,

      // Edge case: unknown type variables should not be flagged as strings
      `declare const unknownValue: unknown; const d = new Date(unknownValue as any);`,
      `const val: unknown = getValue(); const d = new Date(val as number);`,

      // Edge case: any type variables should not be flagged as strings
      `declare const anyValue: any; const d = new Date(anyValue);`,
      `const val: any = getInput(); const d = new Date(val);`,

      // Edge case: template literals with expressions should not be flagged
      `declare const unknownStr: unknown; const template = \`\${unknownStr}\`; const d = new Date(template);`,

      // Edge case: string constructor calls should not be flagged
      `declare const anyStr: any; const str = String(anyStr); const d = new Date(str);`,
    ],
    invalid: [
      {
        // Test case: ISO literal should get automatic fix to parseISO
        code: `const d = new Date('2024-10-11T00:00:00Z');`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('2024-10-11T00:00:00Z');`,
        errors: [{ messageId: "banNewDateString" }],
      },
      {
        // Non-ISO literal → suggestions to parse/parseISO; keep code, no output
        code: `const d = new Date('10/11/2024');`,
        errors: [
          {
            messageId: "banNewDateString",
            suggestions: [
              {
                messageId: "suggestParseISO",
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('10/11/2024');`,
              },
              {
                messageId: "suggestParse",
                output: `import { parse } from 'date-fns';\nconst d = parse('10/11/2024', 'yyyy-MM-dd', new Date());`,
              },
            ],
          },
        ],
      },
      {
        // Date.parse literal ISO → autofix
        code: `const t = Date.parse('2024-10-11T00:00:00Z');`,
        output: `import { parseISO } from 'date-fns';\nconst t = parseISO('2024-10-11T00:00:00Z');`,
        errors: [{ messageId: "banDateParse" }],
      },
      {
        // Variable string → suggestions (parseISO primary)
        code: `declare const s: string; const d = new Date(s);`,
        errors: [
          {
            messageId: "banNewDateString",
            suggestions: [
              {
                messageId: "suggestParseISO",
                output: `import { parseISO } from 'date-fns';\ndeclare const s: string; const d = parseISO(s);`,
              },
              {
                messageId: "suggestParse",
                output: `import { parse } from 'date-fns';\ndeclare const s: string; const d = parse(s, 'yyyy-MM-dd', new Date());`,
              },
            ],
          },
        ],
      },

      // Template literals with expressions are not detected as strings by the rule
      // (moved to valid section)
    ],
  });
});
