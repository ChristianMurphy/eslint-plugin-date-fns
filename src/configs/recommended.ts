import type { Linter } from "eslint";

/**
 * Recommended rule configuration that enables core date-fns rules as errors.
 * These rules prevent common date handling bugs and enforce safe patterns.
 */
const recommendedRules: Linter.RulesRecord = {
  "date-fns/no-date-constructor-string": "error",
  "date-fns/prefer-date-fns-from-epoch": "error",
  "date-fns/prefer-iso-literal-over-components": "error",
  "date-fns/no-date-coercion-literals": "error",
  "date-fns/no-bare-date-call": "error",
  "date-fns/no-legacy-year-components": "error",
  "date-fns/require-isvalid-after-parse": "error",
  "date-fns/no-date-mutation": "error",
  "date-fns/no-plain-boundary-math": "error",
};

export default recommendedRules;
