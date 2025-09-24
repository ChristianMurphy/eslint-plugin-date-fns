import test from "node:test";
import { tester } from "./_setup.ts";
import rule from "../dist/rules/no-date-coercion-literals/index.js";

// Test cases for no-date-coercion-literals rule
// Tests prevention of boolean and null literal coercion in Date constructor
test("no-date-coercion-literals", () => {
  tester.run("no-date-coercion-literals", rule, {
    valid: [
      // ✅ Already using date-fns
      `import { parseISO } from 'date-fns'; const d = parseISO('1970-01-01T00:00:00Z');`,
      `import { parseISO } from 'date-fns'; const d = parseISO('1970-01-01T00:00:00.001Z');`,
      `import { toDate } from 'date-fns'; const d = toDate(0);`,

      // ✅ Out of scope - valid Date patterns
      `const d = new Date();`,
      `const d = new Date('1970-01-01');`,
      `const d = new Date(1970, 0, 1);`,
      `const d = new Date(0);`,
      `const d = new Date(1);`,

      // ✅ Non-Date constructors
      `const d = new MyDate(null);`,
      `const d = new SomeClass(true);`,

      // ✅ Variable references (not literal coercion)
      `declare const nullVar: null; const d = new Date(nullVar);`,
      `declare const boolVar: boolean; const d = new Date(boolVar);`,

      // ✅ Unknown/any variables (not literal coercion)
      `declare const unknownVar: unknown; const d = new Date(unknownVar as any);`,
      `declare const anyVar: any; const d = new Date(anyVar);`,
      `const val: unknown = getValue(); const d = new Date(val as number);`,

      // ✅ Multiple arguments (different rule scope)
      `const d = new Date(null, 0, 1);`,
      `const d = new Date(true, false);`,

      // ✅ Other boolean-like values that don't coerce the same way
      `const d = new Date(undefined);`,
      `const d = new Date('');`,
    ],

    invalid: [
      // ❌ Basic coercion cases with autofix
      {
        code: `const d = new Date(null);`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00Z');`,
        errors: [{ messageId: "noNull", suggestions: [] }],
      },
      {
        code: `const d = new Date(true);`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00.001Z');`,
        errors: [{ messageId: "noTrue", suggestions: [] }],
      },
      {
        code: `const d = new Date(false);`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00Z');`,
        errors: [{ messageId: "noFalse", suggestions: [] }],
      },

      // ❌ globalThis.Date patterns
      {
        code: `const d = new globalThis.Date(null);`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00Z');`,
        errors: [{ messageId: "noNull", suggestions: [] }],
      },
      {
        code: `const d = new globalThis.Date(true);`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00.001Z');`,
        errors: [{ messageId: "noTrue", suggestions: [] }],
      },
      {
        code: `const d = new globalThis.Date(false);`,
        output: `import { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00Z');`,
        errors: [{ messageId: "noFalse", suggestions: [] }],
      },

      // ❌ Import integration - existing date-fns imports
      {
        code: `import { format } from 'date-fns'; const d = new Date(null);`,
        output: `import { format } from 'date-fns';\nimport { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00Z');`,
        errors: [{ messageId: "noNull", suggestions: [] }],
      },
      {
        code: `import { addDays } from 'date-fns'; const d = new Date(true);`,
        output: `import { addDays } from 'date-fns';\nimport { parseISO } from 'date-fns';\nconst d = parseISO('1970-01-01T00:00:00.001Z');`,
        errors: [{ messageId: "noTrue", suggestions: [] }],
      },

      // ❌ Complex expressions context
      {
        code: `const result = someFunc(new Date(null));`,
        output: `import { parseISO } from 'date-fns';\nconst result = someFunc(parseISO('1970-01-01T00:00:00Z'));`,
        errors: [{ messageId: "noNull", suggestions: [] }],
      },
      {
        code: `const arr = [new Date(true), otherValue];`,
        output: `import { parseISO } from 'date-fns';\nconst arr = [parseISO('1970-01-01T00:00:00.001Z'), otherValue];`,
        errors: [{ messageId: "noTrue", suggestions: [] }],
      },

      // ❌ Object property values
      {
        code: `const obj = { date: new Date(null), valid: false };`,
        output: `import { parseISO } from 'date-fns';\nconst obj = { date: parseISO('1970-01-01T00:00:00Z'), valid: false };`,
        errors: [{ messageId: "noNull", suggestions: [] }],
      },

      // ❌ Conditional expressions
      {
        code: `const d = flag ? new Date(true) : new Date();`,
        output: `import { parseISO } from 'date-fns';\nconst d = flag ? parseISO('1970-01-01T00:00:00.001Z') : new Date();`,
        errors: [{ messageId: "noTrue", suggestions: [] }],
      },

      // ❌ Multiple coercions in same code (requires multiple autofix passes)
      {
        code: "const a = new Date(null); const b = new Date(true);",
        output: [
          "import { parseISO } from 'date-fns';\nconst a = parseISO('1970-01-01T00:00:00Z'); const b = new Date(true);",
          "import { parseISO } from 'date-fns';\nconst a = parseISO('1970-01-01T00:00:00Z'); const b = parseISO('1970-01-01T00:00:00.001Z');",
        ],
        errors: [
          {
            messageId: "noNull",
          },
          {
            messageId: "noTrue",
          },
        ],
      },
    ],
  });
});
