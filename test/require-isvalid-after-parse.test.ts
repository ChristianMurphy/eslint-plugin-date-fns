import test from "node:test";
import { tester } from "./_setup.ts";
import rule from "../dist/rules/require-isvalid-after-parse/index.js";

// Test cases for require-isvalid-after-parse rule
// Tests enforcement of isValid() checks after parse/parseISO before date usage
test("require-isvalid-after-parse", () => {
  tester.run("require-isvalid-after-parse", rule, {
    valid: [
      // ✅ Basic validation patterns - Early return guard
      `
import { parseISO, isValid } from 'date-fns';
function f(s: string) {
  const d = parseISO(s);
  if (!isValid(d)) return null;
  return d;
}
`,

      // ✅ Throw error guard
      `
import { parseISO, isValid } from 'date-fns';
function parseDate(s: string) {
  const d = parseISO(s);
  if (!isValid(d)) throw new Error('Invalid date');
  return d;
}
`,

      // ✅ Ternary conditional validation
      `
import { parseISO, isValid } from 'date-fns';
function getDate(s: string) {
  const d = parseISO(s);
  return isValid(d) ? d : null;
}
`,

      // ✅ Assignment validation pattern
      `
import { parseISO, isValid } from 'date-fns';
function processDate(s: string) {
  const d = parseISO(s);
  const valid = isValid(d);
  if (!valid) return null;
  return d;
}
`,

      // ✅ Inline validation with console.log
      `
import { parseISO, isValid } from 'date-fns';
function quickValidate(s: string) {
  const d = parseISO(s);
  console.log(isValid(d) ? 'Valid' : 'Invalid');
}
`,

      // ✅ Exception handling pattern
      `
import { parseISO, isValid } from 'date-fns';
function handleWithTryCatch(input: string) {
  try {
    const d = parseISO(input);
    if (!isValid(d)) throw new Error('Invalid');
    return d.getTime();
  } catch (e) {
    console.error(e);
    return null;
  }
}
`,

      // ✅ Logging validation pattern
      `
import { parseISO, isValid } from 'date-fns';
function logAndValidate(s: string) {
  const d = parseISO(s);
  if (!isValid(d)) {
    console.warn('Invalid date:', s);
    return;
  }
  console.log('Valid date:', d);
}
`,

      // ✅ Multiple validation checks
      `
import { parseISO, isValid } from 'date-fns';
function multiCheck(s1: string, s2: string) {
  const d1 = parseISO(s1);
  const d2 = parseISO(s2);
  if (!isValid(d1) || !isValid(d2)) return null;
  return [d1, d2];
}
`,

      // ✅ Nested scope validation
      `
import { parseISO, isValid } from 'date-fns';
function outer(s: string) {
  function inner() {
    const d = parseISO(s);
    if (!isValid(d)) return null;
    return d;
  }
  return inner();
}
`,

      // ✅ Class method validation
      `
import { parseISO, isValid } from 'date-fns';
class DateProcessor {
  process(s: string) {
    const d = parseISO(s);
    if (!isValid(d)) throw new Error('Invalid');
    return this.format(d);
  }
  format(d: Date) { return d.toString(); }
}
`,

      // ✅ Loop with validation
      `
import { parseISO, isValid } from 'date-fns';
function processDates(strings: string[]) {
  const results = [];
  for (const s of strings) {
    const d = parseISO(s);
    if (isValid(d)) results.push(d);
  }
  return results;
}
`,

      // ✅ Parse function (not parseISO)
      `
import { parse, isValid } from 'date-fns';
function parseCustom(s: string, format: string) {
  const d = parse(s, format, new Date());
  if (!isValid(d)) return null;
  return d;
}
`,

      // ✅ Non-parse functions should be ignored
      `
import { addDays, isValid } from 'date-fns';
function addTime(d: Date) {
  const result = addDays(d, 1);
  return result;
}
`,

      // ✅ Boolean return validation
      `
import { parseISO, isValid } from 'date-fns';
function checkValid(s: string): boolean {
  const d = parseISO(s);
  return isValid(d);
}
`,

      // ✅ Complex logical validation
      `
import { parseISO, isValid } from 'date-fns';
function complexValidation(s: string, required: boolean) {
  const d = parseISO(s);
  if (required && !isValid(d)) {
    throw new Error('Required date is invalid');
  }
  return isValid(d) ? d : new Date();
}
`,

      // ✅ Unknown type validation (proper handling)
      `
import { parseISO, isValid } from 'date-fns';
function handleUnknown(input: unknown) {
  if (typeof input !== 'string') return null;
  const d = parseISO(input);
  if (!isValid(d)) return null;
  return d;
}
`,

      // ✅ Any type validation (proper handling)
      `
import { parseISO, isValid } from 'date-fns';
function handleAny(input: any) {
  if (typeof input !== 'string') return null;
  const d = parseISO(input);
  if (!isValid(d)) return null;
  return d;
}
`,

      // ✅ Unknown variable validation
      `
import { parseISO, isValid } from 'date-fns';
declare const unknownInput: unknown;
function processUnknown() {
  if (typeof unknownInput !== 'string') return;
  const d = parseISO(unknownInput);
  if (!isValid(d)) return null;
  return d;
}
`,

      // ✅ Any variable validation
      `
import { parseISO, isValid } from 'date-fns';
declare const anyInput: any;
function processAny() {
  if (typeof anyInput !== 'string') return;
  const d = parseISO(anyInput);
  if (!isValid(d)) return null;
  return d;
}
`,
    ],

    invalid: [
      // ❌ Basic invalid - direct return without validation
      {
        code: `
import { parseISO } from 'date-fns';
function f(s: string) {
  const d = parseISO(s);
  return d;
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function f(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return d;
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Method call on unvalidated date
      {
        code: `
import { parseISO } from 'date-fns';
function getTime(s: string) {
  const d = parseISO(s);
  return d.getTime();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function getTime(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return d.getTime();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Assignment without validation
      {
        code: `
import { parseISO } from 'date-fns';
function store(s: string) {
  const d = parseISO(s);
  const timestamp = d;
  return timestamp;
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function store(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  const timestamp = d;
  return timestamp;
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Object property assignment
      {
        code: `
import { parseISO } from 'date-fns';
function createObj(s: string) {
  const d = parseISO(s);
  return { date: d, valid: true };
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function createObj(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return { date: d, valid: true };
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Array usage
      {
        code: `
import { parseISO } from 'date-fns';
function addToArray(s: string, arr: Date[]) {
  const d = parseISO(s);
  arr.push(d);
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function addToArray(s: string, arr: Date[]) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  arr.push(d);
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Function parameter usage
      {
        code: `
import { parseISO, format } from 'date-fns';
function formatDate(s: string) {
  const d = parseISO(s);
  return format(d, 'yyyy-MM-dd');
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO, format } from 'date-fns';
import { isValid } from 'date-fns';
function formatDate(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return format(d, 'yyyy-MM-dd');
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Conditional usage without validation
      {
        code: `
import { parseISO } from 'date-fns';
function conditionalUse(s: string, useDate: boolean) {
  const d = parseISO(s);
  return useDate ? d : null;
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function conditionalUse(s: string, useDate: boolean) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return useDate ? d : null;
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Parse function misuse
      {
        code: `
import { parse } from 'date-fns';
function parseWithFormat(s: string) {
  const d = parse(s, 'yyyy-MM-dd', new Date());
  return d.getFullYear();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parse } from 'date-fns';
import { isValid } from 'date-fns';
function parseWithFormat(s: string) {
  const d = parse(s, 'yyyy-MM-dd', new Date());
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return d.getFullYear();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Multiple usage without validation
      {
        code: `
import { parseISO } from 'date-fns';
function multiUse(s: string) {
  const d = parseISO(s);
  console.log(d);
  return d.toString();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function multiUse(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  console.log(d);
  return d.toString();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Loop usage without validation
      {
        code: `
import { parseISO } from 'date-fns';
function processInLoop(strings: string[]) {
  for (const s of strings) {
    const d = parseISO(s);
    console.log(d.getTime());
  }
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function processInLoop(strings: string[]) {
  for (const s of strings) {
    const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

    console.log(d.getTime());
  }
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Class method without validation
      {
        code: `
import { parseISO } from 'date-fns';
class Processor {
  handle(s: string) {
    const d = parseISO(s);
    return this.process(d);
  }
  process(d: Date) { return d; }
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
class Processor {
  handle(s: string) {
    const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

    return this.process(d);
  }
  process(d: Date) { return d; }
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Nested scope violation
      {
        code: `
import { parseISO } from 'date-fns';
function outer(s: string) {
  const d = parseISO(s);
  function inner() {
    return d.getTime();
  }
  return inner();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function outer(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  function inner() {
    return d.getTime();
  }
  return inner();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Mixed good and bad functions
      {
        code: `
import { parseISO, isValid } from 'date-fns';
function good(s: string) {
  const d = parseISO(s);
  if (!isValid(d)) return null;
  return d;
}
function bad(s: string) {
  const d = parseISO(s);
  return d.toString();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO, isValid } from 'date-fns';
function good(s: string) {
  const d = parseISO(s);
  if (!isValid(d)) return null;
  return d;
}
function bad(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return d.toString();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Complex expression without validation
      {
        code: `
import { parseISO } from 'date-fns';
function complex(s: string, flag: boolean) {
  const d = parseISO(s);
  return flag ? d.getTime() : null;
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function complex(s: string, flag: boolean) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return flag ? d.getTime() : null;
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Destructuring usage
      {
        code: `
import { parseISO } from 'date-fns';
function destructure(s: string) {
  const d = parseISO(s);
  const { constructor } = d;
  return constructor;
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function destructure(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  const { constructor } = d;
  return constructor;
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Early usage before potential guard
      {
        code: `
import { parseISO, isValid } from 'date-fns';
function earlyUse(s: string) {
  const d = parseISO(s);
  console.log(d.toString());
  if (!isValid(d)) return null;
  return d;
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO, isValid } from 'date-fns';
function earlyUse(s: string) {
  const d = parseISO(s);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  console.log(d.toString());
  if (!isValid(d)) return null;
  return d;
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Multiple violations in same function
      {
        code: `
import { parseISO } from 'date-fns';
function multipleViolations(s1: string, s2: string) {
  const d1 = parseISO(s1);
  const d2 = parseISO(s2);
  return d1.getTime() + d2.getTime();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function multipleViolations(s1: string, s2: string) {
  const d1 = parseISO(s1);
if (!isValid(d1)) {
  // TODO: handle invalid date
}

  const d2 = parseISO(s2);
  return d1.getTime() + d2.getTime();
}
`,
              },
            ],
          },
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function multipleViolations(s1: string, s2: string) {
  const d1 = parseISO(s1);
  const d2 = parseISO(s2);
if (!isValid(d2)) {
  // TODO: handle invalid date
}

  return d1.getTime() + d2.getTime();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Unknown type - no validation before usage
      {
        code: `
import { parseISO } from 'date-fns';
function handleUnknown(input: unknown) {
  const d = parseISO(input as string);
  return d.getTime();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function handleUnknown(input: unknown) {
  const d = parseISO(input as string);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return d.getTime();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Any type - no validation before usage
      {
        code: `
import { parseISO } from 'date-fns';
function handleAny(input: any) {
  const d = parseISO(input);
  return d.toString();
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
function handleAny(input: any) {
  const d = parseISO(input);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return d.toString();
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Unknown variable - no validation
      {
        code: `
import { parseISO } from 'date-fns';
declare const unknownValue: unknown;
function processUnknown() {
  const d = parseISO(unknownValue as string);
  return { timestamp: d.getTime() };
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
declare const unknownValue: unknown;
function processUnknown() {
  const d = parseISO(unknownValue as string);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return { timestamp: d.getTime() };
}
`,
              },
            ],
          },
        ],
      },

      // ❌ Any variable - no validation
      {
        code: `
import { parseISO } from 'date-fns';
declare const anyValue: any;
function processAny() {
  const d = parseISO(anyValue);
  return [d, 'parsed'];
}
`,
        errors: [
          {
            messageId: "requireIsValid",
            suggestions: [
              {
                messageId: "suggestGuard",
                output: `
import { parseISO } from 'date-fns';
import { isValid } from 'date-fns';
declare const anyValue: any;
function processAny() {
  const d = parseISO(anyValue);
if (!isValid(d)) {
  // TODO: handle invalid date
}

  return [d, 'parsed'];
}
`,
              },
            ],
          },
        ],
      },
    ],
  });
});
