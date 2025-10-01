import rules from "./rules/index.js";
import recommendedRules from "./configs/recommended.js";
import diagnosticRules from "./configs/diagnostic.js";
import package_ from "../package.json" with { type: "json" };

/**
 * ESLint plugin for date-fns that provides rules to enforce safe date handling patterns.
 */
const plugin = {
  meta: {
    name: package_.name,
    version: package_.version,
    namespace: "date-fns",
  },
  rules,
  configs: {},
};

plugin.configs = {
  recommended: {
    plugins: { "date-fns": plugin },
    rules: recommendedRules,
  },
  diagnostic: {
    plugins: { "date-fns": plugin },
    rules: diagnosticRules,
  },
};

export default plugin;
