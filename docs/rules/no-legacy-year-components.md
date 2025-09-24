# no-legacy-year-components

Disallow Date constructor with legacy years (0-99). JavaScript treats these as 1900 + year.

💡 Provides suggestions

## Rule Details

This rule disallows using the Date constructor with year values between 0 and 99. JavaScript automatically adds 1900 to these values, so `new Date(42, 0, 1)` creates January 1, 1942, not year 42. This behavior is a legacy quirk that can cause confusion and bugs.

### Incorrect

```js
/*eslint date-fns/no-legacy-year-components: "error"*/

// These become 1900 + year
const d1 = new Date(42, 0, 1);      // becomes 1942-01-01
const d2 = new Date(99, 11, 31);    // becomes 1999-12-31
const d3 = new Date(0, 5, 15);      // becomes 1900-06-15

// With time components
const d4 = new Date(75, 8, 15, 14, 30, 45);

// globalThis.Date patterns
const d5 = new globalThis.Date(25, 3, 10);

// Even with variable months
declare const m: number;
const d6 = new Date(60, m, 1);
```

### Correct

```js
/*eslint date-fns/no-legacy-year-components: "error"*/

import { parseISO } from 'date-fns';

// Explicit four-digit years
const d1 = parseISO("0042-01-01T00:00:00.000Z");
const d2 = parseISO("1999-12-31T00:00:00.000Z");

// Or use explicit 4-digit years
const d3 = new Date(2001, 0, 1);
const d4 = new Date(1995, 5, 15);

// Years outside the legacy range are fine
const d5 = new Date(100, 0, 1);    // year 100
const d6 = new Date(1000, 2, 20);  // year 1000

// Variables are not flagged
const year = 42;
const d7 = new Date(year, 0, 1);
```

## Autofix and Suggestions

This rule does not provide automatic fixes because it cannot know your intended century. Instead, it provides suggestions to use `parseISO()` with an explicit four-digit year format.

## Options

This rule has no configuration options.

## When Not To Use It

You might want to disable this rule when legacy fallbacks are needed or when working with historical dates where the 1900+ behavior is actually desired.

## Related Rules

- [no-date-constructor-string](./no-date-constructor-string.md) - Disallows string-based Date construction
- [prefer-iso-literal-over-components](./prefer-iso-literal-over-components.md) - Prefers ISO literals over component construction

## Version

This rule was introduced in eslint-plugin-date-fns v1.0.0.
