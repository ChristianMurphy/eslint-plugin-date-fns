# no-date-constructor-string

Disallow string-based Date construction and parsing. Use date-fns functions instead.

🔧 Fixable
💡 Provides suggestions

## Rule Details

This rule disallows using strings with the Date constructor and Date.parse(). These native JavaScript functions are hard to read and historically inconsistent across different environments and browsers. Using date-fns functions like `parseISO()` and `parse()` makes intent explicit and provides consistent behavior.

### Incorrect

```js
/*eslint date-fns/no-date-constructor-string: "error"*/

// String literals with Date constructor
const d1 = new Date("2024-10-11T00:00:00Z");
const d2 = new Date("10/11/2024");

// Date.parse with strings  
const timestamp = Date.parse("2024-01-01");
const parsed = Date.parse(dateString);

// Variables containing strings
declare const someString: string;
const d3 = new Date(someString);

// globalThis.Date patterns
const d4 = new globalThis.Date("2024-01-01");
```

### Correct

```js
/*eslint date-fns/no-date-constructor-string: "error"*/

import { parseISO, parse } from 'date-fns';

// Use parseISO for ISO strings
const d1 = parseISO("2024-10-11T00:00:00Z");

// Use parse for custom formats
const d2 = parse("10/11/2024", "MM/dd/yyyy", new Date());

// Non-string Date constructor usage
const now = new Date();
const epoch = new Date(0);
const components = new Date(2024, 0, 1);

// Unknown/any variables (not detected as strings)
declare const unknownValue: unknown;
const d3 = new Date(unknownValue as any);
```

## Autofix and Suggestions

This rule provides different behaviors depending on the input:

- For ISO string literals that parseISO can handle: automatically fixes to `parseISO(literal)` and adds the import
- For non-ISO string literals and string variables: provides suggestions for both `parseISO(value)` and `parse(value, format, referenceDate)`

## Options

```js
{
  "date-fns/no-date-constructor-string": ["error", {
    "formatPlaceholder": "yyyy-MM-dd",
    "refDateExpression": "new Date()"
  }]
}
```

- `formatPlaceholder`: Format token string to show in `parse(...)` suggestions. Default: `'yyyy-MM-dd'`
- `refDateExpression`: Expression to use as the reference date in `parse(...)` suggestions. Default: `new Date()`

## When Not To Use It

You might want to disable this rule when legacy fallbacks are needed or if your project uses a different date library instead of date-fns.

## Related Rules

- [no-bare-date-call](./no-bare-date-call.md) - Disallows calling Date() without new
- [require-isvalid-after-parse](./require-isvalid-after-parse.md) - Requires validation after parsing

## Version

This rule was introduced in eslint-plugin-date-fns v1.0.0.
