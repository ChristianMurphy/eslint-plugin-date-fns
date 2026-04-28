import test from "node:test";
import { runOnBoth } from "../_setup.ts";
import rule from "../../dist/rules/prefer-difference-in-unit/index.js";

test("prefer-difference-in-unit: valid cases", () => {
  runOnBoth("prefer-difference-in-unit", rule, {
    valid: [
      // Already using date-fns
      `import { differenceInDays } from 'date-fns'; declare const a: Date; declare const b: Date; differenceInDays(b, a);`,

      // Non-Date operands — scalars
      `const timestamp = 1_000_000; timestamp - 5;`,
      `(1_000_000 - 5) / 86400000;`,

      // Only one side is Date (AST-fallback)
      `(new Date().getTime() - startMs) / 86400000;`,

      // Addition or multiplication — not a difference
      `new Date().getTime() + 1000;`,
      `(new Date()).valueOf() * 2;`,

      // Divisor isn't a known time-unit literal
      `(new Date('2024-01-02') - new Date('2024-01-01')) / 7;`,
      `(new Date('2024-01-02') - new Date('2024-01-01')) / 100;`,

      // Variable divisor — not a literal
      {
        code: `declare const a: Date; declare const b: Date; declare const msPerDay: number; (b - a) / msPerDay;`,
        typeAwareOnly: true,
      },
    ],
    invalid: [],
  });
});

test("prefer-difference-in-unit: known-unit autofix, type-aware", () => {
  runOnBoth("prefer-difference-in-unit", rule, {
    valid: [],
    invalid: [
      // (Date - Date) / 86_400_000 → differenceInDays
      {
        code: `declare const a: Date; declare const b: Date; (b - a) / 86400000;`,
        output: `import { differenceInDays } from 'date-fns';\ndeclare const a: Date; declare const b: Date; differenceInDays(b, a);`,
        errors: [{ messageId: "preferDifference" }],
        typeAwareOnly: true,
      },

      // (Date - Date) / 3_600_000 → differenceInHours
      {
        code: `declare const a: Date; declare const b: Date; (b - a) / 3600000;`,
        output: `import { differenceInHours } from 'date-fns';\ndeclare const a: Date; declare const b: Date; differenceInHours(b, a);`,
        errors: [{ messageId: "preferDifference" }],
        typeAwareOnly: true,
      },

      // (Date - Date) / 60_000 → differenceInMinutes
      {
        code: `declare const a: Date; declare const b: Date; (b - a) / 60000;`,
        output: `import { differenceInMinutes } from 'date-fns';\ndeclare const a: Date; declare const b: Date; differenceInMinutes(b, a);`,
        errors: [{ messageId: "preferDifference" }],
        typeAwareOnly: true,
      },

      // (Date - Date) / 1000 → differenceInSeconds
      {
        code: `declare const a: Date; declare const b: Date; (b - a) / 1000;`,
        output: `import { differenceInSeconds } from 'date-fns';\ndeclare const a: Date; declare const b: Date; differenceInSeconds(b, a);`,
        errors: [{ messageId: "preferDifference" }],
        typeAwareOnly: true,
      },

      // Composite literal divisor: 1000 * 60 * 60 * 24 = 86_400_000
      {
        code: `declare const a: Date; declare const b: Date; (b - a) / (1000 * 60 * 60 * 24);`,
        output: `import { differenceInDays } from 'date-fns';\ndeclare const a: Date; declare const b: Date; differenceInDays(b, a);`,
        errors: [{ messageId: "preferDifference" }],
        typeAwareOnly: true,
      },

      // Merges into existing date-fns import
      {
        code: `import { addDays } from 'date-fns'; declare const a: Date; declare const b: Date; (b - a) / 86400000;`,
        output: `import { addDays, differenceInDays } from 'date-fns'; declare const a: Date; declare const b: Date; differenceInDays(b, a);`,
        errors: [{ messageId: "preferDifference" }],
        typeAwareOnly: true,
      },
    ],
  });
});

test("prefer-difference-in-unit: AST-fallback autofix", () => {
  runOnBoth("prefer-difference-in-unit", rule, {
    valid: [],
    invalid: [
      // new Date() operands — AST-inferrable Date, fires under both testers
      {
        code: `(new Date('2024-01-02') - new Date('2024-01-01')) / 86400000;`,
        output: `import { differenceInDays } from 'date-fns';\ndifferenceInDays(new Date('2024-01-02'), new Date('2024-01-01'));`,
        errors: [{ messageId: "preferDifference" }],
      },

      // date-fns imported Date-returning calls — AST-inferrable
      {
        code: `import { parseISO } from 'date-fns'; (parseISO('2024-01-02') - parseISO('2024-01-01')) / 86400000;`,
        output: `import { differenceInDays, parseISO } from 'date-fns'; differenceInDays(parseISO('2024-01-02'), parseISO('2024-01-01'));`,
        errors: [{ messageId: "preferDifference" }],
      },

      // Mixed: new Date() and imported call
      {
        code: `import { startOfDay } from 'date-fns'; (startOfDay(new Date()) - new Date('2024-01-01')) / 3600000;`,
        output: `import { differenceInHours, startOfDay } from 'date-fns'; differenceInHours(startOfDay(new Date()), new Date('2024-01-01'));`,
        errors: [{ messageId: "preferDifference" }],
      },

      // Composite divisor that exercises subtraction (90_000_000 - 3_600_000 = 86_400_000)
      {
        code: `(new Date('2024-01-02') - new Date('2024-01-01')) / (90000000 - 3600000);`,
        output: `import { differenceInDays } from 'date-fns';\ndifferenceInDays(new Date('2024-01-02'), new Date('2024-01-01'));`,
        errors: [{ messageId: "preferDifference" }],
      },
    ],
  });
});
