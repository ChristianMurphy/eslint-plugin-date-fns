import test from "node:test";
import { ESLintUtils } from "@typescript-eslint/utils";
import { tester } from "./_setup.ts";
import {
  getIdentifierHints,
  getCommentHints,
  IDENTIFIER_TIME_KEYWORDS,
  COMMENT_TIME_KEYWORDS,
  CONSTANT_NAME_PATTERN,
} from "../dist/rules/no-magic-time/hints.js";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/test/${name}.md`,
);

// Create a test rule that uses the hint utilities and reports their results
const testIdentifierHintsRule = createRule({
  name: "test-identifier-hints",
  meta: {
    type: "problem",
    docs: { description: "Test rule for identifier hints" },
    messages: {
      foundHints: "Found hints: {{hints}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Literal(node) {
        if (
          node.parent?.type === "VariableDeclarator" &&
          node.parent.id.type === "Identifier"
        ) {
          const hints = getIdentifierHints(node);
          if (hints.length > 0) {
            context.report({
              node,
              messageId: "foundHints",
              data: { hints: hints.join(", ") },
            });
          }
        }
      },
    };
  },
});

// Create a test rule that uses the comment hints utility
const testCommentHintsRule = createRule({
  name: "test-comment-hints",
  meta: {
    type: "problem",
    docs: { description: "Test rule for comment hints" },
    messages: {
      foundHints: "Found hints: {{hints}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Literal(node) {
        const hints = getCommentHints(node, context);
        if (hints.length > 0) {
          context.report({
            node,
            messageId: "foundHints",
            data: { hints: hints.join(", ") },
          });
        }
      },
    };
  },
});

// Test constants
test("hints constants", () => {
  // Validate IDENTIFIER_TIME_KEYWORDS
  if (!IDENTIFIER_TIME_KEYWORDS.includes("timeout")) {
    throw new Error("IDENTIFIER_TIME_KEYWORDS should include 'timeout'");
  }
  if (!IDENTIFIER_TIME_KEYWORDS.includes("delay")) {
    throw new Error("IDENTIFIER_TIME_KEYWORDS should include 'delay'");
  }
  if (!IDENTIFIER_TIME_KEYWORDS.includes("duration")) {
    throw new Error("IDENTIFIER_TIME_KEYWORDS should include 'duration'");
  }
  if (!IDENTIFIER_TIME_KEYWORDS.includes("ttl")) {
    throw new Error("IDENTIFIER_TIME_KEYWORDS should include 'ttl'");
  }
  if (IDENTIFIER_TIME_KEYWORDS.length < 18) {
    throw new Error(
      "IDENTIFIER_TIME_KEYWORDS should have at least 18 keywords",
    );
  }

  // Validate COMMENT_TIME_KEYWORDS ordering (longest first)
  const msIndex = [...COMMENT_TIME_KEYWORDS].indexOf("ms");
  const millisecondsIndex = [...COMMENT_TIME_KEYWORDS].indexOf("milliseconds");
  if (millisecondsIndex >= msIndex) {
    throw new Error("COMMENT_TIME_KEYWORDS should be ordered longest-first");
  }

  // Validate CONSTANT_NAME_PATTERN
  if (!CONSTANT_NAME_PATTERN.test("TIMEOUT")) {
    throw new Error("CONSTANT_NAME_PATTERN should match 'TIMEOUT'");
  }
  if (!CONSTANT_NAME_PATTERN.test("REQUEST_TIMEOUT_MS")) {
    throw new Error("CONSTANT_NAME_PATTERN should match 'REQUEST_TIMEOUT_MS'");
  }
  if (CONSTANT_NAME_PATTERN.test("timeout")) {
    throw new Error("CONSTANT_NAME_PATTERN should not match 'timeout'");
  }
  if (CONSTANT_NAME_PATTERN.test("requestTimeout")) {
    throw new Error("CONSTANT_NAME_PATTERN should not match 'requestTimeout'");
  }
});

// Test getIdentifierHints
test("getIdentifierHints", () => {
  tester.run("identifier-hints", testIdentifierHintsRule, {
    valid: [
      // Non-time identifiers should not trigger
      `const count = 5000;`,
      `const value = 10000;`,
      // ALL_CAPS constants should not trigger
      `const TIMEOUT = 5000;`,
      `const REQUEST_TIMEOUT = 10000;`,
    ],
    invalid: [
      // Simple time-related identifiers
      {
        code: `const timeout = 5000;`,
        errors: [{ messageId: "foundHints", data: { hints: "timeout, time" } }],
      },
      {
        code: `const delay = 1000;`,
        errors: [{ messageId: "foundHints", data: { hints: "delay" } }],
      },
      {
        code: `const ttl = 60000;`,
        errors: [{ messageId: "foundHints", data: { hints: "ttl" } }],
      },
      // Snake_case identifiers
      {
        code: `const retry_delay = 5000;`,
        errors: [{ messageId: "foundHints", data: { hints: "delay" } }],
      },
      // Compound identifiers
      {
        code: `const expiry_time = 3600000;`,
        errors: [{ messageId: "foundHints", data: { hints: "expiry, time" } }],
      },
      // CamelCase identifiers
      {
        code: `const requestTimeout = 30000;`,
        errors: [{ messageId: "foundHints", data: { hints: "timeout, time" } }],
      },
    ],
  });
});

// Test getCommentHints
test("getCommentHints", () => {
  tester.run("comment-hints", testCommentHintsRule, {
    valid: [
      // No comments
      `const x = 5000;`,
      // Comments without time keywords
      `const x = 5000; // just a comment`,
      // Comments on different lines
      `const x = 5000;\n// 5 seconds`,
    ],
    invalid: [
      // Inline comments with time units
      {
        code: `const x = 5000; // 5 seconds`,
        errors: [{ messageId: "foundHints", data: { hints: "seconds" } }],
      },
      {
        code: `const x = 60000; // 1 minute`,
        errors: [{ messageId: "foundHints", data: { hints: "minute" } }],
      },
      {
        code: `const x = 3600000; // 1 hour`,
        errors: [{ messageId: "foundHints", data: { hints: "hour" } }],
      },
      // Abbreviated time units
      {
        code: `const x = 5000; // 5 sec`,
        errors: [{ messageId: "foundHints", data: { hints: "sec" } }],
      },
      {
        code: `const x = 1000; // 1 ms`,
        errors: [{ messageId: "foundHints", data: { hints: "ms" } }],
      },
      // Block comments
      {
        code: `const x = 10000; /* 10 seconds */`,
        errors: [{ messageId: "foundHints", data: { hints: "seconds" } }],
      },
      // Case insensitive
      {
        code: `const x = 5000; // 5 SECONDS`,
        errors: [{ messageId: "foundHints", data: { hints: "seconds" } }],
      },
      // Multiple time keywords in one comment
      // Note: Order matches position in comment (left to right)
      {
        code: `const x = 90000; // 1 minute 30 seconds`,
        errors: [
          { messageId: "foundHints", data: { hints: "minute, seconds" } },
        ],
      },
      {
        code: `const x = 3660000; // 1 hour and 1 minute`,
        errors: [{ messageId: "foundHints", data: { hints: "hour, minute" } }],
      },
      {
        code: `const x = 86400000; // 1 day (24 hours)`,
        errors: [{ messageId: "foundHints", data: { hints: "day, hours" } }],
      },
      // Multiple occurrences of same keyword should only count once
      {
        code: `const x = 5000; // 5 seconds or 5000 milliseconds`,
        errors: [
          {
            messageId: "foundHints",
            data: { hints: "seconds, milliseconds" },
          },
        ],
      },
      // Time with ms suffix
      {
        code: `const x = 5000; // 5000ms timeout`,
        errors: [{ messageId: "foundHints", data: { hints: "ms" } }],
      },
    ],
  });
});
