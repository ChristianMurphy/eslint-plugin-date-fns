import test from "node:test";
import { tester } from "../_setup.ts";
import rule from "../../dist/rules/prefer-date-fns-from-epoch/index.js";

// Test cases for prefer-date-fns-from-epoch rule
// Tests epoch timestamp detection and conversion to fromUnixTime/toDate
test("prefer-date-fns-from-epoch", () => {
  tester.run("prefer-date-fns-from-epoch", rule, {
    valid: [
      // Already using date-fns
      `import { toDate } from 'date-fns'; const d = toDate(1726700000000);`,
      `import { fromUnixTime } from 'date-fns'; const d = fromUnixTime(1726700000);`,

      // Out of scope for this rule
      `const d = new Date('2024-01-01');`,
      `const d = new Date(2024, 0, 2);`,
      `const t = Date.parse('2024-01-01');`,
      `const d = Date(123);`,
      `const d = new Date(1n);`,

      // Unknown type variables (not epoch numbers)
      `declare const unknownValue: unknown; const d = new Date(unknownValue as any);`,
      `const val: unknown = getValue(); const d = new Date(val as string);`,

      // Shadowed Date: do nothing
      `class Date { constructor(_x:number) {} } const d = new Date(1726700000);`,
      `function f(Date: any) { const d = new Date(1726700000); }`,
      `import Date from 'something'; const d = new Date(1726700000);`,
    ],

    invalid: [
      // Numeric literal → seconds → autofix
      {
        code: `const d = new Date(1726700000);`,
        output: `import { fromUnixTime } from 'date-fns';\nconst d = fromUnixTime(1726700000);`,
        errors: [{ messageId: "preferFromUnixTime" }],
      },
      // Numeric literal → milliseconds → autofix
      {
        code: `const d = new Date(1726700000000);`,
        output: `import { toDate } from 'date-fns';\nconst d = toDate(1726700000000);`,
        errors: [{ messageId: "preferToDate" }],
      },
      // Negative 10-digit seconds → suggestions only
      {
        code: `const d = new Date(-1234567890);`,
        errors: [
          {
            messageId: "preferToDate",
            suggestions: [
              {
                messageId: "suggestToDate",
                output: `import { toDate } from 'date-fns';\nconst d = toDate(-1234567890);`,
              },
              {
                messageId: "suggestFromUnixTime",
                output: `import { fromUnixTime } from 'date-fns';\nconst d = fromUnixTime(-1234567890);`,
              },
            ],
          },
        ],
      },

      // globalThis.Date forms
      {
        code: `const d = new globalThis.Date(1726700000);`,
        output: `import { fromUnixTime } from 'date-fns';\nconst d = fromUnixTime(1726700000);`,
        errors: [{ messageId: "preferFromUnixTime" }],
      },
      {
        code: `const d = new globalThis.Date(1726700000000);`,
        output: `import { toDate } from 'date-fns';\nconst d = toDate(1726700000000);`,
        errors: [{ messageId: "preferToDate" }],
      },

      // Identifier with literal init → autofix
      {
        code: `const n = 1726700000; const d = new Date(n);`,
        output: `import { fromUnixTime } from 'date-fns';\nconst n = 1726700000; const d = fromUnixTime(n);`,
        errors: [{ messageId: "preferFromUnixTime" }],
      },
      {
        code: `const ms = 1726700000000; const d = new Date(ms);`,
        output: `import { toDate } from 'date-fns';\nconst ms = 1726700000000; const d = toDate(ms);`,
        errors: [{ messageId: "preferToDate" }],
      },

      // Identifier with unary minus literal init
      {
        code: `const neg = -1234567890; const d = new Date(neg);`,
        errors: [
          {
            messageId: "preferToDate",
            suggestions: [
              {
                messageId: "suggestToDate",
                output: `import { toDate } from 'date-fns';\nconst neg = -1234567890; const d = toDate(neg);`,
              },
              {
                messageId: "suggestFromUnixTime",
                output: `import { fromUnixTime } from 'date-fns';\nconst neg = -1234567890; const d = fromUnixTime(neg);`,
              },
            ],
          },
        ],
      },
      {
        code: `const negMs = -1234567890123; const d = new Date(negMs);`,
        output: `import { toDate } from 'date-fns';\nconst negMs = -1234567890123; const d = toDate(negMs);`,
        errors: [{ messageId: "preferToDate" }],
      },

      // Identifier with `as const` numeric init → autofix
      {
        code: `const secs: number = 1726700000 as const; const d = new Date(secs);`,
        output: `import { fromUnixTime } from 'date-fns';\nconst secs: number = 1726700000 as const; const d = fromUnixTime(secs);`,
        errors: [{ messageId: "preferFromUnixTime" }],
      },
      {
        code: `const msec: number = 1726700000000 as const; const d = new Date(msec);`,
        output: `import { toDate } from 'date-fns';\nconst msec: number = 1726700000000 as const; const d = toDate(msec);`,
        errors: [{ messageId: "preferToDate" }],
      },

      // let / var with literal init → autofix
      {
        code: `let s = 1726700000; const d = new Date(s);`,
        output: `import { fromUnixTime } from 'date-fns';\nlet s = 1726700000; const d = fromUnixTime(s);`,
        errors: [{ messageId: "preferFromUnixTime" }],
      },
      {
        code: `var t = 1726700000000; const d = new Date(t);`,
        output: `import { toDate } from 'date-fns';\nvar t = 1726700000000; const d = toDate(t);`,
        errors: [{ messageId: "preferToDate" }],
      },

      // Typed number (no literal init) → suggestions only
      {
        code: `declare let n: number; const d = new Date(n);`,
        errors: [
          {
            messageId: "preferToDate",
            suggestions: [
              {
                messageId: "suggestToDate",
                output: `import { toDate } from 'date-fns';\ndeclare let n: number; const d = toDate(n);`,
              },
              {
                messageId: "suggestFromUnixTime",
                output: `import { fromUnixTime } from 'date-fns';\ndeclare let n: number; const d = fromUnixTime(n);`,
              },
            ],
          },
        ],
      },
      // Union including number (no literal init) → suggestions only
      {
        code: `declare let u: number | string; const d = new Date(u);`,
        errors: [
          {
            messageId: "preferToDate",
            suggestions: [
              {
                messageId: "suggestToDate",
                output: `import { toDate } from 'date-fns';\ndeclare let u: number | string; const d = toDate(u);`,
              },
              {
                messageId: "suggestFromUnixTime",
                output: `import { fromUnixTime } from 'date-fns';\ndeclare let u: number | string; const d = fromUnixTime(u);`,
              },
            ],
          },
        ],
      },

      // Merges into existing date-fns import
      {
        code: `import { format } from 'date-fns'; const d = new Date(1726700000000);`,
        output: `import { format, toDate } from 'date-fns'; const d = toDate(1726700000000);`,
        errors: [{ messageId: "preferToDate" }],
      },

      // ❌ Unknown type that could be epoch number
      {
        code: `declare const unknownEpoch: unknown; const d = new Date(unknownEpoch as number);`,
        errors: [
          {
            messageId: "preferToDate",
            suggestions: [
              {
                messageId: "suggestToDate",
                output: `import { toDate } from 'date-fns';\ndeclare const unknownEpoch: unknown; const d = toDate(unknownEpoch as number);`,
              },
              {
                messageId: "suggestFromUnixTime",
                output: `import { fromUnixTime } from 'date-fns';\ndeclare const unknownEpoch: unknown; const d = fromUnixTime(unknownEpoch as number);`,
              },
            ],
          },
        ],
      },

      // ❌ Numeric literal from any (should be detected)
      {
        code: `declare const anyEpoch: any; const epoch = +anyEpoch; const d = new Date(epoch);`,
        errors: [
          {
            messageId: "preferToDate",
            suggestions: [
              {
                messageId: "suggestToDate",
                output: `import { toDate } from 'date-fns';\ndeclare const anyEpoch: any; const epoch = +anyEpoch; const d = toDate(epoch);`,
              },
              {
                messageId: "suggestFromUnixTime",
                output: `import { fromUnixTime } from 'date-fns';\ndeclare const anyEpoch: any; const epoch = +anyEpoch; const d = fromUnixTime(epoch);`,
              },
            ],
          },
        ],
      },

      // ❌ Unknown variable from function
      {
        code: `const epochValue: unknown = getTimestamp(); const d = new Date(epochValue as number);`,
        errors: [
          {
            messageId: "preferToDate",
            suggestions: [
              {
                messageId: "suggestToDate",
                output: `import { toDate } from 'date-fns';\nconst epochValue: unknown = getTimestamp(); const d = toDate(epochValue as number);`,
              },
              {
                messageId: "suggestFromUnixTime",
                output: `import { fromUnixTime } from 'date-fns';\nconst epochValue: unknown = getTimestamp(); const d = fromUnixTime(epochValue as number);`,
              },
            ],
          },
        ],
      },
    ],
  });
});
