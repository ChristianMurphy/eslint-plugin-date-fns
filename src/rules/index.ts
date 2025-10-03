import noDateConstructorString from "./no-date-constructor-string/index.js";
import preferDateFnsFromEpoch from "./prefer-date-fns-from-epoch/index.js";
import preferIsoLiteralOverComponents from "./prefer-iso-literal-over-components/index.js";
import noDateCoercionLiterals from "./no-date-coercion-literals/index.js";
import noBareDateCall from "./no-bare-date-call/index.js";
import noLegacyYearComponents from "./no-legacy-year-components/index.js";
import requireIsvalidAfterParse from "./require-isvalid-after-parse/index.js";
import noMagicTime from "./no-magic-time/index.js";
import noDateMutation from "./no-date-mutation/index.js";

/**
 * Registry of all available ESLint rules provided by this plugin.
 */
export default {
  "no-date-constructor-string": noDateConstructorString,
  "prefer-date-fns-from-epoch": preferDateFnsFromEpoch,
  "prefer-iso-literal-over-components": preferIsoLiteralOverComponents,
  "no-date-coercion-literals": noDateCoercionLiterals,
  "no-bare-date-call": noBareDateCall,
  "no-legacy-year-components": noLegacyYearComponents,
  "require-isvalid-after-parse": requireIsvalidAfterParse,
  "no-magic-time": noMagicTime,
  "no-date-mutation": noDateMutation,
};
