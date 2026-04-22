import test from "node:test";
import { astOnlyTester } from "../_setup.ts";
import noDateMutation from "../../dist/rules/no-date-mutation/index.js";
import noDateConstructorString from "../../dist/rules/no-date-constructor-string/index.js";
import preferDateFnsFromEpoch from "../../dist/rules/prefer-date-fns-from-epoch/index.js";
import noPlainBoundaryMath from "../../dist/rules/no-plain-boundary-math/index.js";

test("no-date-mutation: AST-only mode still detects new Date() mutation", () => {
  astOnlyTester.run("no-date-mutation", noDateMutation, {
    valid: [
      `const obj = { setHours: (h: number) => {} }; obj.setHours(5);`,
      `function demo() { const Date = class {}; const d = new Date(); d.setHours(5); }`,
    ],
    invalid: [
      {
        code: `let d = new Date(); d.setHours(5);`,
        output: `import { set } from 'date-fns';\nlet d = new Date(); d = set(d, { hours: 5 });`,
        errors: [{ messageId: "mutatingDate" }],
      },
    ],
  });
});

test("no-date-constructor-string: AST-only mode still flags literal strings", () => {
  astOnlyTester.run("no-date-constructor-string", noDateConstructorString, {
    valid: [`import { parseISO } from 'date-fns'; parseISO('2024-01-01');`],
    invalid: [
      {
        code: `new Date('2024-01-01');`,
        output: `import { parseISO } from 'date-fns';\nparseISO('2024-01-01');`,
        errors: [{ messageId: "banNewDateString" }],
      },
    ],
  });
});

test("prefer-date-fns-from-epoch: AST-only mode still flags numeric literals", () => {
  astOnlyTester.run("prefer-date-fns-from-epoch", preferDateFnsFromEpoch, {
    valid: [`import { toDate } from 'date-fns'; toDate(0);`],
    invalid: [
      {
        code: `new Date(1700000000);`,
        output: `import { fromUnixTime } from 'date-fns';\nfromUnixTime(1700000000);`,
        errors: [{ messageId: "preferFromUnixTime" }],
      },
      {
        code: `new Date(1700000000000);`,
        output: `import { toDate } from 'date-fns';\ntoDate(1700000000000);`,
        errors: [{ messageId: "preferToDate" }],
      },
    ],
  });
});

test("no-plain-boundary-math: AST-only mode still flags setHours(0,0,0,0)", () => {
  astOnlyTester.run("no-plain-boundary-math", noPlainBoundaryMath, {
    valid: [
      `import { startOfDay } from 'date-fns'; const x = startOfDay(new Date());`,
    ],
    invalid: [
      {
        code: `const d = new Date(); d.setHours(0, 0, 0, 0);`,
        output: `import { startOfDay } from 'date-fns';\nconst d = new Date(); startOfDay(d);`,
        errors: [{ messageId: "useStartOfDay" }],
      },
    ],
  });
});
