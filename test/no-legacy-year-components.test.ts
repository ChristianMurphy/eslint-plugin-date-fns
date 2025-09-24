// tests/no-legacy-year-components.test.ts
import test from "node:test";
import { tester } from "./_setup.ts";
import rule from "../dist/rules/no-legacy-year-components/index.js";

// Test cases for no-legacy-year-components rule
// Tests detection of ambiguous 2-digit years (0-99) that map to 1900+year
test("no-legacy-year-components", () => {
  tester.run("no-legacy-year-components", rule, {
    valid: [
      // ✅ Already using date-fns (recommended approach)
      `import { parseISO } from 'date-fns'; const d = parseISO('1942-01-01T00:00:00Z');`,
      `import { parseISO } from 'date-fns'; const d = parseISO('2042-12-31T23:59:59Z');`,
      `import { parse } from 'date-fns'; const d = parse('42', 'yy', new Date());`,

      // ✅ Explicit 4-digit years (safe patterns)
      `const d = new Date(2001, 0, 1);`,
      `const d = new Date(1901, 5, 15);`,
      `const d = new Date(2024, 11, 31);`,
      `const d = new Date(1800, 0, 1);`,
      `const d = new Date(2100, 6, 4);`,

      // ✅ Year values outside legacy range
      `const d = new Date(100, 0, 1);`, // 100 is outside 0-99
      `const d = new Date(101, 11, 25);`,
      `const d = new Date(-1, 0, 1);`, // Negative years
      `const d = new Date(999, 5, 10);`,
      `const d = new Date(1000, 2, 20);`,

      // ✅ Variable references (not literal years)
      `declare const year: number; const d = new Date(year, 0, 1);`,
      `const y = 42; const d = new Date(y, 5, 10);`,
      `let currentYear = 99; const d = new Date(currentYear, 0, 1);`,
      `const year: number = getValue(); const d = new Date(year, 1, 15);`,

      // ✅ Unknown/any variables (not literal years)
      `declare const unknownYear: unknown; const d = new Date(unknownYear as number, 0, 1);`,
      `declare const anyYear: any; const d = new Date(anyYear, 5, 10);`,
      `const val: unknown = getYear(); const d = new Date(val as number, 2, 15);`,

      // ✅ Non-Date constructors
      `const d = new MyDate(42, 0, 1);`,
      `const d = new CustomDate(99, 11, 31);`,
      `const obj = new SomeClass(50, 5, 20);`,

      // ✅ Single argument constructors (different rule scope)
      `const d = new Date(42);`, // Timestamp, not year-month-day
      `const d = new Date(99);`,
      `const d = new Date('1942-01-01');`,
      `const d = new Date();`, // No arguments

      // ✅ Date shadowing scenarios
      `class Date { constructor(y: number, m: number, d: number) {} } const date = new Date(42, 0, 1);`,
      `function Date(y: number, m: number, d: number) { return {}; } const d = new Date(99, 5, 10);`,
      `function f(Date: any) { const d = new Date(50, 2, 15); }`,
      `import Date from 'custom-date'; const d = new Date(75, 8, 25);`,
      `const Date = CustomDateClass; const d = new Date(25, 11, 5);`,

      // ✅ Complex expressions (not literal years)
      `const d = new Date(year + offset, 0, 1);`,
      `const d = new Date(getYear(), 5, 10);`,
      `const d = new Date(Math.floor(Math.random() * 100), 2, 20);`,
      `const d = new Date(condition ? 2024 : 2025, 0, 1);`,

      // ✅ Boundary cases (exactly 100 and above)
      `const d = new Date(150, 0, 1);`,
      `const d = new Date(200, 6, 15);`,
      `const d = new Date(999, 11, 31);`,

      // ✅ Mixed valid/edge patterns
      `const d = new Date(2024, 0, 1, 12, 30, 45);`, // With time components
      `const d = new Date(1995, month, day, hour, minute, second, ms);`,
    ],

    invalid: [
      // ❌ Basic legacy year patterns (start of range)
      {
        code: `const d = new Date(0, 0, 1);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0000-01-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0000-01-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },
      {
        code: `const d = new Date(1, 5, 15);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0001-06-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0001-06-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ Mid-range legacy years
      {
        code: `const d = new Date(42, 0, 1);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0042-01-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0042-01-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },
      {
        code: `const d = new Date(50, 6, 20);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0050-07-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0050-07-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ End of legacy range
      {
        code: `const d = new Date(98, 10, 30);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0098-11-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0098-11-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },
      {
        code: `const d = new Date(99, 11, 31);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0099-12-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0099-12-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ globalThis.Date patterns
      {
        code: `const d = new globalThis.Date(25, 3, 10);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0025-04-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0025-04-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ With time components (still problematic)
      {
        code: `const d = new Date(75, 8, 15, 14, 30, 45);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0075-09-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = parseISO('0075-09-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ Variable month (should still flag year)
      {
        code: `declare const m: number; const d = new Date(60, m, 1);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0060-MM-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\ndeclare const m: number; const d = parseISO('0060-MM-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ Expression contexts
      {
        code: `const result = someFunc(new Date(35, 2, 20));`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0035-03-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst result = someFunc(parseISO('0035-03-01T00:00:00.000Z'));`,
              },
            ],
          },
        ],
      },

      // ❌ Object properties
      {
        code: `const obj = { date: new Date(80, 7, 25), valid: true };`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0080-08-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst obj = { date: parseISO('0080-08-01T00:00:00.000Z'), valid: true };`,
              },
            ],
          },
        ],
      },

      // ❌ Array elements
      {
        code: `const dates = [new Date(12, 1, 5), new Date(2024, 1, 5)];`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0012-02-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst dates = [parseISO('0012-02-01T00:00:00.000Z'), new Date(2024, 1, 5)];`,
              },
            ],
          },
        ],
      },

      // ❌ With existing date-fns imports
      {
        code: `import { format } from 'date-fns'; const d = new Date(90, 4, 10);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0090-05-01T00:00:00.000Z" },
                output: `import { format } from 'date-fns';\nimport { parseISO } from 'date-fns';\nconst d = parseISO('0090-05-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ Multiple legacy years in same code
      {
        code: `const start = new Date(20, 0, 1); const end = new Date(30, 11, 31);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0020-01-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst start = parseISO('0020-01-01T00:00:00.000Z'); const end = new Date(30, 11, 31);`,
              },
            ],
          },
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0030-12-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst start = new Date(20, 0, 1); const end = parseISO('0030-12-01T00:00:00.000Z');`,
              },
            ],
          },
        ],
      },

      // ❌ Conditional expressions
      {
        code: `const d = condition ? new Date(45, 6, 15) : new Date(2024, 6, 15);`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0045-07-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nconst d = condition ? parseISO('0045-07-01T00:00:00.000Z') : new Date(2024, 6, 15);`,
              },
            ],
          },
        ],
      },

      // ❌ Class methods and nested scopes
      {
        code: `class DateHandler { create() { return new Date(55, 9, 20); } }`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0055-10-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nclass DateHandler { create() { return parseISO('0055-10-01T00:00:00.000Z'); } }`,
              },
            ],
          },
        ],
      },

      // ❌ Function parameters and return values
      {
        code: `function createDate() { return new Date(85, 3, 8); }`,
        errors: [
          {
            messageId: "noLegacyYear",
            suggestions: [
              {
                messageId: "suggestParseIso",
                data: { iso: "0085-04-01T00:00:00.000Z" },
                output: `import { parseISO } from 'date-fns';\nfunction createDate() { return parseISO('0085-04-01T00:00:00.000Z'); }`,
              },
            ],
          },
        ],
      },
    ],
  });
});
