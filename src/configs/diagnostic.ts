import type { Linter } from "eslint";

/**
 * Diagnostic rule configuration that enables code quality and maintainability checks.
 * These rules help identify potential issues but may have false positives in some contexts.
 */
const diagnosticRules: Linter.RulesRecord = {
  "date-fns/no-magic-time": "warn",
  "date-fns/prefer-difference-in-unit": "warn",
  "date-fns/no-date-in-string-interpolation": "warn",
  "date-fns/no-namespace-date-fns-import": "warn",
};

export default diagnosticRules;
