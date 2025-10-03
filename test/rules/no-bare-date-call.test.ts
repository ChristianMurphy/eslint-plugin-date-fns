import test from "node:test";
import { tester } from "../_setup.ts";
import rule from "../../dist/rules/no-bare-date-call/index.js";

// Test cases for no-bare-date-call rule
// Focuses on preventing Date() string coercion and suggesting format() alternatives
test("no-bare-date-call", () => {
  tester.run("no-bare-date-call", rule, {
    valid: [
      // ✅ Already using date-fns formatting
      `import { format } from 'date-fns'; const s = format(new Date(), 'yyyy-MM-dd');`,
      `import { formatISO } from 'date-fns'; const s = formatISO(new Date());`,
      `import { format, addDays } from 'date-fns'; const s = format(addDays(new Date(), 1), 'yyyy-MM-dd');`,

      // ✅ Constructor usage (different rule scope)
      `const d = new Date();`,
      `const d = new Date('2024-01-01');`,
      `const d = new Date(2024, 0, 1);`,
      `const d = new Date(Date.now());`,

      // ✅ Date.parse, Date.now, Date.UTC (static methods, not bare calls)
      `const timestamp = Date.now();`,
      `const parsed = Date.parse('2024-01-01');`,
      `const utc = Date.UTC(2024, 0, 1);`,

      // ✅ globalThis.Date static methods
      `const timestamp = globalThis.Date.now();`,
      `const parsed = globalThis.Date.parse('2024-01-01');`,
      `const utc = globalThis.Date.UTC(2024, 0, 1);`,

      // ✅ Date shadowing scenarios - custom Date class/function
      `class Date { toString() { return 'custom'; } } const s = Date();`,
      `function Date() { return 'custom date'; } const s = Date();`,
      `function f(Date: any) { const s = Date(); }`,
      `import Date from 'custom-date'; const s = Date();`,
      `import { Date as CustomDate } from 'custom-date'; const s = CustomDate();`,

      // ✅ Date as variable or parameter
      `const Date = () => 'custom'; const s = Date();`,
      `let Date = class { toString() { return 'test'; } }; const s = new Date().toString();`,

      // ✅ Unknown/any variables that shadow Date
      `declare const unknownDate: unknown; const s = (unknownDate as any)();`,
      `const anyFunc: any = getFunction(); const s = anyFunc();`,

      // ✅ Non-Date function calls
      `const result = someFunction();`,
      `const data = getData();`,
      `const formatted = formatValue();`,
    ],

    invalid: [
      // ❌ Basic bare Date() call
      {
        code: `const s = Date();`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst s = format(new Date(), 'yyyy-MM-dd');`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in various contexts
      {
        code: `const timestamp = Date();`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst timestamp = format(new Date(), 'yyyy-MM-dd');`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in expressions
      {
        code: `const result = 'Today is ' + Date();`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst result = 'Today is ' + format(new Date(), 'yyyy-MM-dd');`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() as function arguments
      {
        code: `console.log(Date());`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconsole.log(format(new Date(), 'yyyy-MM-dd'));`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in return statements
      {
        code: `function getCurrentDate() { return Date(); }`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nfunction getCurrentDate() { return format(new Date(), 'yyyy-MM-dd'); }`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in object literals
      {
        code: `const obj = { timestamp: Date() };`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst obj = { timestamp: format(new Date(), 'yyyy-MM-dd') };`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in arrays
      {
        code: `const logs = [Date(), 'event occurred'];`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst logs = [format(new Date(), 'yyyy-MM-dd'), 'event occurred'];`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() with existing date-fns imports
      {
        code: `import { addDays } from 'date-fns'; const s = Date();`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { addDays, format } from 'date-fns'; const s = format(new Date(), 'yyyy-MM-dd');`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() with existing format import (should not duplicate)
      {
        code: `import { format } from 'date-fns'; const s = Date();`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns'; const s = format(new Date(), 'yyyy-MM-dd');`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in conditional expressions
      {
        code: `const result = condition ? Date() : 'unknown';`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst result = condition ? format(new Date(), 'yyyy-MM-dd') : 'unknown';`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in template literals
      {
        code: `const message = \`Current time: \${Date()}\`;`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst message = \`Current time: \${format(new Date(), 'yyyy-MM-dd')}\`;`,
              },
            ],
          },
        ],
      },

      // ❌ Multiple bare Date() calls
      {
        code: `const start = Date(); const end = Date();`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst start = format(new Date(), 'yyyy-MM-dd'); const end = Date();`,
              },
            ],
          },
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst start = Date(); const end = format(new Date(), 'yyyy-MM-dd');`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in class methods
      {
        code: `class Logger { log() { return Date(); } }`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nclass Logger { log() { return format(new Date(), 'yyyy-MM-dd'); } }`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in nested scopes
      {
        code: `function outer() { function inner() { return Date(); } }`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nfunction outer() { function inner() { return format(new Date(), 'yyyy-MM-dd'); } }`,
              },
            ],
          },
        ],
      },

      // ❌ Bare Date() in arrow functions
      {
        code: `const getDate = () => Date();`,
        errors: [
          {
            messageId: "noBareDate",
            suggestions: [
              {
                messageId: "suggestFormat",
                output: `import { format } from 'date-fns';\nconst getDate = () => format(new Date(), 'yyyy-MM-dd');`,
              },
            ],
          },
        ],
      },
    ],
  });
});
