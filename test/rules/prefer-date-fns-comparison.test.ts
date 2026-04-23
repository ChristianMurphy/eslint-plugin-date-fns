import test from "node:test";
import { runOnBoth } from "../_setup.ts";
import rule from "../../dist/rules/prefer-date-fns-comparison/index.js";

test("prefer-date-fns-comparison: valid cases", () => {
  runOnBoth("prefer-date-fns-comparison", rule, {
    valid: [
      // Already using date-fns isEqual
      `import { isEqual } from 'date-fns'; declare const a: Date; declare const b: Date; isEqual(a, b);`,
      `import { isEqual } from 'date-fns'; declare const a: Date; declare const b: Date; if (!isEqual(a, b)) {}`,

      // Relational operators are intentionally out of scope
      `declare const a: Date; declare const b: Date; a.getTime() < b.getTime();`,
      `declare const a: Date; declare const b: Date; a.getTime() > b.getTime();`,
      `declare const a: Date; declare const b: Date; a.getTime() <= b.getTime();`,
      `declare const a: Date; declare const b: Date; a.getTime() >= b.getTime();`,

      // Only one side is .getTime() — rule does not fire
      `declare const a: Date; a.getTime() === 0;`,
      `declare const a: Date; a.getTime() === someNumber;`,
      `declare const a: Date; 0 === a.getTime();`,

      // Non-timestamp methods
      `declare const a: Date; declare const b: Date; a.getDate() === b.getDate();`,
      `declare const a: Date; declare const b: Date; a.toISOString() === b.toISOString();`,

      // valueOf with arguments is not the real Date.valueOf
      `declare const a: { valueOf: (x: number) => number }; declare const b: { valueOf: (x: number) => number }; a.valueOf(1) === b.valueOf(1);`,

      // getTime with arguments (not the real Date.getTime)
      `declare const a: { getTime: (x: number) => number }; declare const b: { getTime: (x: number) => number }; a.getTime(1) === b.getTime(1);`,

      // Computed access - not a dot access to getTime
      `declare const a: Date; declare const b: Date; a['getTime']() === b['getTime']();`,
    ],
    invalid: [],
  });
});

test("prefer-date-fns-comparison: equality autofix", () => {
  runOnBoth("prefer-date-fns-comparison", rule, {
    valid: [],
    invalid: [
      // Strict equality
      {
        code: `declare const a: Date; declare const b: Date; a.getTime() === b.getTime();`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Strict inequality
      {
        code: `declare const a: Date; declare const b: Date; a.getTime() !== b.getTime();`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; !isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Loose equality
      {
        code: `declare const a: Date; declare const b: Date; a.getTime() == b.getTime();`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Loose inequality
      {
        code: `declare const a: Date; declare const b: Date; a.getTime() != b.getTime();`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; !isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Merges into existing date-fns import
      {
        code: `import { addDays } from 'date-fns'; declare const a: Date; declare const b: Date; a.getTime() === b.getTime();`,
        output: `import { addDays, isEqual } from 'date-fns'; declare const a: Date; declare const b: Date; isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Existing isEqual import — not duplicated
      {
        code: `import { isEqual } from 'date-fns'; declare const a: Date; declare const b: Date; a.getTime() === b.getTime();`,
        output: `import { isEqual } from 'date-fns'; declare const a: Date; declare const b: Date; isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // new Date() as receivers
      {
        code: `new Date('2024-01-01').getTime() === new Date('2024-01-02').getTime();`,
        output: `import { isEqual } from 'date-fns';\nisEqual(new Date('2024-01-01'), new Date('2024-01-02'));`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // .valueOf() on both sides
      {
        code: `declare const a: Date; declare const b: Date; a.valueOf() === b.valueOf();`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Mixed: one side .getTime(), other .valueOf() — both produce a
      // timestamp, so the comparison still reduces to isEqual.
      {
        code: `declare const a: Date; declare const b: Date; a.getTime() === b.valueOf();`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // .valueOf() inequality
      {
        code: `declare const a: Date; declare const b: Date; a.valueOf() !== b.valueOf();`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; !isEqual(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },
    ],
  });
});

test("prefer-date-fns-comparison: type-aware suggestion", () => {
  runOnBoth("prefer-date-fns-comparison", rule, {
    valid: [
      // typeAwareOnly guards — non-Date types must not fire under the
      // type-aware branch
      {
        code: `declare const a: number; declare const b: number; a === b;`,
        typeAwareOnly: true,
      },
      {
        code: `declare const a: string; declare const b: string; a === b;`,
        typeAwareOnly: true,
      },
      {
        code: `declare const a: Date; declare const b: number; a === b;`,
        typeAwareOnly: true,
      },
      {
        code: `declare const a: Date | null; declare const b: Date | null; a === b;`,
        typeAwareOnly: true,
      },
    ],
    invalid: [
      // Type-aware branch: both sides are Date, suggestion only (no autofix)
      {
        code: `declare const a: Date; declare const b: Date; a === b;`,
        errors: [
          {
            messageId: "preferIsEqual",
            suggestions: [
              {
                messageId: "suggestIsEqual",
                output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; isEqual(a, b);`,
              },
            ],
          },
        ],
        typeAwareOnly: true,
      },
      {
        code: `declare const a: Date; declare const b: Date; a !== b;`,
        errors: [
          {
            messageId: "preferIsEqual",
            suggestions: [
              {
                messageId: "suggestIsEqual",
                output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; !isEqual(a, b);`,
              },
            ],
          },
        ],
        typeAwareOnly: true,
      },
    ],
  });
});

test("prefer-date-fns-comparison: ast-fallback suggestion", () => {
  runOnBoth("prefer-date-fns-comparison", rule, {
    valid: [
      // Only one side is an obvious Date expression — rule skips
      `new Date('2024-01-01') === someUnknown;`,
      `parseISO('2024-01-01') === someUnknown;`,
      // Unknown call — not in the date-fns list
      `notDateFns() === anotherCall();`,
      // User-defined parseISO (not imported from date-fns) — rule skips
      `function parseISO(s: string): string { return s; } parseISO('a') === parseISO('b');`,
      // Imported from a non-date-fns library — rule skips
      `import { parseISO } from 'my-own-library'; parseISO('a') === parseISO('b');`,
    ],
    invalid: [
      // Both sides are new Date(...) — suggestion
      {
        code: `new Date('2024-01-01') === new Date('2024-01-02');`,
        errors: [
          {
            messageId: "preferIsEqual",
            suggestions: [
              {
                messageId: "suggestIsEqual",
                output: `import { isEqual } from 'date-fns';\nisEqual(new Date('2024-01-01'), new Date('2024-01-02'));`,
              },
            ],
          },
        ],
      },
      // Both sides are known date-fns Date-returning functions
      {
        code: `import { parseISO } from 'date-fns'; parseISO('2024-01-01') === parseISO('2024-01-02');`,
        errors: [
          {
            messageId: "preferIsEqual",
            suggestions: [
              {
                messageId: "suggestIsEqual",
                output: `import { isEqual, parseISO } from 'date-fns'; isEqual(parseISO('2024-01-01'), parseISO('2024-01-02'));`,
              },
            ],
          },
        ],
      },
      // Mix of new Date and date-fns call — both Date-returning
      {
        code: `import { startOfDay } from 'date-fns'; startOfDay(new Date()) !== new Date('2024-01-01');`,
        errors: [
          {
            messageId: "preferIsEqual",
            suggestions: [
              {
                messageId: "suggestIsEqual",
                output: `import { isEqual, startOfDay } from 'date-fns'; !isEqual(startOfDay(new Date()), new Date('2024-01-01'));`,
              },
            ],
          },
        ],
      },
    ],
  });
});

test("prefer-date-fns-comparison: import collisions", () => {
  runOnBoth("prefer-date-fns-comparison", rule, {
    valid: [],
    invalid: [
      // isEqual already aliased from another library — reuse that binding.
      // (This case technically imports date-fns already, but with an alias.)
      {
        code: `import { isEqual as sameDate } from 'date-fns'; declare const a: Date; declare const b: Date; a.getTime() === b.getTime();`,
        output: `import { isEqual as sameDate } from 'date-fns'; declare const a: Date; declare const b: Date; sameDate(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // isEqual imported from a non-date-fns library — inject date-fns import
      // as an alias to avoid the collision.
      {
        code: `import { isEqual } from 'lodash'; declare const a: Date; declare const b: Date; const shallow = isEqual({}, {}); const same = a.getTime() === b.getTime();`,
        output: `import { isEqual as isEqualDate } from 'date-fns';\nimport { isEqual } from 'lodash'; declare const a: Date; declare const b: Date; const shallow = isEqual({}, {}); const same = isEqualDate(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Local const named isEqual at module scope — also forces alias.
      {
        code: `const isEqual = (x: unknown, y: unknown) => x === y; declare const a: Date; declare const b: Date; const same = a.getTime() === b.getTime();`,
        output: `import { isEqual as isEqualDate } from 'date-fns';\nconst isEqual = (x: unknown, y: unknown) => x === y; declare const a: Date; declare const b: Date; const same = isEqualDate(a, b);`,
        errors: [{ messageId: "preferIsEqual" }],
      },
    ],
  });
});

test("prefer-date-fns-comparison: context and placement", () => {
  runOnBoth("prefer-date-fns-comparison", rule, {
    valid: [],
    invalid: [
      // Unary negation around the comparison — source parens survive the replace
      {
        code: `declare const a: Date; declare const b: Date; if (!(a.getTime() === b.getTime())) {}`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; if (!(isEqual(a, b))) {}`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Ternary context
      {
        code: `declare const a: Date; declare const b: Date; const r = a.getTime() === b.getTime() ? 'same' : 'diff';`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; const r = isEqual(a, b) ? 'same' : 'diff';`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Logical AND context
      {
        code: `declare const a: Date; declare const b: Date; if (ok && a.getTime() !== b.getTime()) {}`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; if (ok && !isEqual(a, b)) {}`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Function argument context
      {
        code: `declare const a: Date; declare const b: Date; doSomething(a.getTime() === b.getTime());`,
        output: `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; doSomething(isEqual(a, b));`,
        errors: [{ messageId: "preferIsEqual" }],
      },

      // Multiple offenses in one file — both reported. The shared
      // import-injection fix overlaps at the insertion point, so ESLint
      // applies one fix per pass; both converge after two passes.
      {
        code: `declare const a: Date; declare const b: Date; declare const c: Date; const x = a.getTime() === b.getTime(); const y = b.getTime() !== c.getTime();`,
        output: [
          `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; declare const c: Date; const x = isEqual(a, b); const y = b.getTime() !== c.getTime();`,
          `import { isEqual } from 'date-fns';\ndeclare const a: Date; declare const b: Date; declare const c: Date; const x = isEqual(a, b); const y = !isEqual(b, c);`,
        ],
        errors: [
          { messageId: "preferIsEqual" },
          { messageId: "preferIsEqual" },
        ],
      },
    ],
  });
});
