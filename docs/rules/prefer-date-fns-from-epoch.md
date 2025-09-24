# prefer-date-fns-from-epoch

Prefer date-fns helpers for epoch numbers instead of Date constructor.

🔧 Fixable
💡 Provides suggestions

## Rule Details

This rule prefers using date-fns helpers when creating dates from epoch timestamps. It's easy to confuse seconds and milliseconds, and using dedicated helpers like `toDate(milliseconds)` and `fromUnixTime(seconds)` documents the unit and prevents mistakes./prefer-date-fns-from-epoch

**Prefer** `date‑fns` helpers for epoch numbers:
- `toDate(milliseconds)` instead of `new Date(milliseconds)`
- `fromUnixTime(seconds)` instead of `new Date(seconds)`

## Why?

- It’s easy to confuse seconds and milliseconds.
- Using dedicated helpers documents the unit and avoids mistakes.

## Examples

### Incorrect

```js
/*eslint date-fns/prefer-date-fns-from-epoch: "error"*/

// Numeric literals
const a = new Date(1726700000000);  // milliseconds
const b = new Date(1726700000);     // seconds (10 digits)

// Negative numbers (ambiguous)
const c = new Date(-1234567890);

// Variables with literal initialization
const ms = 1726700000000;
const d = new Date(ms);

// globalThis.Date patterns
const e = new globalThis.Date(1726700000);

// Unknown types that might be epoch numbers
declare const unknownEpoch: unknown;
const f = new Date(unknownEpoch as number);
```

### Correct

```js
/*eslint date-fns/prefer-date-fns-from-epoch: "error"*/

import { toDate, fromUnixTime } from 'date-fns';

// Use appropriate date-fns functions
const a = toDate(1726700000000);     // milliseconds
const b = fromUnixTime(1726700000);  // seconds

// Already using date-fns
const c = toDate(Date.now());

// Non-epoch Date usage
const d = new Date('2024-01-01');
const e = new Date(2024, 0, 1);
const f = new Date();

// Variables without literal initialization
declare const unknownValue: unknown;
const g = new Date(unknownValue as any);
```

## Autofix and Suggestions

This rule provides different behaviors depending on the input:

- For numeric literals: automatically fixes based on digit count (10-digit numbers use `fromUnixTime`, others use `toDate`)
- For variables and expressions: provides suggestions for both `toDate(x)` and `fromUnixTime(x)` since the unit cannot be determined statically

## Options

This rule has no configuration options.

## When Not To Use It

There is no good reason to disable this rule. Using date-fns helpers for epoch timestamps makes code more readable and prevents unit confusion.

## Related Rules

- [no-date-constructor-string](./no-date-constructor-string.md) - Disallows string-based Date construction
- [prefer-iso-literal-over-components](./prefer-iso-literal-over-components.md) - Prefers ISO literals over component construction

## Version

This rule was introduced in eslint-plugin-date-fns v1.0.0.