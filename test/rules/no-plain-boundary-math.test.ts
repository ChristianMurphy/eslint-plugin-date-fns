import test from "node:test";
import { tester } from "../_setup.ts";
import rule from "../../dist/rules/no-plain-boundary-math/index.js";

test("no-plain-boundary-math: valid cases", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [
      // Already using date-fns boundaries
      `import { startOfDay } from 'date-fns'; const d = startOfDay(new Date());`,
      `import { endOfDay } from 'date-fns'; const e = endOfDay(new Date());`,
      `import { startOfWeek } from 'date-fns'; const w = startOfWeek(new Date(), { weekStartsOn: 1 });`,
      `import { endOfMonth } from 'date-fns'; const m = endOfMonth(new Date());`,
      `import { startOfQuarter } from 'date-fns'; const q = startOfQuarter(new Date());`,
      `import { endOfYear } from 'date-fns'; const y = endOfYear(new Date());`,

      // Composed boundaries (already optimal)
      `import { endOfDay, addWeeks } from 'date-fns'; const d = endOfDay(addWeeks(new Date(), 1));`,
      `import { startOfMonth, subMonths } from 'date-fns'; const m = startOfMonth(subMonths(new Date(), 1));`,

      // Non-boundary Date usage
      `const d = new Date(); d.setHours(9);`, // business hour
      `const d = new Date(); d.setMinutes(30);`, // specific time
      `const d = new Date(); d.setHours(14, 30);`, // specific time
      `const d = new Date(2024, 5, 15);`, // specific date
      `const d = new Date(2024, 5, 15, 14, 30);`, // specific date/time

      // Non-boundary date-fns setters
      `import { set } from 'date-fns'; const d = set(new Date(), { year: 2024, month: 5 });`,
      `import { set } from 'date-fns'; const d = set(new Date(), { hours: 9, minutes: 30 });`,
      `import { setHours } from 'date-fns'; const d = setHours(new Date(), 14);`,

      // Shadowed Date
      `function foo(Date) { const d = new Date(2024, 1, 0); return d; }`,
      `{ const Date = class {}; const d = new Date(2024, 1, 0); }`,

      // Non-date-fns set/setHours
      `import { set } from 'lodash'; set({}, "hours", 0);`,
      `const obj = { setHours: () => {} }; obj.setHours(0);`,

      // TypeScript unknown/any (can't analyze)
      `declare const d: unknown; d.setHours(0, 0, 0, 0);`,
      `const d: any = getDate(); d.setHours(0, 0, 0, 0);`,

      // Complex expressions we don't handle
      `const d = new Date(); d.setHours(config?.startHour || 0, 0, 0, 0);`,
      `const d = new Date(); d.setHours(Math.random() > 0.5 ? 0 : 23);`,
    ],
    invalid: [],
  });
});

test("no-plain-boundary-math: plain Date start of day", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Basic start of day pattern
      {
        code: `const date = new Date();\ndate.setHours(0, 0, 0, 0);`,
        output: `import { startOfDay } from 'date-fns';\nconst date = new Date();\nstartOfDay(date);`,
        errors: [{ messageId: "useStartOfDay" }],
      },

      // Start of day on identifier
      {
        code: `declare const d: Date;\nd.setHours(0, 0, 0, 0);`,
        output: `import { startOfDay } from 'date-fns';\ndeclare const d: Date;\nstartOfDay(d);`,
        errors: [{ messageId: "useStartOfDay" }],
      },

      // Start of day in expression
      {
        code: `const result = new Date().setHours(0, 0, 0, 0);`,
        output: `import { startOfDay } from 'date-fns';\nconst result = +startOfDay(new Date());`,
        errors: [{ messageId: "useStartOfDay" }],
      },
    ],
  });
});

test("no-plain-boundary-math: plain Date end of day (strict mode)", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Canonical EOD with milliseconds
      {
        code: `const d = new Date();\nd.setHours(23, 59, 59, 999);`,
        output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
        options: [{ endOfDayHeuristic: "strict" }],
        errors: [{ messageId: "useEndOfDay" }],
      },

      // EOD without milliseconds should NOT autofix in strict mode
      {
        code: `const d = new Date();\nd.setHours(23, 59, 59);`,
        options: [{ endOfDayHeuristic: "strict" }],
        errors: [
          {
            messageId: "nearEndOfDay",
            suggestions: [
              {
                messageId: "suggestEndOfDay",
                output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
              },
            ],
          },
        ],
      },
    ],
  });
});

test("no-plain-boundary-math: plain Date end of day (lenient mode)", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Canonical EOD with milliseconds - autofix
      {
        code: `const d = new Date();\nd.setHours(23, 59, 59, 999);`,
        output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
        options: [{ endOfDayHeuristic: "lenient" }],
        errors: [{ messageId: "useEndOfDay" }],
      },

      // EOD without milliseconds - autofix in lenient
      {
        code: `const d = new Date();\nd.setHours(23, 59, 59);`,
        output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
        options: [{ endOfDayHeuristic: "lenient" }],
        errors: [{ messageId: "useEndOfDay" }],
      },

      // Near-EOD should still suggest in lenient
      {
        code: `const d = new Date();\nd.setHours(23, 58);`,
        options: [{ endOfDayHeuristic: "lenient" }],
        errors: [
          {
            messageId: "nearEndOfDay",
            suggestions: [
              {
                messageId: "suggestEndOfDay",
                output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
              },
            ],
          },
        ],
      },
    ],
  });
});

test("no-plain-boundary-math: plain Date end of day (aggressive mode)", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Canonical EOD - autofix
      {
        code: `const d = new Date();\nd.setHours(23, 59, 59, 999);`,
        output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
        options: [{ endOfDayHeuristic: "aggressive" }],
        errors: [{ messageId: "useEndOfDay" }],
      },

      // Near-EOD - autofix in aggressive
      {
        code: `const d = new Date();\nd.setHours(23, 58);`,
        output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
        options: [{ endOfDayHeuristic: "aggressive" }],
        errors: [{ messageId: "useEndOfDay" }],
      },

      // 23:59 without seconds - autofix in aggressive
      {
        code: `const d = new Date();\nd.setHours(23, 59);`,
        output: `import { endOfDay } from 'date-fns';\nconst d = new Date();\nendOfDay(d);`,
        options: [{ endOfDayHeuristic: "aggressive" }],
        errors: [{ messageId: "useEndOfDay" }],
      },
    ],
  });
});

test("no-plain-boundary-math: date-fns set() to start of day", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [
      // With other properties (not a boundary)
      `import { set } from 'date-fns';\nconst s = set(d, { year: 2024, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });`,
    ],
    invalid: [
      // Basic set() to start of day
      {
        code: `import { set } from 'date-fns';\nconst s = set(d, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });`,
        output: `import { set, startOfDay } from 'date-fns';\nconst s = startOfDay(d);`,
        errors: [{ messageId: "useStartOfDay" }],
      },
    ],
  });
});

test("no-plain-boundary-math: date-fns setter chains to start of day", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Setter chain to start of day
      {
        code: `import { setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';\nconst s = setHours(setMinutes(setSeconds(setMilliseconds(d, 0), 0), 0), 0);`,
        output: `import { setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';\nconst s = startOfDay(d);`,
        errors: [{ messageId: "useStartOfDay" }],
      },

      // Partial chain (only hours and minutes)
      {
        code: `import { setHours, setMinutes } from 'date-fns';\nconst s = setHours(setMinutes(d, 0), 0);`,
        output: `import { setHours, setMinutes, startOfHour } from 'date-fns';\nconst s = startOfHour(d);`,
        errors: [{ messageId: "useStartOfHour" }],
      },
    ],
  });
});

test("no-plain-boundary-math: date-fns set() to end of day", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Canonical EOD in strict mode
      {
        code: `import { set } from 'date-fns';\nconst e = set(d, { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 });`,
        output: `import { endOfDay, set } from 'date-fns';\nconst e = endOfDay(d);`,
        options: [{ endOfDayHeuristic: "strict" }],
        errors: [{ messageId: "useEndOfDay" }],
      },

      // EOD without milliseconds in lenient mode
      {
        code: `import { set } from 'date-fns';\nconst e = set(d, { hours: 23, minutes: 59, seconds: 59 });`,
        output: `import { endOfDay, set } from 'date-fns';\nconst e = endOfDay(d);`,
        options: [{ endOfDayHeuristic: "lenient" }],
        errors: [{ messageId: "useEndOfDay" }],
      },

      // Near-EOD in aggressive mode
      {
        code: `import { set } from 'date-fns';\nconst e = set(d, { hours: 23, minutes: 58 });`,
        output: `import { endOfDay, set } from 'date-fns';\nconst e = endOfDay(d);`,
        options: [{ endOfDayHeuristic: "aggressive" }],
        errors: [{ messageId: "useEndOfDay" }],
      },
    ],
  });
});

test("no-plain-boundary-math: date-fns setter chains to end of day", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Setter chain to EOD (lenient)
      {
        code: `import { setHours, setMinutes, setSeconds } from 'date-fns';\nconst e = setSeconds(setMinutes(setHours(d, 23), 59), 59);`,
        output: `import { endOfDay, setHours, setMinutes, setSeconds } from 'date-fns';\nconst e = endOfDay(d);`,
        options: [{ endOfDayHeuristic: "lenient" }],
        errors: [{ messageId: "useEndOfDay" }],
      },
    ],
  });
});

test("no-plain-boundary-math: month boundaries", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // End of month (day 0 trick)
      {
        code: `const eom = new Date(year, month + 1, 0);`,
        output: `import { endOfMonth } from 'date-fns';\nconst eom = endOfMonth(new Date(year, month));`,
        errors: [{ messageId: "useEndOfMonth" }],
      },

      // Start of month
      {
        code: `const som = new Date(year, month, 1);`,
        output: `import { startOfMonth } from 'date-fns';\nconst som = startOfMonth(new Date(year, month));`,
        errors: [{ messageId: "useStartOfMonth" }],
      },

      // Start of month with set()
      {
        code: `import { set } from 'date-fns';\nconst som = set(d, { date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });`,
        output: `import { set, startOfMonth } from 'date-fns';\nconst som = startOfMonth(d);`,
        errors: [{ messageId: "useStartOfMonth" }],
      },
    ],
  });
});

test("no-plain-boundary-math: year boundaries", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Start of year
      {
        code: `import { set } from 'date-fns';\nconst s = set(d, { month: 0, date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });`,
        output: `import { set, startOfYear } from 'date-fns';\nconst s = startOfYear(d);`,
        errors: [{ messageId: "useStartOfYear" }],
      },

      // End of year (strict mode)
      {
        code: `import { set } from 'date-fns';\nconst e = set(d, { month: 11, date: 31, hours: 23, minutes: 59, seconds: 59, milliseconds: 999 });`,
        output: `import { endOfYear, set } from 'date-fns';\nconst e = endOfYear(d);`,
        options: [{ endOfDayHeuristic: "strict" }],
        errors: [{ messageId: "useEndOfYear" }],
      },
    ],
  });
});

test("no-plain-boundary-math: hour/minute/second boundaries", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Start of hour
      {
        code: `const d = new Date();\nd.setMinutes(0, 0, 0);`,
        output: `import { startOfHour } from 'date-fns';\nconst d = new Date();\nstartOfHour(d);`,
        errors: [{ messageId: "useStartOfHour" }],
      },

      // Start of minute
      {
        code: `const d = new Date();\nd.setSeconds(0, 0);`,
        output: `import { startOfMinute } from 'date-fns';\nconst d = new Date();\nstartOfMinute(d);`,
        errors: [{ messageId: "useStartOfMinute" }],
      },

      // Start of second
      {
        code: `const d = new Date();\nd.setMilliseconds(0);`,
        output: `import { startOfSecond } from 'date-fns';\nconst d = new Date();\nstartOfSecond(d);`,
        errors: [{ messageId: "useStartOfSecond" }],
      },
    ],
  });
});

test("no-plain-boundary-math: import management", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Merge with existing date-fns import
      {
        code: `import { format } from 'date-fns';\nconst date = new Date();\ndate.setHours(0, 0, 0, 0);`,
        output: `import { format, startOfDay } from 'date-fns';\nconst date = new Date();\nstartOfDay(date);`,
        errors: [{ messageId: "useStartOfDay" }],
      },

      // Keep setter imports and add boundary helper
      {
        code: `import { setHours, setMinutes, format } from 'date-fns';\nconst s = setHours(setMinutes(d, 0), 0);`,
        output: `import { format, setHours, setMinutes, startOfHour } from 'date-fns';\nconst s = startOfHour(d);`,
        errors: [{ messageId: "useStartOfHour" }],
      },
    ],
  });
});

test("no-plain-boundary-math: composition with existing date-fns", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Composition: set() after addDays()
      {
        code: `import { addDays, set } from 'date-fns';\nconst next = set(addDays(d, 7), { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });`,
        output: `import { addDays, set, startOfDay } from 'date-fns';\nconst next = startOfDay(addDays(d, 7));`,
        errors: [{ messageId: "useStartOfDay" }],
      },
    ],
  });
});

test("no-plain-boundary-math: suggestions for ambiguous patterns", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [],
    invalid: [
      // Variable hour value
      {
        code: `const d = new Date();\nd.setHours(startHour, 0, 0, 0);`,
        errors: [
          {
            messageId: "possibleBoundary",
            suggestions: [
              {
                messageId: "suggestStartOfDay",
                output: `import { startOfDay } from 'date-fns';\nconst d = new Date();\nstartOfDay(d);`,
              },
            ],
          },
        ],
      },

      // Complex expression
      {
        code: `const d = new Date();\nd.setHours(config.boundary ? 0 : 23, 0, 0, 0);`,
        errors: [
          {
            messageId: "complexBoundaryExpression",
            suggestions: [
              {
                messageId: "suggestStartOrEnd",
                output: `import { endOfDay, startOfDay } from 'date-fns';\nconst d = new Date();\nconfig.boundary ? startOfDay(d) : endOfDay(d);`,
              },
            ],
          },
        ],
      },
    ],
  });
});

test("no-plain-boundary-math: edge cases", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [
      // Shadowed Date constructor - should not trigger
      `function test(Date) { const d = new Date(2024, 1, 0); return d; }`,

      // Shadowed date-fns set
      `import { set as lodashSet } from 'lodash'; lodashSet(obj, "hours", 0);`,

      // TypeScript any type - should not trigger
      `const date: any = getDate(); date.setHours(0, 0, 0, 0);`,
    ],
    invalid: [],
  });
});

test("no-plain-boundary-math: detectHacks option", () => {
  tester.run("no-plain-boundary-math", rule, {
    valid: [
      // With detectHacks disabled, millisecond math is ignored
      {
        code: `const tomorrow = new Date(+date + 86400000);`,
        options: [{ detectHacks: false }],
      },
    ],
    invalid: [
      // With detectHacks enabled (default), millisecond math is caught
      {
        code: `const tomorrow = new Date(+date + 86400000);`,
        output: `import { addDays } from 'date-fns';\nconst tomorrow = addDays(date, 1);`,
        options: [{ detectHacks: true }],
        errors: [{ messageId: "useAddDays" }],
      },

      // Week millisecond math
      {
        code: `const weekStart = new Date(+date - date.getDay() * 86400000);`,
        output: `import { startOfWeek } from 'date-fns';\nconst weekStart = startOfWeek(date, { weekStartsOn: 0 });`,
        options: [{ detectHacks: true, weekStartsOn: 0 }],
        errors: [{ messageId: "useStartOfWeek" }],
      },
    ],
  });
});
