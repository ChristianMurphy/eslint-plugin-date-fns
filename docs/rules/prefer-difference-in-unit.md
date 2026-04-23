# prefer-difference-in-unit

Prefer the date-fns `differenceIn*` family over manual Date-subtraction
arithmetic.

🔧 Autofixable for known-unit divisors

## Rule Details

Manual Date-subtraction with a known-unit divisor (e.g.
`(b - a) / 86400000` for days) relies on the reader recognizing the magic
number and the implicit `Date` → `number` coercion. The date-fns helpers
name the intent and handle edge cases consistently.

The rule fires when:

- The outer expression is a `BinaryExpression` with operator `/`.
- The dividend is a `BinaryExpression` with operator `-`, both operands
  evaluating to `Date` (type-aware or AST-inferrable via `new Date(...)`
  or a known date-fns Date-returning function).
- The divisor statically evaluates to one of: `86_400_000` (days),
  `3_600_000` (hours), `60_000` (minutes), `1000` (seconds). Composite
  literal products such as `1000 * 60 * 60 * 24` are accepted.

## Examples

### ❌ Incorrect

```ts
/*eslint date-fns/prefer-difference-in-unit: "warn"*/

declare const a: Date;
declare const b: Date;

const days = (b - a) / 86400000;
const hours = (b - a) / 3600000;
const minutes = (b - a) / 60000;
const seconds = (b - a) / 1000;

// Composite literal divisor
const alsoDays = (b - a) / (1000 * 60 * 60 * 24);
```

### ✅ Correct

```ts
/*eslint date-fns/prefer-difference-in-unit: "warn"*/

import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
} from 'date-fns';

declare const a: Date;
declare const b: Date;

const days = differenceInDays(b, a);
const hours = differenceInHours(b, a);
const minutes = differenceInMinutes(b, a);
const seconds = differenceInSeconds(b, a);

// Non-Date arithmetic is untouched
declare const now: number;
const millisAgo = now - 1000;

// Unknown literal divisor
const weeksIsh = (b.getTime() - a.getTime()) / 7;
```

## Autofix and Suggestions

When both operands are demonstrably Date and the divisor matches a known
unit, the rule autofixes the expression to the matching
`differenceInUnit(left, right)` call and injects the helper's import.

## Options

This rule has no configuration options.

## When Not To Use It

If your codebase intentionally manipulates raw timestamps and you prefer
the `/ ms` style. Most codebases are better served by using the named
helpers.

## Related Rules

- [`no-magic-time`](./no-magic-time.md): flags the magic millisecond
  literals this rule works with.
- [`prefer-date-fns-comparison`](./prefer-date-fns-comparison.md):
  complements this rule for equality operators on Dates.

## Version

This rule was introduced in eslint-plugin-date-fns v0.7.0.
