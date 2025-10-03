import test from "node:test";
import { tester } from "../_setup.ts";
import rule from "../../dist/rules/no-date-mutation/index.js";

test("no-date-mutation: valid cases", () => {
  tester.run("no-date-mutation", rule, {
    valid: [
      // date-fns usage - should NOT trigger
      `import { set } from 'date-fns'; let d = new Date(); d = set(d, { hours: 14 });`,
      `import { addMonths } from 'date-fns'; let d = new Date(); d = addMonths(d, 1);`,
      `import { startOfDay } from 'date-fns'; let d = new Date(); d = startOfDay(d);`,

      // Non-Date objects with setters
      `class MyClass { setHours(h: number) {} } const obj = new MyClass(); obj.setHours(5);`,
      `const obj = { setHours: (h: number) => {} }; obj.setHours(5);`,

      // Shadowed Date
      `function demo() { const Date = class {}; const d = new Date(); d.setHours(5); }`,
      `{ const Date = class {}; const d = new Date(); d.setHours(5); }`,

      // Getters only (no mutation)
      `const d = new Date(); const h = d.getHours();`,
      `const d = new Date(); const m = d.getMonth();`,
      `const d = new Date(); console.log(d.getTime());`,

      // Optional chaining (not handled yet)
      `declare const d: Date | null; d?.setHours(5);`,
    ],
    invalid: [],
  });
});

test("no-date-mutation: basic detection", () => {
  tester.run("no-date-mutation", rule, {
    valid: [],
    invalid: [
      // Legacy setYear - not yet handled
      {
        code: `let d = new Date(); d.setYear(2024);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Arithmetic patterns (optimized to add*/sub*)
      {
        code: `let d = new Date(); d.setHours(d.getHours() + 1);`,
        output: `import { addHours } from 'date-fns';\nlet d = new Date(); d = addHours(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setDate(d.getDate() - 7);`,
        output: `import { subWeeks } from 'date-fns';\nlet d = new Date(); d = subWeeks(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setMonth(d.getMonth() + 1);`,
        output: `import { addMonths } from 'date-fns';\nlet d = new Date(); d = addMonths(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Consecutive setters - merged into single set() call
      {
        code: `let d = new Date();\nd.setFullYear(2024);\nd.setMonth(5);\nd.setDate(15);`,
        output: `import { set } from 'date-fns';\nlet d = new Date();\nd = set(d, { year: 2024, month: 5, date: 15 });`,
        errors: [
          { messageId: "mutatingDate" },
          { messageId: "mutatingDate" },
          { messageId: "mutatingDate" },
        ],
      },

      // With identifier (fixed with type info)
      {
        code: `declare const d: Date; d.setHours(5);`,
        output: `import { set } from 'date-fns';\ndeclare const d: Date; d = set(d, { hours: 5 });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // globalThis.Date (fixed)
      {
        code: `let d = new globalThis.Date(); d.setHours(5);`,
        output: `import { set } from 'date-fns';\nlet d = new globalThis.Date(); d = set(d, { hours: 5 });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Multiple arguments with setFullYear (takes only first argument for now)
      // Future enhancement: Handle additional arguments (month, date)
      {
        code: `let d = new Date(); d.setFullYear(2024, 5, 15);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { year: 2024 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
    ],
  });
});

test("no-date-mutation: simple field updates", () => {
  tester.run("no-date-mutation", rule, {
    valid: [],
    invalid: [
      // Simple field updates → set()
      {
        code: `let d = new Date(); d.setHours(14);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { hours: 14 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setMinutes(30);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { minutes: 30 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setSeconds(45);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { seconds: 45 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setMilliseconds(500);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { milliseconds: 500 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `const d = new Date(); d.setFullYear(2024);`,
        output: `import { set } from 'date-fns';\nconst d = new Date(); d = set(d, { year: 2024 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setMonth(5);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { month: 5 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setDate(15);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { date: 15 });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // UTC variants
      {
        code: `let d = new Date(); d.setUTCFullYear(2024);`,
        output: `import { tz } from '@date-fns/tz';\nimport { set } from 'date-fns';\nlet d = new Date(); d = set(d, { year: 2024 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setUTCMonth(5);`,
        output: `import { tz } from '@date-fns/tz';\nimport { set } from 'date-fns';\nlet d = new Date(); d = set(d, { month: 5 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setUTCDate(15);`,
        output: `import { tz } from '@date-fns/tz';\nimport { set } from 'date-fns';\nlet d = new Date(); d = set(d, { date: 15 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setUTCHours(14);`,
        output: `import { tz } from '@date-fns/tz';\nimport { set } from 'date-fns';\nlet d = new Date(); d = set(d, { hours: 14 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setUTCMinutes(30);`,
        output: `import { tz } from '@date-fns/tz';\nimport { set } from 'date-fns';\nlet d = new Date(); d = set(d, { minutes: 30 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setUTCSeconds(45);`,
        output: `import { tz } from '@date-fns/tz';\nimport { set } from 'date-fns';\nlet d = new Date(); d = set(d, { seconds: 45 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setUTCMilliseconds(500);`,
        output: `import { tz } from '@date-fns/tz';\nimport { set } from 'date-fns';\nlet d = new Date(); d = set(d, { milliseconds: 500 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Midnight zeroing → startOfDay()
      {
        code: `let d = new Date(); d.setHours(0, 0, 0, 0);`,
        output: `import { startOfDay } from 'date-fns';\nlet d = new Date(); d = startOfDay(d);`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `let d = new Date(); d.setUTCHours(0, 0, 0, 0);`,
        output: `import { tz } from '@date-fns/tz';\nimport { startOfDay } from 'date-fns';\nlet d = new Date(); d = startOfDay(d, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // setTime() → toDate()
      {
        code: `let d = new Date(); d.setTime(1609459200000);`,
        output: `import { toDate } from 'date-fns';\nlet d = new Date(); d = toDate(1609459200000);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Merging with existing imports
      {
        code: `import { format } from 'date-fns';\nlet d = new Date(); d.setHours(14);`,
        output: `import { format, set } from 'date-fns';\nlet d = new Date(); d = set(d, { hours: 14 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `import { format } from 'date-fns';\nlet d = new Date(); d.setTime(1000);`,
        output: `import { format, toDate } from 'date-fns';\nlet d = new Date(); d = toDate(1000);`,
        errors: [{ messageId: "mutatingDate" }],
      },
      {
        code: `import { format } from 'date-fns';\nlet d = new Date(); d.setHours(0, 0, 0, 0);`,
        output: `import { format, startOfDay } from 'date-fns';\nlet d = new Date(); d = startOfDay(d);`,
        errors: [{ messageId: "mutatingDate" }],
      },
    ],
  });
});

test("no-date-mutation: arithmetic unit normalization", () => {
  tester.run("no-date-mutation", rule, {
    valid: [],
    invalid: [
      // Milliseconds → seconds (1000ms = 1s)
      {
        code: `let d = new Date(); d.setMilliseconds(d.getMilliseconds() + 1000);`,
        output: `import { addSeconds } from 'date-fns';\nlet d = new Date(); d = addSeconds(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Milliseconds → minutes (60000ms = 1min)
      {
        code: `let d = new Date(); d.setMilliseconds(d.getMilliseconds() + 60000);`,
        output: `import { addMinutes } from 'date-fns';\nlet d = new Date(); d = addMinutes(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Milliseconds → hours (3600000ms = 1hr)
      {
        code: `let d = new Date(); d.setMilliseconds(d.getMilliseconds() + 3600000);`,
        output: `import { addHours } from 'date-fns';\nlet d = new Date(); d = addHours(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Seconds → minutes (60s = 1min)
      {
        code: `let d = new Date(); d.setSeconds(d.getSeconds() + 60);`,
        output: `import { addMinutes } from 'date-fns';\nlet d = new Date(); d = addMinutes(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Seconds → hours (3600s = 1hr)
      {
        code: `let d = new Date(); d.setSeconds(d.getSeconds() + 3600);`,
        output: `import { addHours } from 'date-fns';\nlet d = new Date(); d = addHours(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Minutes → hours (60min = 1hr)
      {
        code: `let d = new Date(); d.setMinutes(d.getMinutes() + 60);`,
        output: `import { addHours } from 'date-fns';\nlet d = new Date(); d = addHours(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Hours → days (24hr = 1day)
      {
        code: `let d = new Date(); d.setHours(d.getHours() + 24);`,
        output: `import { addDays } from 'date-fns';\nlet d = new Date(); d = addDays(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Hours → days (48hr = 2days)
      {
        code: `let d = new Date(); d.setHours(d.getHours() + 48);`,
        output: `import { addDays } from 'date-fns';\nlet d = new Date(); d = addDays(d, 2);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Days → weeks (7 days = 1 week)
      {
        code: `let d = new Date(); d.setDate(d.getDate() + 7);`,
        output: `import { addWeeks } from 'date-fns';\nlet d = new Date(); d = addWeeks(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Days → weeks (14 days = 2 weeks)
      {
        code: `let d = new Date(); d.setDate(d.getDate() + 14);`,
        output: `import { addWeeks } from 'date-fns';\nlet d = new Date(); d = addWeeks(d, 2);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Months → quarters (3 months = 1 quarter)
      {
        code: `let d = new Date(); d.setMonth(d.getMonth() + 3);`,
        output: `import { addQuarters } from 'date-fns';\nlet d = new Date(); d = addQuarters(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Months → quarters (6 months = 2 quarters)
      {
        code: `let d = new Date(); d.setMonth(d.getMonth() + 6);`,
        output: `import { addQuarters } from 'date-fns';\nlet d = new Date(); d = addQuarters(d, 2);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Months → years (12 months = 1 year)
      {
        code: `let d = new Date(); d.setMonth(d.getMonth() + 12);`,
        output: `import { addYears } from 'date-fns';\nlet d = new Date(); d = addYears(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Months → years (24 months = 2 years)
      {
        code: `let d = new Date(); d.setMonth(d.getMonth() + 24);`,
        output: `import { addYears } from 'date-fns';\nlet d = new Date(); d = addYears(d, 2);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Subtraction: days → weeks
      {
        code: `let d = new Date(); d.setDate(d.getDate() - 7);`,
        output: `import { subWeeks } from 'date-fns';\nlet d = new Date(); d = subWeeks(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Subtraction: hours
      {
        code: `let d = new Date(); d.setHours(d.getHours() - 1);`,
        output: `import { subHours } from 'date-fns';\nlet d = new Date(); d = subHours(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Subtraction: months → years
      {
        code: `let d = new Date(); d.setMonth(d.getMonth() - 12);`,
        output: `import { subYears } from 'date-fns';\nlet d = new Date(); d = subYears(d, 1);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // UTC variants: setUTCHours with arithmetic
      {
        code: `let d = new Date(); d.setUTCHours(d.getUTCHours() + 1);`,
        output: `import { addHours } from 'date-fns';\nimport { tz } from '@date-fns/tz';\nlet d = new Date(); d = addHours(d, 1, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // UTC variants: days → weeks
      {
        code: `let d = new Date(); d.setUTCDate(d.getUTCDate() + 7);`,
        output: `import { addWeeks } from 'date-fns';\nimport { tz } from '@date-fns/tz';\nlet d = new Date(); d = addWeeks(d, 1, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Non-exact multiples stay as base unit (e.g., 5 hours stays as addHours)
      {
        code: `let d = new Date(); d.setHours(d.getHours() + 5);`,
        output: `import { addHours } from 'date-fns';\nlet d = new Date(); d = addHours(d, 5);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Non-exact multiples: 10 days (not a week multiple)
      {
        code: `let d = new Date(); d.setDate(d.getDate() + 10);`,
        output: `import { addDays } from 'date-fns';\nlet d = new Date(); d = addDays(d, 10);`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Multiple conversions: prefer largest unit (e.g., 7200000ms = 2hr not 120min)
      {
        code: `let d = new Date(); d.setMilliseconds(d.getMilliseconds() + 7200000);`,
        output: `import { addHours } from 'date-fns';\nlet d = new Date(); d = addHours(d, 2);`,
        errors: [{ messageId: "mutatingDate" }],
      },
    ],
  });
});

test("no-date-mutation: consecutive setters", () => {
  tester.run("no-date-mutation", rule, {
    valid: [],
    invalid: [
      // Basic consecutive setters - should merge into one set() call
      {
        code: `let d = new Date();\nd.setHours(14);\nd.setMinutes(30);`,
        output: `import { set } from 'date-fns';\nlet d = new Date();\nd = set(d, { hours: 14, minutes: 30 });`,
        errors: [{ messageId: "mutatingDate" }, { messageId: "mutatingDate" }],
      },

      // Three consecutive setters
      {
        code: `let d = new Date();\nd.setFullYear(2024);\nd.setMonth(5);\nd.setDate(15);`,
        output: `import { set } from 'date-fns';\nlet d = new Date();\nd = set(d, { year: 2024, month: 5, date: 15 });`,
        errors: [
          { messageId: "mutatingDate" },
          { messageId: "mutatingDate" },
          { messageId: "mutatingDate" },
        ],
      },

      // UTC consecutive setters
      {
        code: `let d = new Date();\nd.setUTCHours(14);\nd.setUTCMinutes(30);`,
        output: `import { set } from 'date-fns';\nimport { tz } from '@date-fns/tz';\nlet d = new Date();\nd = set(d, { hours: 14, minutes: 30 }, { in: tz('UTC') });`,
        errors: [{ messageId: "mutatingDate" }, { messageId: "mutatingDate" }],
      },

      // Different variables - should NOT merge (multi-pass fixes)
      {
        code: `let d1 = new Date();\nlet d2 = new Date();\nd1.setHours(14);\nd2.setMinutes(30);`,
        output: [
          `import { set } from 'date-fns';\nlet d1 = new Date();\nlet d2 = new Date();\nd1 = set(d1, { hours: 14 });\nd2.setMinutes(30);`,
          `import { set } from 'date-fns';\nlet d1 = new Date();\nlet d2 = new Date();\nd1 = set(d1, { hours: 14 });\nd2 = set(d2, { minutes: 30 });`,
        ],
        errors: [{ messageId: "mutatingDate" }, { messageId: "mutatingDate" }],
      },
    ],
  });
});

test("no-date-mutation: side effects with temp variables", () => {
  tester.run("no-date-mutation", rule, {
    valid: [],
    invalid: [
      // Side effect in single setter - needs temp variable
      {
        code: `let d = new Date(); d.setHours(getSomeValue());`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); const __dateFix1 = getSomeValue(); d = set(d, { hours: __dateFix1 });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Side effects in consecutive setters - needs multiple temps
      {
        code: `let d = new Date();\nd.setHours(getHours());\nd.setMinutes(getMinutes());`,
        output: `import { set } from 'date-fns';\nlet d = new Date();\nconst __dateFix1 = getHours();\nconst __dateFix2 = getMinutes();\nd = set(d, { hours: __dateFix1, minutes: __dateFix2 });`,
        errors: [{ messageId: "mutatingDate" }, { messageId: "mutatingDate" }],
      },

      // Math.* calls are pure - no temp needed
      {
        code: `let d = new Date(); d.setHours(Math.floor(14.5));`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { hours: Math.floor(14.5) });`,
        errors: [{ messageId: "mutatingDate" }],
      },

      // Mixed: literal, Math.*, and side effect
      {
        code: `let d = new Date();\nd.setHours(14);\nd.setMinutes(Math.ceil(30.2));\nd.setSeconds(getSeconds());`,
        output: `import { set } from 'date-fns';\nlet d = new Date();\nconst __dateFix1 = getSeconds();\nd = set(d, { hours: 14, minutes: Math.ceil(30.2), seconds: __dateFix1 });`,
        errors: [
          { messageId: "mutatingDate" },
          { messageId: "mutatingDate" },
          { messageId: "mutatingDate" },
        ],
      },

      // Multiple side effects in non-consecutive setters (not merged)
      // Each ESLint pass starts fresh, so temp vars restart from __dateFix1
      {
        code: `let d = new Date();\nd.setHours(getHours());\nconst x = 1;\nd.setMinutes(getMinutes());`,
        output: [
          `import { set } from 'date-fns';\nlet d = new Date();\nconst __dateFix1 = getHours(); d = set(d, { hours: __dateFix1 });\nconst x = 1;\nd.setMinutes(getMinutes());`,
          `import { set } from 'date-fns';\nlet d = new Date();\nconst __dateFix1 = getHours(); d = set(d, { hours: __dateFix1 });\nconst x = 1;\nconst __dateFix1 = getMinutes(); d = set(d, { minutes: __dateFix1 });`,
        ],
        errors: [{ messageId: "mutatingDate" }, { messageId: "mutatingDate" }],
      },
    ],
  });
});

test("no-date-mutation: UTC/local mismatch detection", () => {
  tester.run("no-date-mutation", rule, {
    valid: [],
    invalid: [
      // UTC setter with local getter - unclear intent
      {
        code: `let d = new Date(); d.setUTCHours(d.getHours() + 1);`,
        errors: [
          {
            messageId: "mutatingDateMismatch",
            data: {
              reason: "UTC setter with local getter - intent unclear",
            },
            suggestions: [
              {
                messageId: "suggestUTCIntent",
                output: `import { addHours, tz } from '@date-fns/tz';\nlet d = new Date(); d = addHours(d, 1, { in: tz('UTC') });`,
              },
              {
                messageId: "suggestLocalIntent",
                output: `import { addHours } from 'date-fns';\nlet d = new Date(); d = addHours(d, 1);`,
              },
            ],
          },
        ],
      },
    ],
  });
});

test("no-date-mutation: aliasing detection", () => {
  tester.run("no-date-mutation", rule, {
    valid: [],
    invalid: [
      // Alias created but not used after mutation - safe to fix
      {
        code: `const d = new Date(); const alias = d; d.setHours(5); return;`,
        output: `import { set } from 'date-fns';\nconst d = new Date(); const alias = d; d = set(d, { hours: 5 }); return;`,
        errors: [{ messageId: "mutatingDate" }],
      },
      // Alias used before mutation (safe to fix)
      {
        code: `let d = new Date(); const alias = d; console.log(alias); d.setHours(5);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); const alias = d; console.log(alias); d = set(d, { hours: 5 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
      // Different variables (not aliases) - safe to fix
      {
        code: `let d1 = new Date(); let d2 = new Date(); d1.setHours(5); console.log(d2);`,
        output: `import { set } from 'date-fns';\nlet d1 = new Date(); let d2 = new Date(); d1 = set(d1, { hours: 5 }); console.log(d2);`,
        errors: [{ messageId: "mutatingDate" }],
      },
      // Alias read after mutation - unsafe to convert
      {
        code: `const d = new Date(); const alias = d; d.setHours(5); console.log(alias);`,
        errors: [
          {
            messageId: "mutatingDateUnsafe",
            data: {
              reason:
                'alias "alias" is read after mutation - changing to immutable would alter behavior',
            },
          },
        ],
      },
      // Multiple aliases, one read after mutation
      {
        code: `let d = new Date(); const a1 = d; const a2 = d; d.setHours(5); console.log(a1);`,
        errors: [
          {
            messageId: "mutatingDateUnsafe",
            data: {
              reason:
                'alias "a1" is read after mutation - changing to immutable would alter behavior',
            },
          },
        ],
      },
      // Alias passed to function after mutation
      {
        code: `let d = new Date(); const alias = d; d.setHours(5); fn(alias);`,
        errors: [
          {
            messageId: "mutatingDateUnsafe",
            data: {
              reason:
                'alias "alias" is read after mutation - changing to immutable would alter behavior',
            },
          },
        ],
      },
      // Conditional read after mutation
      {
        code: `let d = new Date(); const alias = d; d.setHours(5); if (cond) { console.log(alias); }`,
        errors: [
          {
            messageId: "mutatingDateUnsafe",
            data: {
              reason:
                'alias "alias" is read after mutation - changing to immutable would alter behavior',
            },
          },
        ],
      },
    ],
  });
});
