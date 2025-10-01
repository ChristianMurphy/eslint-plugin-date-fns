import type { Linter } from "eslint";

/**
 * Diagnostic rule configuration that enables code quality and maintainability checks.
 * These rules help identify potential issues but may have false positives in some contexts.
 */
const diagnosticRules: Linter.RulesRecord = {
  "date-fns/no-magic-time": "warn",
};

export default diagnosticRules;
