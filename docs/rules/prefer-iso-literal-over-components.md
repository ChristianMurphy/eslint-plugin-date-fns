# prefer-iso-literal-over-components

Prefer explicit UTC ISO literals over multi-argument Date constructor.

🔧 Fixable
💡 Provides suggestions

## Rule Details

This rule prefers using explicit UTC ISO literals with `parseISO()` instead of the multi-argument Date constructor when all arguments are numeric literals. The component constructor is local-time based and error-prone due to DST quirks and the zero-based month indexing. ISO literals are self-explanatory and avoid off-by-one bugs.

### Examples

#### Incorrect

```js
/*eslint date-fns/prefer-iso-literal-over-components: "error"*/

// Basic date components (all literals)
const d1 = new Date(2024, 0, 2);  // January 2nd (month is 0-based)

// With time components
const d2 = new Date(2024, 6, 1, 13, 45, 10, 5);  // July 1st with time

// All numeric literals
const d3 = new Date(2024, 11, 31, 23, 59, 59, 999);

// Nested in expressions
const arr = [new Date(2024, 0, 1), new Date(2024, 0, 2)];
const obj = { start: new Date(2024, 5, 15) };

// Various argument counts
const dateOnly = new Date(2024, 2, 15);
const withHours = new Date(2024, 2, 15, 14);  
const withMinutes = new Date(2024, 2, 15, 14, 30);
const withSeconds = new Date(2024, 2, 15, 14, 30, 45);
const withMillis = new Date(2024, 2, 15, 14, 30, 45, 123);

// Edge cases  
const endOfYear = new Date(2024, 11, 31);
const startOfYear = new Date(2024, 0, 1);
const leapDay = new Date(2024, 1, 29);  // February 29th in leap year
```

#### Correct

```js
/*eslint date-fns/prefer-iso-literal-over-components: "error"*/

import { parseISO } from 'date-fns';

// Use explicit UTC ISO literals
const d1 = parseISO("2024-01-02T00:00:00.000Z");
const d2 = parseISO("2024-07-01T13:45:10.005Z");
const d3 = parseISO("2024-12-31T23:59:59.999Z");

// Nested in expressions
const arr = [parseISO("2024-01-01T00:00:00.000Z"), parseISO("2024-01-02T00:00:00.000Z")];
const obj = { start: parseISO("2024-06-15T00:00:00.000Z") };

// Various time specifications
const dateOnly = parseISO("2024-03-15T00:00:00.000Z");
const withHours = parseISO("2024-03-15T14:00:00.000Z");
const withMinutes = parseISO("2024-03-15T14:30:00.000Z");
const withSeconds = parseISO("2024-03-15T14:30:45.000Z");
const withMillis = parseISO("2024-03-15T14:30:45.123Z");

// When any argument is not a literal, it's allowed
declare const m: number;
const d4 = new Date(2024, m, 1);  // month is variable

// Expression arguments are allowed
const d5 = new Date(2024, getCurrentMonth(), 1);
const d6 = new Date(year + 1, 0, 1);

// Unknown/any types are allowed
declare const unknownMonth: unknown;
const d7 = new Date(2024, unknownMonth as number, 1);

// Different constructor patterns are not affected
const current = new Date();  // current time
const fromString = new Date('2024-01-01');  // string constructor
const fromEpoch = new Date(1726700000000);  // epoch timestamp
```

## Autofix Behavior

This rule provides automatic fixes that convert multi-argument Date constructors to equivalent UTC ISO literals:

- Month values are converted from 0-based to 1-based (0 → 01, 11 → 12)
- Missing time components default to 00
- Missing milliseconds default to 000
- All times are in UTC (Z suffix)

## When Not To Use It

Disable this rule if:

- Your codebase intentionally uses local time constructors
- You prefer the multi-argument Date constructor syntax
- You need the local timezone behavior of the Date constructor
- You're working with legacy code that depends on local time interpretation

## Related Rules

- [`no-date-constructor-string`](./no-date-constructor-string.md) - Prevents string-based Date constructors
- [`prefer-date-fns-from-epoch`](./prefer-date-fns-from-epoch.md) - Prefers fromUnixTime for epoch values

## Version

This rule was introduced in eslint-plugin-date-fns v1.0.0.
