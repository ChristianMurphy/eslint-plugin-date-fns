import test from "node:test";
import { ESLintUtils } from "@typescript-eslint/utils";
import { tester } from "../_setup.ts";
import {
  isNewDateSyntax,
  isDateShadowed,
  isBareGlobalDateCall,
} from "../../dist/utils/date-call.js";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/test/${name}.md`,
);

// ============================================================================
// Test rule for isNewDateSyntax
// ============================================================================
const testIsNewDateSyntaxRule = createRule({
  name: "test-is-new-date-syntax",
  meta: {
    type: "problem",
    docs: { description: "Test rule for isNewDateSyntax" },
    messages: {
      isDateConstructor: "This is a Date constructor",
      notDateConstructor: "This is not a Date constructor",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node) {
        const result = isNewDateSyntax(node);
        context.report({
          node,
          messageId: result ? "isDateConstructor" : "notDateConstructor",
        });
      },
    };
  },
});

// ============================================================================
// Test rule for isDateShadowed
// ============================================================================
const testIsDateShadowedRule = createRule({
  name: "test-is-date-shadowed",
  meta: {
    type: "problem",
    docs: { description: "Test rule for isDateShadowed" },
    messages: {
      shadowed: "Date is shadowed",
      notShadowed: "Date is not shadowed",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node) {
        const result = isDateShadowed(context, node);
        context.report({
          node,
          messageId: result ? "shadowed" : "notShadowed",
        });
      },
    };
  },
});

// ============================================================================
// Test rule for isBareGlobalDateCall
// ============================================================================
const testIsBareGlobalDateCallRule = createRule({
  name: "test-is-bare-global-date-call",
  meta: {
    type: "problem",
    docs: { description: "Test rule for isBareGlobalDateCall" },
    messages: {
      bareGlobal: "This is a bare global Date call",
      notBareGlobal: "This is not a bare global Date call",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const result = isBareGlobalDateCall(context, node);
        context.report({
          node,
          messageId: result ? "bareGlobal" : "notBareGlobal",
        });
      },
    };
  },
});

// ============================================================================
// TESTS: isNewDateSyntax
// ============================================================================
test("isNewDateSyntax: recognizes Date constructors", () => {
  tester.run("is-new-date-syntax", testIsNewDateSyntaxRule, {
    valid: [],
    invalid: [
      // Basic Date constructor
      {
        code: `new Date();`,
        errors: [{ messageId: "isDateConstructor" }],
      },
      {
        code: `new Date(2024, 0, 1);`,
        errors: [{ messageId: "isDateConstructor" }],
      },
      {
        code: `new Date("2024-01-01");`,
        errors: [{ messageId: "isDateConstructor" }],
      },
      // globalThis.Date (cannot be shadowed)
      {
        code: `new globalThis.Date();`,
        errors: [{ messageId: "isDateConstructor" }],
      },
      {
        code: `new globalThis.Date(2024, 0, 1);`,
        errors: [{ messageId: "isDateConstructor" }],
      },
      // Computed property: globalThis['Date']
      {
        code: `new globalThis['Date']();`,
        errors: [{ messageId: "isDateConstructor" }],
      },
      {
        code: `new globalThis["Date"]();`,
        errors: [{ messageId: "isDateConstructor" }],
      },
    ],
  });
});

test("isNewDateSyntax: rejects non-Date constructors", () => {
  tester.run("is-new-date-syntax-negative", testIsNewDateSyntaxRule, {
    valid: [],
    invalid: [
      // Other constructors
      {
        code: `new Array();`,
        errors: [{ messageId: "notDateConstructor" }],
      },
      {
        code: `new Object();`,
        errors: [{ messageId: "notDateConstructor" }],
      },
      {
        code: `new MyClass();`,
        errors: [{ messageId: "notDateConstructor" }],
      },
      // Member expression but not globalThis.Date
      {
        code: `new myObj.Date();`,
        errors: [{ messageId: "notDateConstructor" }],
      },
      {
        code: `new window.Date();`,
        errors: [{ messageId: "notDateConstructor" }],
      },
      // Computed property with non-Date value
      {
        code: `new globalThis['Array']();`,
        errors: [{ messageId: "notDateConstructor" }],
      },
    ],
  });
});

test("isNewDateSyntax: fast path checks", () => {
  // Verify that simple identifier check happens first (performance)
  tester.run("is-new-date-syntax-fast-path", testIsNewDateSyntaxRule, {
    valid: [],
    invalid: [
      // Should quickly identify Date identifier
      {
        code: `new Date();`,
        errors: [{ messageId: "isDateConstructor" }],
      },
      // Should quickly reject non-Date identifier
      {
        code: `new Array();`,
        errors: [{ messageId: "notDateConstructor" }],
      },
      // Should handle globalThis.Date
      {
        code: `new globalThis.Date();`,
        errors: [{ messageId: "isDateConstructor" }],
      },
    ],
  });
});

// ============================================================================
// TESTS: isDateShadowed
// ============================================================================
test("isDateShadowed: detects shadowing in various scopes", () => {
  tester.run("is-date-shadowed-scopes", testIsDateShadowedRule, {
    valid: [],
    invalid: [
      // Block scope shadowing
      {
        code: `{ const Date = class {}; new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `{ let Date = class {}; new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `{ var Date = class {}; new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
      // Function scope shadowing
      {
        code: `function test() { const Date = class {}; new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `const test = function() { const Date = class {}; new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `const test = () => { const Date = class {}; new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
      // Function parameter shadowing
      {
        code: `function test(Date) { new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `const test = (Date) => new Date();`,
        errors: [{ messageId: "shadowed" }],
      },
      // Class scope shadowing
      {
        code: `class Test { method() { const Date = class {}; new Date(); } }`,
        errors: [{ messageId: "shadowed" }],
      },
      // Nested scope shadowing
      {
        code: `function outer() { const Date = class {}; function inner() { new Date(); } }`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `{ const Date = class {}; { new Date(); } }`,
        errors: [{ messageId: "shadowed" }],
      },
      // Import shadowing
      {
        code: `import { Date } from './my-date'; new Date();`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `import Date from './my-date'; new Date();`,
        errors: [{ messageId: "shadowed" }],
      },
      {
        code: `import * as Date from './my-date'; new Date();`,
        errors: [{ messageId: "shadowed" }],
      },
      // Catch clause parameter shadowing
      {
        code: `try {} catch (Date) { new Date(); }`,
        errors: [{ messageId: "shadowed" }],
      },
    ],
  });
});

test("isDateShadowed: type-only imports", () => {
  tester.run("is-date-shadowed-type-imports", testIsDateShadowedRule, {
    valid: [],
    invalid: [
      // Type-only imports should still be detected by scope analysis
      // (behavior depends on how TypeScript/parser handles type imports)
      {
        code: `import type { Date } from './types'; new Date();`,
        errors: [{ messageId: "shadowed" }],
      },
    ],
  });
});

test("isDateShadowed: globalThis.Date cannot be shadowed", () => {
  tester.run("is-date-shadowed-globalthis", testIsDateShadowedRule, {
    valid: [],
    invalid: [
      // globalThis.Date is never shadowed (fast-path check)
      {
        code: `const Date = class {}; new globalThis.Date();`,
        errors: [{ messageId: "notShadowed" }],
      },
      {
        code: `function test(Date) { new globalThis.Date(); }`,
        errors: [{ messageId: "notShadowed" }],
      },
      {
        code: `{ const Date = class {}; new globalThis.Date(); }`,
        errors: [{ messageId: "notShadowed" }],
      },
      {
        code: `{ const Date = class {}; new globalThis['Date'](); }`,
        errors: [{ messageId: "notShadowed" }],
      },
    ],
  });
});

test("isDateShadowed: not shadowed cases", () => {
  tester.run("is-date-shadowed-not-shadowed", testIsDateShadowedRule, {
    valid: [],
    invalid: [
      // Global Date without shadowing
      {
        code: `new Date();`,
        errors: [{ messageId: "notShadowed" }],
      },
      {
        code: `function test() { new Date(); }`,
        errors: [{ messageId: "notShadowed" }],
      },
      {
        code: `{ new Date(); }`,
        errors: [{ messageId: "notShadowed" }],
      },
      // Shadowing in different scope (not affecting this usage)
      {
        code: `function outer() { new Date(); } function other() { const Date = class {}; }`,
        errors: [{ messageId: "notShadowed" }],
      },
      // Shadowing declared after usage (hoisting matters for var)
      {
        code: `new Date(); var Date;`,
        errors: [{ messageId: "shadowed" }], // var hoists
      },
    ],
  });
});

test("isDateShadowed: with statement", () => {
  // With statements can shadow variables (legacy feature)
  tester.run("is-date-shadowed-with", testIsDateShadowedRule, {
    valid: [],
    invalid: [
      // With statement shadowing (if not in strict mode)
      {
        code: `with ({ Date: class {} }) { new Date(); }`,
        errors: [{ messageId: "notShadowed" }], // scope analysis doesn't track 'with' contents
      },
    ],
  });
});

test("isDateShadowed: rejects non-Date constructors", () => {
  tester.run("is-date-shadowed-non-date", testIsDateShadowedRule, {
    valid: [],
    invalid: [
      // Should not report for non-Date constructors
      {
        code: `const Date = class {}; new Array();`,
        errors: [{ messageId: "notShadowed" }],
      },
      {
        code: `new MyClass();`,
        errors: [{ messageId: "notShadowed" }],
      },
    ],
  });
});

// ============================================================================
// TESTS: isBareGlobalDateCall
// ============================================================================
test("isBareGlobalDateCall: recognizes bare Date calls", () => {
  tester.run("is-bare-global-date-call", testIsBareGlobalDateCallRule, {
    valid: [],
    invalid: [
      // Bare Date() calls
      {
        code: `Date();`,
        errors: [{ messageId: "bareGlobal" }],
      },
      {
        code: `const str = Date();`,
        errors: [{ messageId: "bareGlobal" }],
      },
      {
        code: `console.log(Date());`,
        errors: [
          { messageId: "notBareGlobal" }, // console.log() call
          { messageId: "bareGlobal" }, // Date() call
        ],
      },
    ],
  });
});

test("isBareGlobalDateCall: detects shadowed Date calls", () => {
  tester.run(
    "is-bare-global-date-call-shadowed",
    testIsBareGlobalDateCallRule,
    {
      valid: [],
      invalid: [
        // Shadowed Date() should NOT be bare global
        {
          code: `const Date = () => 'custom'; Date();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        {
          code: `function test(Date) { Date(); }`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        {
          code: `{ const Date = () => {}; Date(); }`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        {
          code: `import { Date } from './my-date'; Date();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        // Catch parameter
        {
          code: `try {} catch (Date) { Date(); }`,
          errors: [{ messageId: "notBareGlobal" }],
        },
      ],
    },
  );
});

test("isBareGlobalDateCall: rejects non-Date calls", () => {
  tester.run(
    "is-bare-global-date-call-non-date",
    testIsBareGlobalDateCallRule,
    {
      valid: [],
      invalid: [
        // Other function calls
        {
          code: `Array();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        {
          code: `myFunction();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        // Member expression calls (not bare)
        {
          code: `globalThis.Date();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        {
          code: `window.Date();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        {
          code: `obj.Date();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        // Computed property
        {
          code: `globalThis['Date']();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
      ],
    },
  );
});

test("isBareGlobalDateCall: not shadowed in different scope", () => {
  tester.run(
    "is-bare-global-date-call-different-scope",
    testIsBareGlobalDateCallRule,
    {
      valid: [],
      invalid: [
        // Date() in global scope, shadowing in other scope (declaration doesn't create CallExpression)
        {
          code: `Date(); function test() { const Date = () => {}; }`,
          errors: [{ messageId: "bareGlobal" }],
        },
        {
          code: `function outer() { Date(); } function other() { const Date = () => {}; Date(); }`,
          errors: [{ messageId: "bareGlobal" }, { messageId: "notBareGlobal" }],
        },
      ],
    },
  );
});

test("isBareGlobalDateCall: fast path checks", () => {
  // Verify identifier check happens first
  tester.run(
    "is-bare-global-date-call-fast-path",
    testIsBareGlobalDateCallRule,
    {
      valid: [],
      invalid: [
        // Should quickly identify Date identifier
        {
          code: `Date();`,
          errors: [{ messageId: "bareGlobal" }],
        },
        // Should quickly reject non-Date identifier
        {
          code: `Array();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
        // Should quickly reject member expressions
        {
          code: `obj.Date();`,
          errors: [{ messageId: "notBareGlobal" }],
        },
      ],
    },
  );
});

test("isBareGlobalDateCall: complex expressions", () => {
  tester.run("is-bare-global-date-call-complex", testIsBareGlobalDateCallRule, {
    valid: [],
    invalid: [
      // Optional chaining - still detected as bare global (function only checks callee.name)
      {
        code: `Date?.();`,
        errors: [{ messageId: "bareGlobal" }],
      },
      // Tagged template (not a call expression in the traditional sense)
      // Note: Tagged templates are TemplateLiteral nodes, not CallExpression
      // So they won't be checked by this function anyway
    ],
  });
});
